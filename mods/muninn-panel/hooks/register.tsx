import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { PanelData, PanelView } from '../types'

const PANE = 'muninn'
const TOOL: Record<string, string> = { 'claude-code': 'Claude Code', codex: 'Codex', cursor: 'Cursor' }
// Change the tag when PanelView's fields change, so a value stored by an older version is dropped.
const view = atom({ plugin: 'muninn-panel', key: 'view' } as const, { data: null, error: null, showHandoff: false } as PanelView, { shape: 'view-1' })

/** Runs the muninn CLI. It must be on the PATH Claude Code was started with. */
async function muninn($: any, args: string[]): Promise<{ ok: boolean; out: string }> {
  try {
    const r = await $.process.run(['muninn', ...args], { timeoutMs: 15_000, env: { MUNINN_INTERNAL: '1' } })
    return { ok: r.exitCode === 0, out: (r.exitCode === 0 ? r.stdout : r.stderr || r.stdout).trim() }
  } catch (err) {
    return { ok: false, out: err instanceof Error ? err.message : String(err) }
  }
}

async function refresh($: any) {
  const [session, cwd] = await Promise.all([$.session.id(), $.session.cwd()])
  const r = await muninn($, ['panel', '--session', session, '--cwd', cwd])
  if (!r.ok) {
    await update($, view, v => ({ ...v, error: /ENOENT|not found/i.test(r.out) ? 'muninn is not on the PATH Claude Code was started with.' : r.out.slice(0, 300) }))
    return
  }
  let data: PanelData
  try { data = JSON.parse(r.out) } catch { await update($, view, v => ({ ...v, error: 'muninn returned something unexpected.' })); return }
  await update($, view, v => ({ ...v, data, error: null }))
  $.ui.status(data.sent.length ? `muninn: ${data.sent.length} sent` : undefined)
}

/** Runs an action, says what happened, and redraws. */
async function act($: any, args: string[], done: string) {
  const r = await muninn($, args)
  $.ui.toast(r.ok ? (args[0] === 'ui' ? done : r.out.split('\n')[0] || done) : `muninn: ${r.out.split('\n')[0]}`)
  await refresh($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'muninn', description: 'Show what muninn told this session, and why' })
    void $.ui.open({ id: PANE, title: 'muninn' })
    void refresh($)
    // Hooks deliver during a turn; the panel catches up when the turn ends and every half minute.
    $.clock.every(30_000, () => refresh($))
    return next(e)
  })

  on('command.run', { command: 'muninn' }, async $ => {
    await $.ui.open({ id: PANE, title: 'muninn' })
    await refresh($)
    return { text: 'muninn panel opened.' }
  })

  on('turn.complete', async ($, e, next) => {
    void refresh($)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const { data, error, showHandoff } = await read($, view)
    if (error) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text color="warning">{error}</Text>
          <Text dimColor>Run "muninn status" in a terminal to check it.</Text>
          <Button key="retry" onPress={() => refresh($)}>Try again</Button>
        </Box>
      )
    }
    if (!data) return <Text dimColor>Loading…</Text>
    const w = data.week
    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor wrap="truncate-end">{data.repoShort}{data.branch ? ` · ${data.branch}` : ''}</Text>

        <Box flexDirection="column">
          <Text bold>Sent this session</Text>
          {data.sent.length === 0 && <Text dimColor>Nothing yet. Lessons arrive at session start, or when a keyword or a failed command matches.</Text>}
          {data.sent.map(s => (
            <Box key={s.id} flexDirection="column" marginTop={1}>
              <Text wrap="wrap">{s.plain ?? s.text}</Text>
              <Box flexDirection="row" gap={1}>
                <Text dimColor>why: {s.why}</Text>
                <Button key={`retire-${s.id}`} plain dimColor onPress={() => act($, ['retire', s.id], 'Retired.')}>retire</Button>
              </Box>
            </Box>
          ))}
        </Box>

        {data.handoff && (
          <Box flexDirection="column">
            <Box flexDirection="row" gap={1}>
              <Text bold>Handoff</Text>
              <Text dimColor>{data.handoff.delivered ? 'given to this session' : 'for this branch'} · {TOOL[data.handoff.tool] ?? data.handoff.tool}, {data.handoff.age}</Text>
            </Box>
            <Text wrap="wrap">{showHandoff ? data.handoff.text : data.handoff.text.split('\n').slice(0, 2).join('\n')}</Text>
            <Button key="handoff-toggle" plain dimColor onPress={() => update($, view, v => ({ ...v, showHandoff: !v.showHandoff }))}>{showHandoff ? 'less' : 'more'}</Button>
          </Box>
        )}

        {data.waiting.count > 0 && (
          <Box flexDirection="column">
            <Text bold>Waiting for you ({data.waiting.count})</Text>
            {data.waiting.top.map(l => (
              <Box key={l.id} flexDirection="column" marginTop={1}>
                <Text wrap="wrap">{l.kind === 'note' ? 'note: ' : ''}{l.text}</Text>
                <Box flexDirection="row" gap={1}>
                  <Button key={`keep-${l.id}`} variant="primary" onPress={() => act($, ['keep', l.id], 'Kept.')}>Keep</Button>
                  <Button key={`reject-${l.id}`} onPress={() => act($, ['reject', l.id], 'Rejected.')}>Reject</Button>
                  <Text dimColor>{l.route}</Text>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        <Box flexDirection="column">
          <Text bold>This week</Text>
          <Text dimColor wrap="wrap">
            {w.sent} lesson(s) sent in {w.sessions} session(s) · {w.kept} kept · {w.cameBack} came back after keeping
            {w.muninnCalls ? ` · muninn's own AI: ${w.muninnCalls} call(s)${w.muninnCostUsd != null ? `, $${w.muninnCostUsd.toFixed(2)}` : ''}` : ''}
          </Text>
        </Box>

        <Box flexDirection="row" gap={1}>
          <Button key="open-ui" onPress={() => act($, ['ui', '--detach'], 'Opened muninn in your browser.')}>Open muninn</Button>
          <Button key="refresh" plain dimColor onPress={() => refresh($)}>refresh</Button>
        </Box>
      </Box>
    )
  })
}
