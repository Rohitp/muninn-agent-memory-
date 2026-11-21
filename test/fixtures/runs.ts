import type { Run } from "../../src/workflow/runs.js";

/** Stand-in runs in the real shape: a dartboard-like factory with five roles, and a small builder/reviewer run. */
const t = (h: number, m: number) => new Date(Date.UTC(2026, 10, 21, h, m)).toISOString();
const sess = (id: string, role: string, from: [number, number], to: [number, number], tokensIn: number, tokensOut: number, commands = 0, failed = 0, parent: string | null = "main-1") => ({
  id, tool: "antigravity", role, branch: role === "main" ? "main" : `agent/${role}`, worktree: role === "main" ? null : `.worktrees/${role}`, parent_session: role === "main" ? null : parent,
  agent_type: role === "main" ? null : role, started_at: t(...from), ended_at: t(...to), tokens_in: tokensIn, tokens_out: tokensOut, cache_read: 0, model: "gemini-4-argon-high",
  commands, failed_commands: failed, task: role === "main" ? null : `${role} work for milestone 1`, typed: role === "main" ? 7 : 0,
});
const run = (r: Omit<Run, "team" | "tokens_in" | "tokens_out">): Run => ({ ...r, team: r.roles.length > 1, tokens_in: r.sessions.reduce((a, s) => a + s.tokens_in, 0), tokens_out: r.sessions.reduce((a, s) => a + s.tokens_out, 0) });

export const standInRuns: Run[] = [
  run({
    id: "run-dart-1", repo_id: "github.com/rohitp/dartboard", started_at: t(14, 3), ended_at: t(16, 40),
    roles: ["main", "product-manager", "builder", "checker", "reviewer", "qa"],
    sessions: [
      sess("main-1", "main", [14, 3], [16, 40], 220_000, 18_000, 16),
      sess("pm-1", "product-manager", [14, 6], [14, 22], 90_000, 9_000, 4),
      sess("b-1", "builder", [14, 22], [15, 31], 610_000, 52_000, 60, 3),
      sess("c-1", "checker", [15, 31], [15, 38], 70_000, 3_000, 6),
      sess("r-1", "reviewer", [15, 38], [15, 50], 180_000, 6_000, 9),
      sess("b-2", "builder", [15, 50], [16, 18], 330_000, 30_000, 27),
      sess("q-1", "qa", [16, 26], [16, 40], 260_000, 4_000, 12),
    ],
    handoffs: [
      { from_role: "product-manager", to_role: "builder", at: t(14, 22), kind: "handoff", note: "Spec #2: paper-trading engine with 10 isolated agents" },
      { from_role: "builder", to_role: "checker", at: t(15, 31), kind: "handoff", note: "PR #4 opened: engine + tests" },
      { from_role: "checker", to_role: "everyone", at: t(15, 38), kind: "approved", note: "CHECK PASS on PR #4: tests pass locally" },
      { from_role: "reviewer", to_role: "builder", at: t(15, 50), kind: "review_rejected", note: "Agents share one portfolio object; isolation in the spec is not met" },
      { from_role: "qa", to_role: "builder, reviewer", at: t(16, 38), kind: "rework", note: "Follow-up: dashboard shows stale prices after restart" },
      { from_role: "builder", to_role: "qa", at: t(16, 26), kind: "handoff", note: "PR #4 updated: separate portfolios" },
    ],
    bounces: 1, wasted_tokens: 34_000,
  }),
  run({
    id: "run-dart-2", repo_id: "github.com/rohitp/dartboard", started_at: t(9, 10), ended_at: t(9, 55),
    roles: ["main", "builder", "reviewer"],
    sessions: [
      sess("main-2", "main", [9, 10], [9, 55], 60_000, 5_000, 2, 0, null),
      sess("b-3", "builder", [9, 12], [9, 40], 200_000, 15_000, 20, 0, "main-2"),
      sess("r-2", "reviewer", [9, 41], [9, 55], 90_000, 3_000, 5, 0, "main-2"),
    ],
    handoffs: [{ from_role: "builder", to_role: "reviewer", at: t(9, 40), kind: "handoff", note: "PR #3: dashboard skeleton" }],
    bounces: 0, wasted_tokens: 0,
  }),
];
