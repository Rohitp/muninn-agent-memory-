import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { PanelData, PanelView } from '../types'

// The console, with restraint (docs/design-language.md): the receipt, the dial, the dots. Blue is muninn, orange is "came back".
const PANE = 'muninn'
const EYE = '#6E7DFF'
const EYE_TEXT = '#A9B1FF'
const SIGNAL = '#FF7A3D'
const MUTED = '#8E919C'
// The dial answers one question: when should muninn speak up to your agents?
const DIAL_ORDER = ['quiet', 'start', 'anytime'] as const
const DIAL_LABEL = { quiet: 'only when asked', start: 'at session start', anytime: 'whenever relevant' } as const
const DIAL_WORDS = {
  quiet: 'Never on its own. Agents can still run muninn ask.',
  start: 'Every-session lessons and where you left off, then silence.',
  anytime: 'Also mid-task, when your word comes up or a command fails the way it has before.',
} as const
// Change the tag when PanelView's fields change, so a value stored by an older version is dropped.
const view = atom({ plugin: 'muninn-panel', key: 'view' } as const, { data: null, error: null, marked: [] } as PanelView, { shape: 'view-3' })

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
  $.ui.status(data.receipt.length ? `muninn · ${data.receipt.length} told` : undefined)
}

/** Runs an action, says what happened in one line, and redraws. */
async function act($: any, args: string[], done?: string) {
  const r = await muninn($, args)
  $.ui.toast(r.ok ? (done ?? r.out.split('\n')[0] ?? 'Done.') : `muninn: ${r.out.split('\n')[0]}`)
  await refresh($)
}

const time = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
/** The week in one plain line, answering "is muninn helping?". */
function weekLine(w: PanelData['week']): string {
  const parts = [`this week: agents told in ${w.sessions} session${w.sessions === 1 ? '' : 's'}`]
  if (w.problems.kept) parts.push(w.problems.cameBack ? `${w.problems.cameBack} kept problem${w.problems.cameBack === 1 ? '' : 's'} came back` : 'no kept problem came back')
  if (w.costUsd != null) parts.push(`cost $${w.costUsd.toFixed(3)}`)
  return parts.join(' · ')
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
    const { data, error, marked } = await read($, view)
    if (error) {
      return (
        <Box flexDirection="column" gap={1}>
          <Text color={SIGNAL}>{error}</Text>
          <Text dimColor>Run "muninn status" in a terminal to check it.</Text>
          <Button key="retry" onPress={() => refresh($)}>try again</Button>
        </Box>
      )
    }
    if (!data) return <Text dimColor>Loading…</Text>
    const session = await $.session.id()
    const mark = (id: string) => update($, view, v => ({ ...v, marked: [...v.marked, id].slice(-50) }))
    const top = data.waiting.top[0]
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text><Text color={EYE}>{data.receipt.length ? '●' : '○'}</Text> <Text bold>muninn</Text> <Text color={MUTED}>{data.repoShort}</Text></Text>
          <Box flexDirection="row" gap={1}>
            <Text color={MUTED}>speaks up</Text>
            <Button key="dial" plain onPress={() => {
              const next = DIAL_ORDER[(DIAL_ORDER.indexOf(data.dial) + 1) % DIAL_ORDER.length]!
              return act($, ['dial', next], `muninn now speaks up ${DIAL_LABEL[next]} here.`)
            }}>[ {DIAL_LABEL[data.dial]} ▸ ]</Button>
          </Box>
          <Text color={MUTED} wrap="wrap">{DIAL_WORDS[data.dial]}</Text>
        </Box>

        <Box flexDirection="column">
          <Text color={MUTED}>TOLD YOUR AGENT THIS SESSION</Text>
          {data.receipt.length === 0 && (
            <Text color={MUTED}>{data.dial === 'quiet' ? 'The dial is at quiet: muninn says nothing unless asked.' : 'Nothing yet. muninn speaks at the start, and when a word or a failed command matches.'}</Text>
          )}
          {data.receipt.map(x => (
            <Box key={`${x.kind}-${x.id}`} flexDirection="column" marginTop={1}>
              <Box flexDirection="row" justifyContent="space-between">
                <Text bold>{time(x.at)}</Text>
                <Text color={MUTED}>{x.kind === 'handoff' ? 'handoff' : x.why.startsWith('always-on') ? 'start' : x.why.includes('failed') ? 'failed cmd' : 'your prompt'}</Text>
              </Box>
              <Text wrap="wrap">{x.text}</Text>
              <Text color={EYE_TEXT} wrap="wrap">↳ because {x.why.replace(/^always-on, /, '').replace(/^at session start$/, 'a session started')}</Text>
              {x.kind === 'lesson' && (marked.includes(x.id)
                ? <Text color={MUTED}>noted</Text>
                : (
                  <Box flexDirection="row" gap={2}>
                    <Button key={`helped-${x.id}`} plain onPress={async () => { await mark(x.id); await act($, ['feedback', x.id, 'helped', '--session', session], 'Noted: it helped.') }}>[ helped ]</Button>
                    <Button key={`wrong-${x.id}`} plain dimColor onPress={async () => { await mark(x.id); await act($, ['feedback', x.id, 'wrong', '--session', session]) }}>[ wrong here ]</Button>
                  </Box>
                ))}
            </Box>
          ))}
        </Box>

        {top && (
          <Box flexDirection="column">
            <Text color={MUTED}>NEW LESSONS TO REVIEW · {data.waiting.count}</Text>
            <Text color={MUTED} wrap="wrap">Found in your sessions. Agents aren't told until you keep one.</Text>
            <Text wrap="wrap">{top.plain ?? top.text}</Text>
            <Text color={MUTED} wrap="wrap">if kept: told {top.route}</Text>
            <Box flexDirection="row" gap={2}>
              <Button key={`keep-${top.id}`} plain hotkey="1" onPress={() => act($, ['keep', top.id], 'Kept. Agents are told from their next session.')}>keep</Button>
              <Button key={`reject-${top.id}`} plain hotkey="2" onPress={() => act($, ['reject', top.id], "Not kept. muninn won't suggest it again.")}>don't keep</Button>
              <Button key="open-review" plain dimColor hotkey="3" onPress={() => act($, ['ui', '--detach'], 'Opened muninn in your browser.')}>review all</Button>
            </Box>
          </Box>
        )}

        {data.cameBack.map(c => (
          <Box key={`back-${c.id}`} flexDirection="column">
            <Text color={SIGNAL} wrap="wrap">● the problem came back: {c.text}</Text>
            <Text color={MUTED} wrap="wrap">  {c.verdict}</Text>
            {c.fix === 'always-on' && <Button key={`fix-${c.id}`} plain onPress={() => act($, ['edit', c.id, '--always-on'], 'Told every session now.')}>  [ tell it every session ]</Button>}
          </Box>
        ))}

        {data.carry.length > 0 && (
          <Box flexDirection="column">
            <Text color={MUTED}>AGENTS CARRY</Text>
            {data.carry.slice(0, 8).map(c => (
              <Text key={`carry-${c.id}`} wrap="truncate-end" dimColor={c.state === 'fading'}>
                <Text color={c.state === 'fading' ? MUTED : EYE}>{c.state === 'lit' ? '●' : c.state === 'armed' ? '○' : '·'}</Text> {c.label}{c.state === 'armed' ? <Text color={MUTED}> {c.route.replace(/^when /, '').replace(/ comes up$/, '')}</Text> : c.state === 'fading' ? <Text color={MUTED}>  fading</Text> : ''}
              </Text>
            ))}
          </Box>
        )}

        <Box flexDirection="row" justifyContent="space-between">
          <Text color={MUTED} wrap="wrap">{weekLine(data.week)}</Text>
          <Button key="open-ui" plain onPress={() => act($, ['ui', '--detach'], 'Opened muninn in your browser.')}>open ↗</Button>
        </Box>
      </Box>
    )
  })
}
