import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { PanelData, PanelView } from '../types'

// Design B, "next step first" (docs/design-language.md, canvas https://claude.ai/artifact/2ogVemngXhWCZKUc3W2eMi):
// the one thing to do now on top with the only solid button, then quiet context. Colors are the app's own,
// so light and dark follow it: 'suggestion' is muninn's blue, 'warning' is "a loop" or "the problem came back".
const PANE = 'muninn'
const ACCENT = 'suggestion'
const SIGNAL = 'warning'
// The setting answers one question: when should muninn speak up to your agents?
const DIAL_LABEL = { quiet: 'only when asked', start: 'at session start', anytime: 'whenever relevant' } as const
const DIAL_WORDS = {
  quiet: 'Never on its own. Agents can still look things up with muninn ask.',
  start: 'Every-session lessons and where you left off, then quiet.',
  anytime: 'At the start, and mid-task when your word comes up or a command fails the way it has before.',
} as const
/** How recent a loop must be to go on top: older ones are history. */
const LOOP_FRESH_MS = 30 * 60_000

// Change the tag when PanelView's fields change, so a value stored by an older version is dropped.
const view = atom({ plugin: 'muninn-panel', key: 'view' } as const, { data: null, error: null, marked: [], dismissed: [] } as PanelView, { shape: 'view-4' })

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
    await update($, view, v => ({ ...v, error: /ENOENT|not found/i.test(r.out) ? 'missing' : r.out.slice(0, 300) }))
    return
  }
  let data: PanelData
  try { data = JSON.parse(r.out) } catch { await update($, view, v => ({ ...v, error: 'muninn returned something unexpected.' })); return }
  await update($, view, v => ({ ...v, data, error: null }))
  $.ui.status(data.receipt.length ? `muninn · told ${data.receipt.length}` : undefined)
}

/** Runs an action, says what happened in one line, and redraws. */
async function act($: any, args: string[], done?: string) {
  const r = await muninn($, args)
  $.ui.toast(r.ok ? (done ?? r.out.split('\n')[0] ?? 'Done.') : `muninn: ${r.out.split('\n')[0]}`)
  await refresh($)
}

const time = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const ago = (iso: string) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60_000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago` }
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
/** The week in a sentence or two: numbers live in sentences. */
function weekSentence(w: PanelData['week']): string {
  const parts = [w.sessions ? `This week muninn told your agents in ${plural(w.sessions, 'session')}.` : 'muninn hasn\'t told your agents anything this week.']
  if (w.problems.kept) parts.push(w.problems.cameBack ? `${plural(w.problems.cameBack, 'problem')} you kept a lesson for came back.` : `The ${plural(w.problems.kept, 'problem')} you kept a lesson for ${w.problems.kept === 1 ? "hasn't" : "haven't"} come back.`)
  if (w.costUsd != null) parts.push(`Its own AI calls cost $${w.costUsd.toFixed(2)}.`)
  return parts.join(' ')
}
const sourceOf = (why: string, kind: string) => kind === 'handoff' ? 'session start' : why.startsWith('always-on') ? 'session start' : why.includes('failed') ? 'failed command' : 'your prompt'

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
    const { Box, Text, Button, Select } = $.ui.resolve(e)
    const { data, error, marked, dismissed } = await read($, view)
    const caption = (text: string, color?: string) => <Text size="caption" weight="medium" color={color} dimColor={!color}>{text.toUpperCase()}</Text>

    if (error) {
      const missing = error === 'missing'
      return (
        <Box flexDirection="column" gap="sm" padding="md">
          <Text weight="semibold">muninn</Text>
          <Text weight="semibold" color={SIGNAL}>The panel can't run muninn.</Text>
          <Text wrap="wrap">{missing ? 'Claude Code couldn\'t find the muninn command. Your agents are still told lessons through the hooks; only this panel is affected.' : error}</Text>
          {missing && <Text dimColor size="footnote" wrap="wrap">To fix it, run npm link in the muninn folder, then start a new session.</Text>}
          {!missing && <Text dimColor size="footnote" wrap="wrap">Run muninn status in a terminal to see what's wrong.</Text>}
          <Box flexDirection="row"><Button key="retry" variant="secondary" label="Try again" onPress={() => refresh($)} /></Box>
        </Box>
      )
    }
    if (!data) return <Box padding="md"><Text dimColor>Loading…</Text></Box>

    const session = await $.session.id()
    const mark = (id: string) => update($, view, v => ({ ...v, marked: [...v.marked, id].slice(-50) }))
    const dismiss = (id: string) => update($, view, v => ({ ...v, dismissed: [...v.dismissed, id].slice(-50) }))

    // The one thing to do now, in order: a loop happening now, a kept problem that came back, a lesson to review.
    const loop = data.loops.find(l => Date.now() - Date.parse(l.at) < LOOP_FRESH_MS && !dismissed.includes(`loop:${l.name}:${l.at}`))
    const back = data.cameBack.find(c => !dismissed.includes(`back:${c.id}`))
    const lesson = data.waiting.top[0]
    const firstRun = !loop && !back && !lesson && !data.kept && !data.receipt.length

    const header = (
      <Box key="header" flexDirection="column" gap="xs">
        <Box flexDirection="row" gap="xs" alignItems="center">
          <Text weight="semibold">muninn</Text>
          <Text dimColor wrap="truncate-end">{data.repoShort}{data.branch ? ` · ${data.branch}` : ''}</Text>
        </Box>
        {/* The setting on a row of its own: beside the name it doesn't fit a narrow pane. */}
        <Box flexDirection="row" gap="sm" alignItems="center">
          <Text dimColor size="footnote">Speaks up</Text>
          <Select
            key="dial"
            value={data.dial}
            options={(Object.keys(DIAL_LABEL) as (keyof typeof DIAL_LABEL)[]).map(k => ({ value: k, label: DIAL_LABEL[k] }))}
            onSelect={v => act($, ['dial', v], `muninn now speaks up ${DIAL_LABEL[v as keyof typeof DIAL_LABEL]} here.`)}
          />
        </Box>
        <Text dimColor size="footnote" wrap="wrap">{DIAL_WORDS[data.dial]}</Text>
      </Box>
    )

    const card = (color: string | undefined, children: any) => (
      <Box key="todo" flexDirection="column" gap="sm" padding="md" borderStyle="round" borderColor={color ?? 'subtle'}>{children}</Box>
    )
    let todo: any = null
    if (loop) {
      todo = card(SIGNAL, [
        caption(`Loop caught · ${ago(loop.at)}`, SIGNAL),
        <Text key="t" weight="semibold" wrap="wrap">{loop.name} failed {loop.n} times the same way.</Text>,
        loop.err ? <Text key="e" dimColor size="footnote" wrap="wrap">Same error each time: {loop.err}</Text> : null,
        loop.told ? <Text key="told" wrap="wrap">muninn told your agent to stop retrying and read the error.</Text> : null,
        loop.tokens > 200 ? <Text key="cost" dimColor size="footnote">About {loop.tokens.toLocaleString('en-GB')} tokens went on the repeats.</Text> : null,
        <Box key="b" flexDirection="row" gap="sm">
          <Button key="loop-scan" variant="primary" label={data.scanning ? 'Checking…' : 'Find a lesson in it'} onPress={() => act($, ['scan'])} />
          <Button key="loop-later" variant="secondary" label="Not now" onPress={() => dismiss(`loop:${loop.name}:${loop.at}`)} />
        </Box>,
      ])
    } else if (back) {
      todo = card(SIGNAL, [
        caption('The problem came back', SIGNAL),
        <Text key="t" weight="semibold" wrap="wrap">{back.full ?? back.text}</Text>,
        <Text key="v" dimColor size="footnote" wrap="wrap">{back.verdict}</Text>,
        <Box key="b" flexDirection="row" gap="sm">
          {back.fix === 'always-on' && <Button key={`fix-${back.id}`} variant="primary" label="Tell it every session" onPress={() => act($, ['edit', back.id, '--always-on'], 'Told every session now.')} />}
          <Button key={`leave-${back.id}`} variant="secondary" label="Leave it" onPress={() => dismiss(`back:${back.id}`)} />
        </Box>,
      ])
    } else if (lesson) {
      todo = card(undefined, [
        caption(data.waiting.count > 1 ? `To do now · 1 of ${data.waiting.count}` : 'To do now'),
        <Text key="h" weight="semibold">A new lesson to review</Text>,
        <Text key="t" wrap="wrap">{lesson.plain ?? lesson.text}</Text>,
        <Text key="why" dimColor size="footnote" wrap="wrap">{lesson.origin}. Agents aren't told until you keep it.</Text>,
        lesson.worth ? <Text key="worth" dimColor size="footnote" wrap="wrap">{lesson.worth}</Text> : null,
        <Text key="route" dimColor size="footnote">If kept: told {lesson.route}.</Text>,
        <Box key="b" flexDirection="row" gap="sm" alignItems="center">
          <Button key={`keep-${lesson.id}`} variant="primary" hotkey="1" label="Keep" onPress={() => act($, ['keep', lesson.id], 'Kept. Agents are told from their next session.')} />
          <Button key={`reject-${lesson.id}`} variant="secondary" hotkey="2" label="Don't keep" onPress={() => act($, ['reject', lesson.id], "Not kept. muninn won't suggest it again.")} />
          {data.waiting.count > 1 && <Button key="review-all" plain label={`Review all ${data.waiting.count} ↗`} onPress={() => act($, ['ui', '--detach'], 'Opened muninn in your browser.')} />}
        </Box>,
      ])
    } else if (firstRun) {
      todo = (
        <Box key="first" flexDirection="column" gap="sm">
          <Text weight="semibold">Nothing to tell your agent yet.</Text>
          <Text wrap="wrap">muninn reads your sessions and suggests lessons from what you repeat, correct, or what keeps failing. It also keeps a short summary of where each branch stands.</Text>
          <Text dimColor size="footnote" wrap="wrap">{data.sessionsHere ? `muninn has seen ${plural(data.sessionsHere, 'session')} here. ` : ''}Suggestions usually start after 2 or 3.</Text>
          <Box flexDirection="row"><Button key="scan" variant="primary" label={data.scanning ? 'Checking your sessions…' : 'Check my sessions now'} onPress={() => act($, ['scan'])} /></Box>
        </Box>
      )
    }

    const told = (
      <Box key="told" flexDirection="column" gap="sm">
        {caption('Told your agent this session')}
        {data.receipt.length === 0 && (
          <Text dimColor size="footnote" wrap="wrap">{data.dial === 'quiet' ? 'Nothing: muninn speaks only when asked.' : 'Nothing yet. muninn speaks at the start, and when a word or a failed command matches.'}</Text>
        )}
        {data.receipt.slice(0, 5).map(x => (
          <Box key={`${x.kind}-${x.id}`} flexDirection="column" gap="xs">
            <Box flexDirection="row" justifyContent="space-between">
              <Text dimColor size="footnote" tabular>{time(x.at)}</Text>
              <Text dimColor size="footnote">{sourceOf(x.why, x.kind)}</Text>
            </Box>
            <Text wrap="wrap">{x.kind === 'handoff' ? 'Where the last session on this branch left off.' : x.text}</Text>
            <Text color={ACCENT} size="footnote" wrap="wrap">because {x.why.replace(/^always-on, /, '').replace(/^at session start$/, 'a session started')}</Text>
            {x.kind === 'lesson' && (marked.includes(x.id)
              ? <Text dimColor size="footnote">Noted, thanks.</Text>
              : (
                <Box flexDirection="row" gap="md">
                  <Button key={`helped-${x.id}`} plain label="helped" onPress={async () => { await mark(x.id); await act($, ['feedback', x.id, 'helped', '--session', session], 'Noted: it helped.') }} />
                  <Button key={`wrong-${x.id}`} plain dimColor label="wrong here" onPress={async () => { await mark(x.id); await act($, ['feedback', x.id, 'wrong', '--session', session]) }} />
                </Box>
              ))}
          </Box>
        ))}
      </Box>
    )

    const plan = data.plan ?? (data.handoff ? { goal: null, status: data.handoff.text.split('\n')[0] ?? null, next: [] } : null)
    const leftOff = plan && (
      <Box key="plan" flexDirection="column" gap="sm">
        {caption(`Where you left off${data.branch ? ` · ${data.branch}` : ''}`)}
        {plan.goal && <Text weight="semibold" wrap="wrap">{plan.goal}</Text>}
        {plan.status && <Text dimColor wrap="wrap">{plan.status}</Text>}
        {plan.next.length > 0 && (
          <Box flexDirection="column" gap="xs">
            <Text dimColor size="footnote">Next</Text>
            {plan.next.map((n, i) => <Text key={`next-${i}`} wrap="wrap">{i + 1}. {n}</Text>)}
          </Box>
        )}
      </Box>
    )

    const know = data.carry.length > 0 && (
      <Box key="know" flexDirection="column" gap="xs">
        {caption(`Your agents know ${plural(data.carry.length, 'thing')} here`)}
        {data.carry.slice(0, 6).map(c => (
          <Box key={`carry-${c.id}`} flexDirection="row" gap="sm">
            <Text color={c.state === 'fading' ? undefined : ACCENT} dimColor={c.state === 'fading'}>{c.state === 'lit' ? '●' : c.state === 'armed' ? '○' : '·'}</Text>
            <Box flexGrow={1} flexShrink={1}><Text wrap="truncate-end" dimColor={c.state === 'fading'}>{c.label}</Text></Box>
            <Text dimColor size="footnote">{c.state === 'lit' ? 'told today' : c.state === 'fading' ? 'not needed lately' : c.route}</Text>
          </Box>
        ))}
      </Box>
    )

    const week = (
      <Box key="week" flexDirection="column" gap="xs">
        <Text dimColor size="footnote" wrap="wrap">{weekSentence(data.week)}</Text>
        <Box flexDirection="row"><Button key="open-ui" plain label="Open muninn in your browser ↗" onPress={() => act($, ['ui', '--detach'], 'Opened muninn in your browser.')} /></Box>
      </Box>
    )

    return (
      <Box flexDirection="column" gap="lg" padding="md">
        {header}
        {todo}
        {told}
        {leftOff}
        {know}
        {week}
      </Box>
    )
  })
}
