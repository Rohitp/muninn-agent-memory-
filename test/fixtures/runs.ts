import type { Run } from "../../src/commands/run-findings.js";

/** Stand-in runs in the shape agreed with the data side: a dartboard-like factory with five roles. */
const t = (h: number, m: number) => new Date(Date.UTC(2026, 10, 21, h, m)).toISOString();
const sess = (id: string, role: string, from: [number, number], to: [number, number], tokensIn: number, tokensOut: number, cost: number, typed = 0, parent: string | null = "main-1") => ({
  id, tool: "antigravity", role, branch: role === "main" ? "main" : `agent/${role}`, worktree: role === "main" ? null : `.worktrees/${role}`, parent_session: role === "main" ? null : parent,
  agent_type: role === "main" ? null : role, started_at: t(...from), ended_at: t(...to), tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: cost, typed,
});

export const standInRuns: Run[] = [
  {
    id: "run-dart-1", repo_id: "github.com/rohitp/dartboard", started_at: t(14, 3), ended_at: t(16, 40),
    roles: ["main", "product-manager", "builder", "checker", "reviewer", "qa"],
    sessions: [
      sess("main-1", "main", [14, 3], [16, 40], 220_000, 18_000, 0.62, 7),
      sess("pm-1", "product-manager", [14, 6], [14, 22], 90_000, 9_000, 0.21),
      sess("b-1", "builder", [14, 22], [15, 31], 610_000, 52_000, 1.84),
      sess("c-1", "checker", [15, 31], [15, 38], 70_000, 3_000, 0.12),
      sess("r-1", "reviewer", [15, 38], [15, 50], 180_000, 6_000, 0.41),
      sess("b-2", "builder", [15, 50], [16, 18], 330_000, 30_000, 0.97),
      sess("q-1", "qa", [16, 26], [16, 40], 260_000, 4_000, 0.55),
    ],
    handoffs: [
      { from_role: "product-manager", to_role: "builder", at: t(14, 22), kind: "handoff", evidence: "Spec #2: paper-trading engine with 10 isolated agents" },
      { from_role: "builder", to_role: "checker", at: t(15, 31), kind: "handoff", evidence: "PR #4 opened: engine + tests" },
      { from_role: "checker", to_role: "reviewer", at: t(15, 38), kind: "handoff", evidence: "tests pass locally" },
      { from_role: "reviewer", to_role: "builder", at: t(15, 50), kind: "review_rejected", evidence: "Agents share one portfolio object; isolation in the spec is not met" },
      { from_role: "builder", to_role: "qa", at: t(16, 26), kind: "handoff", evidence: "PR #4 updated: separate portfolios" },
    ],
    bounces: 1, wasted_tokens: 340_000,
  },
  {
    id: "run-dart-2", repo_id: "github.com/rohitp/dartboard", started_at: t(9, 10), ended_at: t(9, 55),
    roles: ["main", "builder", "reviewer"],
    sessions: [
      sess("main-2", "main", [9, 10], [9, 55], 60_000, 5_000, 0.15, 2, null),
      sess("b-3", "builder", [9, 12], [9, 40], 200_000, 15_000, 0.58, 0, "main-2"),
      sess("r-2", "reviewer", [9, 41], [9, 55], 90_000, 3_000, 0.2, 0, "main-2"),
    ],
    handoffs: [{ from_role: "builder", to_role: "reviewer", at: t(9, 40), kind: "handoff", evidence: "PR #3: dashboard skeleton" }],
    bounces: 0, wasted_tokens: 0,
  },
];
