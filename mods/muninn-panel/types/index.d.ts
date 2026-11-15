export type ReceiptLine = { at: string; tool: string; kind: 'lesson' | 'handoff'; id: string; text: string; why: string; session: string | null }
export type Carried = { id: string; label: string; route: string; state: 'lit' | 'armed' | 'fading'; lastTold: string | null; global: boolean }
export type Waiting = { id: string; text: string; plain: string | null; origin: string; route: string }
export type PanelData = {
  repo: string | null
  repoShort: string
  branch: string | null
  dial: 'quiet' | 'start' | 'anytime'
  stats: { told: number; sessions: number; cameBack: number; costUsd: number | null }
  receipt: ReceiptLine[]
  waiting: { count: number; top: Waiting[] }
  cameBack: { id: string; text: string; verdict: string; fix: string | null }[]
  carry: Carried[]
}
export type PanelView = { data: PanelData | null; error: string | null; marked: string[] }

declare module 'claude-code' {
  interface PluginState {
    'muninn-panel': { view: Shaped<PanelView> }
  }
}
