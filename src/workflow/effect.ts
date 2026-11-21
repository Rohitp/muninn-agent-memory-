import type { Client } from "@libsql/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listRuns, REVIEWER, type Run } from "./runs.js";

/**
 * Did a role's lesson work? Compares the runs before the lesson went live with the runs since, for that role:
 *   a role that does the work (a builder): fixes it made later, plus work sent back to it, per run it was in;
 *   a role that checks work (a reviewer, checker, qa): fixes still needed after it approved, per approval.
 * Also says whether the role was told: a Claude Code subagent when muninn's hook sent it, an Antigravity agent
 * when the lesson is in its worktree's rules file.
 */
export type RoleEffect = {
  id: string; text: string; role: string; repo: string; keptAt: string; measure: string;
  before: { runs: number; problems: number; per: number; rate: number | null };
  after: { runs: number; problems: number; per: number; rate: number | null };
  told: { subagent: number; rulesFile: boolean };
  verdict: "no_runs_yet" | "not_told" | "working" | "not_working" | "too_early";
  summary: string;
};

const isGate = (role: string) => REVIEWER.test(role);
/** Problems and the count they're measured per, for one role in one run. */
function measure(r: Run, role: string): { problems: number; per: number } | null {
  if (!r.sessions.some((s) => s.role === role)) return null;
  if (isGate(role)) {
    const approvals = r.handoffs.filter((h) => h.kind === "approved" && h.from_role === role).length;
    if (!approvals) return null;
    return { problems: r.handoffs.filter((h) => h.kind === "rework").length, per: approvals };
  }
  const fixed = r.handoffs.filter((h) => h.kind === "rework" && h.from_role === role).length;
  const back = r.handoffs.filter((h) => h.kind === "review_rejected" && h.to_role.split(", ").includes(role)).length;
  return { problems: fixed + back, per: 1 };
}
const sum = (runs: Run[], role: string) => {
  const m = runs.map((r) => measure(r, role)).filter((x): x is { problems: number; per: number } => !!x);
  const problems = m.reduce((n, x) => n + x.problems, 0), per = m.reduce((n, x) => n + x.per, 0);
  return { runs: m.length, problems, per, rate: per ? problems / per : null };
};
const fmt = (n: number | null) => (n === null ? "–" : n % 1 === 0 ? String(n) : n.toFixed(2));

/** Whether a role's worktree rules file holds the lesson (Antigravity and Cursor agents read these). */
async function inRulesFile(db: Client, repo: string, role: string, text: string): Promise<boolean> {
  const row = (await db.execute({ sql: "SELECT paths FROM repos WHERE id=?", args: [repo] })).rows[0];
  const root = row ? (JSON.parse(String(row.paths)) as string[])[0] : null;
  if (!root) return false;
  const needle = text.slice(0, 60);
  for (const dir of [join(root, ".worktrees", role), join(root, ".claude", "worktrees", role), join(root, "worktrees", role)])
    for (const f of [join(dir, ".agents", "rules", "muninn.md"), join(dir, ".cursor", "rules", "muninn.mdc")])
      if (existsSync(f) && readFileSync(f, "utf8").includes(needle)) return true;
  return false;
}

export async function roleEffects(db: Client, repo: string | null): Promise<RoleEffect[]> {
  const lessons = (await db.execute({ sql: `SELECT id, text, role, repo_id, coalesce(reviewed_at, created_at) kept FROM lessons WHERE status='live' AND off=0 AND role IS NOT NULL AND repo_id IS NOT NULL ${repo ? "AND repo_id=?" : ""} ORDER BY kept DESC`, args: repo ? [repo] : [] })).rows;
  const out: RoleEffect[] = [];
  const runsByRepo = new Map<string, Run[]>();
  for (const l of lessons) {
    const r = String(l.repo_id), role = String(l.role), kept = String(l.kept), id = String(l.id), text = String(l.text);
    if (!runsByRepo.has(r)) runsByRepo.set(r, await listRuns(db, { repo: r, limit: 500 }));
    const runs = runsByRepo.get(r)!;
    // A run that started before the lesson went live didn't have it.
    const before = sum(runs.filter((x) => x.started_at < kept), role), after = sum(runs.filter((x) => x.started_at >= kept), role);
    const subagent = Number((await db.execute({ sql: "SELECT count(DISTINCT session) n FROM deliveries WHERE lesson_id=? AND outcome='sent' AND ts>=?", args: [id, kept] })).rows[0]?.n ?? 0);
    const rulesFile = await inRulesFile(db, r, role, text);
    const unit = isGate(role) ? "approval" : "run";
    const measureText = isGate(role) ? `fixes still needed after the ${role} approved, per approval` : `fixes the ${role} made later or work sent back to it, per run`;
    let verdict: RoleEffect["verdict"]; let summary: string;
    const was = `${fmt(before.rate)} per ${unit} in ${before.runs} run(s) before`;
    if (!after.runs) { verdict = "no_runs_yet"; summary = `No runs with the ${role} since you kept it, so nothing to compare yet. Before: ${was.replace(/ before$/, "")}.`; }
    else if (!subagent && !rulesFile) { verdict = "not_told"; summary = `The ${role} hasn't been told: no ${role} subagent got it from muninn's hook, and it isn't in the ${role} worktree's rules file. Turn on rules for this repo, or check the worktree is named "${role}".`; }
    else if (before.rate !== null && after.rate !== null && after.rate < before.rate) {
      verdict = after.runs < 2 ? "too_early" : "working";
      summary = `${verdict === "working" ? "Working" : "Looks better, but only 1 run so far"}: ${measureText} went from ${was} to ${fmt(after.rate)} in ${after.runs} run(s) since.`;
    } else {
      verdict = after.runs < 2 ? "too_early" : "not_working";
      summary = `${verdict === "not_working" ? "Not working yet" : "Only 1 run so far"}: ${measureText} was ${was}, and ${fmt(after.rate)} since${verdict === "not_working" ? ". It was told, so the wording may need to be more specific" : ""}.`;
    }
    out.push({ id, text, role, repo: r, keptAt: kept, measure: measureText, before, after, told: { subagent, rulesFile }, verdict, summary });
  }
  return out;
}
