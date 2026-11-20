import type { Client } from "@libsql/client";
import { effortMoments } from "../learn/signals.js";
import { scanLogs } from "../logs/discover.js";
import type { Session } from "../logs/types.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";
import { reportData } from "./report.js";

const TOOL: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex", cursor: "Cursor" };
const KIND: Record<string, string> = {
  loop: "the same command failing again and again", failure_then_fix: "commands that failed before they worked", mistake_returned: "a failure that keeps coming back",
  refetch: "re-running commands to see more output", stopped: "commands you stopped", wrong_path: "looking for files in the wrong place", big_file: "files too big to read in one go",
};
export type Insights = {
  days: number; repo: string | null;
  sessions: { total: number; byTool: Record<string, number>; byRepo: Record<string, number> };
  effort: { wastedTokens: number; byKind: { kind: string; label: string; tokens: number; count: number }[]; top: { text: string; tokens: number }[]; stopped: number; interrupted: number };
  lessons: { told: number; toldSessions: number; kept: number; working: number; cameBack: { text: string; verdict: string }[] };
  skills: { name: string; uses: number }[];
  waiting: { suggestions: number; changes: number };
  spend: { calls: number; costUsd: number };
};

const lastTs = (s: Session) => s.events.reduce((m, e) => (e.ts > m ? e.ts : m), "");

/** One week (or `days`) of coding-agent sessions: how much was done, what wasted effort, and whether lessons helped. */
export async function insightsData(db: Client, repo: string | null, days = 7, sessions?: Session[]): Promise<Insights> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const all = sessions ?? scanLogs().sessions;
  const here = all.filter((s) => lastTs(s) >= since && (!repo || (s.cwd && repoIdentity(s.cwd) === repo)));
  const byTool: Record<string, number> = {}, byRepo: Record<string, number> = {};
  for (const s of here) { byTool[s.tool] = (byTool[s.tool] ?? 0) + 1; const r = (s.cwd && repoIdentity(s.cwd)) || "?"; byRepo[r] = (byRepo[r] ?? 0) + 1; }

  // Effort only from this window: moments whose last sighting falls inside it.
  const moments = effortMoments(here).filter((m) => m.last >= since);
  const byKind = new Map<string, { tokens: number; count: number }>();
  for (const m of moments) { const k = byKind.get(m.signal) ?? { tokens: 0, count: 0 }; k.tokens += m.wasted ?? 0; k.count++; byKind.set(m.signal, k); }
  const interrupted = here.reduce((n, s) => n + s.events.filter((e) => e.k === "interrupt" && e.ts >= since).length, 0);
  const stopped = here.reduce((n, s) => n + s.events.filter((e) => e.k === "cmd" && e.stopped && e.ts >= since).length, 0);

  const scope = repo ? "AND (l.repo_id=? OR l.scope='global')" : "";
  const d = (await db.execute({ sql: `SELECT count(*) n, count(DISTINCT d.session) s FROM deliveries d JOIN lessons l ON l.id=d.lesson_id WHERE d.outcome='sent' AND d.ts>=? ${scope}`, args: repo ? [since, repo] : [since] })).rows[0]!;
  const report = await reportData(db, repo);
  const skillsApplied = (await db.execute({ sql: "SELECT payload FROM proposals WHERE kind='skill' AND status='applied'" + (repo ? " AND repo_id=?" : ""), args: repo ? [repo] : [] })).rows.map((r) => String(JSON.parse(String(r.payload)).name));
  const skills = skillsApplied.map((name) => ({ name, uses: here.reduce((n, s) => n + s.events.filter((e) => e.k === "file" && e.tool === "skill" && e.path === name && e.ts >= since).length, 0) }));
  const waitingSug = Number((await db.execute({ sql: `SELECT count(*) n FROM lessons l WHERE l.status='proposed' ${repo ? "AND l.repo_id=?" : ""}`, args: repo ? [repo] : [] })).rows[0]?.n ?? 0);
  const waitingCh = Number((await db.execute({ sql: `SELECT count(*) n FROM proposals WHERE status='proposed' ${repo ? "AND (repo_id=? OR repo_id IS NULL)" : ""}`, args: repo ? [repo] : [] })).rows[0]?.n ?? 0);
  const spend = (await db.execute({ sql: "SELECT count(*) n, coalesce(sum(cost_usd),0) c FROM llm_calls WHERE ts>=?", args: [since] })).rows[0]!;

  return {
    days, repo,
    sessions: { total: here.length, byTool, byRepo },
    effort: {
      wastedTokens: moments.reduce((a, m) => a + (m.wasted ?? 0), 0),
      byKind: [...byKind.entries()].map(([kind, v]) => ({ kind, label: KIND[kind] ?? kind, ...v })).sort((a, b) => b.tokens - a.tokens || b.count - a.count),
      top: moments.filter((m) => (m.wasted ?? 0) > 0).sort((a, b) => (b.wasted ?? 0) - (a.wasted ?? 0)).slice(0, 3).map((m) => ({ text: m.text, tokens: m.wasted ?? 0 })),
      stopped, interrupted,
    },
    lessons: {
      told: Number(d.n ?? 0), toldSessions: Number(d.s ?? 0), kept: report.lessons.length,
      working: report.lessons.filter((l) => l.after === 0 && l.sent > 0).length,
      cameBack: report.lessons.filter((l) => l.after > 0).slice(0, 3).map((l) => ({ text: l.text, verdict: l.verdict })),
    },
    skills, waiting: { suggestions: waitingSug, changes: waitingCh },
    spend: { calls: Number(spend.n ?? 0), costUsd: Number(spend.c ?? 0) },
  };
}

const k = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
export function insightsText(i: Insights): string {
  const out: string[] = [];
  const where = i.repo ? i.repo.split("/").pop() : "all repos";
  out.push(`Your last ${i.days} days with coding agents (${where})`, "");
  if (!i.sessions.total) return `${out.join("\n")}No sessions in this time.`;
  out.push(`Sessions: ${i.sessions.total} (${Object.entries(i.sessions.byTool).map(([t, n]) => `${TOOL[t] ?? t} ${n}`).join(", ")})${i.repo ? "" : `, in ${Object.keys(i.sessions.byRepo).length} repo(s)`}.`);
  out.push("", "Where effort went to waste");
  if (!i.effort.byKind.length) out.push("  Nothing stood out: no loops, repeated failures or wrong paths.");
  for (const b of i.effort.byKind.slice(0, 5)) out.push(`  ${b.count} × ${b.label}${b.tokens ? `, about ${k(b.tokens)} tokens` : ""}`);
  for (const t of i.effort.top) out.push(`  Costliest: ${t.text.length > 110 ? t.text.slice(0, 109) + "…" : t.text} (about ${k(t.tokens)} tokens)`);
  if (i.effort.interrupted) out.push(`  You stopped an answer ${i.effort.interrupted} time(s) while it was being written.`);
  out.push("", "Lessons");
  out.push(`  Told ${i.lessons.told} time(s) in ${i.lessons.toldSessions} session(s). Of ${i.lessons.kept} kept, ${i.lessons.working} were told and haven't come back.`);
  for (const c of i.lessons.cameBack) out.push(`  Came back: "${c.text.slice(0, 90)}${c.text.length > 90 ? "…" : ""}". ${c.verdict}`);
  if (i.skills.length) { out.push("", "Skills you applied"); for (const s of i.skills) out.push(`  ${s.name}: used ${s.uses} time(s)`); }
  if (i.waiting.suggestions || i.waiting.changes) out.push("", `Waiting for you: ${[i.waiting.suggestions ? `${i.waiting.suggestions} suggested lesson(s)` : "", i.waiting.changes ? `${i.waiting.changes} proposed change(s)` : ""].filter(Boolean).join(" and ")}. Open muninn ui.`);
  out.push("", `muninn's own AI calls: ${i.spend.calls}${i.spend.costUsd ? `, about $${i.spend.costUsd.toFixed(2)}` : ""}.`);
  return out.join("\n");
}

/** muninn insights [--days 7] [--all-repos] */
export async function insights(args: string[]) {
  const at = args.indexOf("--days");
  const days = at >= 0 ? Math.max(1, Number(args[at + 1]) || 7) : 7;
  const repo = args.includes("--all-repos") ? null : repoIdentity(process.cwd());
  console.log(insightsText(await insightsData(await openDb(), repo, days)));
}
