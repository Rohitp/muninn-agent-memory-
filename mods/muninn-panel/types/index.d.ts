export type Sent = { id: string; text: string; plain: string | null; why: string; at: string }
export type Waiting = { id: string; text: string; kind: string; route: string }
export type PanelData = {
  repo: string | null
  repoShort: string
  branch: string | null
  sent: Sent[]
  handoff: { text: string; age: string; tool: string; delivered: boolean } | null
  waiting: { count: number; top: Waiting[] }
  week: { sent: number; sessions: number; kept: number; cameBack: number; muninnCostUsd: number | null; muninnCalls: number }
}
export type PanelView = { data: PanelData | null; error: string | null; showHandoff: boolean }

declare module 'claude-code' {
  interface PluginState {
    'muninn-panel': { view: Shaped<PanelView> }
  }
}
