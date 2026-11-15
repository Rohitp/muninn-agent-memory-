import type { Client } from "@libsql/client";
import { syncCursor } from "../deliver/cursor.js";
import { age, currentBranch, latestHandoff } from "../handoff/handoff.js";
import { settings } from "../config.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";
import { decide, getLesson } from "../store/lessons.js";
import { shortRepo } from "./ask.js";
import { defaultRoute } from "./review.js";

export type PanelData = {
  repo: string | null; repoShort: string; branch: string | null;
  sent: { id: string; text: string; plain: string | null; why: string; at: string }[];
  handoff: { text: string; age: string; tool: string; delivered: boolean } | null;
  waiting: { count: number; top: { id: string; text: string; kind: string; route: string }[] };
  week: { sent: number; sessions: number; kept: number; cameBack: number; muninnCostUsd: number | null; muninnCalls: number };
};

/** Why a lesson was sent, in words, from the delivery row. */
export function whySent(event: string, source: string | null, keyword: string | null): string {
  if (event === "SessionStart") return source === "compact" ? "always-on, sent again after compaction" : "always-on, at session start";
  if (event === "SubagentStart") return "always-on, for a subagent";
  if (event === "UserPromptSubmit") return keyword ? `your prompt said "${keyword}"` : "matched your prompt";
  if (event === "PostToolUseFailure" || event === "PostToolUse") return keyword ? `a failed command matched "${keyword}"` : "after a failed command";
  return event;
}

/** Everything the Claude Code panel shows, for one session and folder. */
export async function panelData(db: Client, session: string | null, cwd: string): Promise<PanelData> {
  const repo = repoIdentity(cwd);
  const branch = currentBranch(cwd);
  const rows = session ? (await db.execute({ sql: "SELECT d.lesson_id, d.event, d.source, d.trigger_id, max(d.ts) at, l.text, l.plain FROM deliveries d JOIN lessons l ON l.id=d.lesson_id WHERE d.session=? AND d.outcome='sent' GROUP BY d.lesson_id ORDER BY at DESC", args: [session] })).rows : [];
  const sent = rows.map((r) => ({ id: String(r.lesson_id), text: String(r.text), plain: r.plain ? String(r.plain) : null, why: whySent(String(r.event), r.source ? String(r.source) : null, r.trigger_id ? String(r.trigger_id) : null), at: String(r.at) }));
  let handoff: PanelData["handoff"] = null;
  const given = session ? (await db.execute({ sql: "SELECT h.text, h.created_at, h.tool FROM deliveries d JOIN handoffs h ON h.id=d.handoff_id WHERE d.session=? ORDER BY d.ts DESC LIMIT 1", args: [session] })).rows[0] : undefined;
  if (given) handoff = { text: String(given.text), age: age(String(given.created_at)), tool: String(given.tool), delivered: true };
  else if (repo && branch) {
    const h = await latestHandoff(db, repo, branch, settings().handoffDays, session);
    if (h) handoff = { text: h.text, age: age(h.created_at), tool: h.tool, delivered: false };
  }
  const waitingRows = (await db.execute({ sql: "SELECT id,text,plain,kind,signal,suggested_keywords,suggested_scope FROM lessons WHERE status='proposed' AND (repo_id IS ? OR repo_id=?) ORDER BY sessions DESC, last_seen DESC", args: [repo, repo] })).rows;
  const top = waitingRows.slice(0, 3).map((r) => {
    const d = defaultRoute({ text: String(r.text), kind: String(r.kind ?? "rule"), signal: r.signal ? String(r.signal) : null, suggested_keywords: r.suggested_keywords ? String(r.suggested_keywords) : null, suggested_scope: r.suggested_scope ? String(r.suggested_scope) : null });
    return { id: String(r.id), text: String(r.plain ?? r.text), kind: String(r.kind ?? "rule"), route: d.route === "always" ? `always-on${d.global ? ", any repo" : ""}` : d.route === "keyword" ? `keyword: ${d.keywords.join(", ")}` : "search only" };
  });
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const w = (await db.execute({ sql: "SELECT count(*) n, count(DISTINCT session) s FROM deliveries WHERE outcome='sent' AND lesson_id IS NOT NULL AND ts>=?", args: [since] })).rows[0]!;
  const kept = Number((await db.execute({ sql: "SELECT count(*) n FROM lessons WHERE status='live' AND reviewed_at>=?", args: [since] })).rows[0]?.n ?? 0);
  const back = Number((await db.execute({ sql: "SELECT count(DISTINCT e.lesson_id) n FROM evidence e JOIN lessons l ON l.id=e.lesson_id WHERE l.status='live' AND e.seen_at>=? AND e.seen_at>=coalesce(l.reviewed_at,l.created_at)", args: [since] })).rows[0]?.n ?? 0);
  const c = (await db.execute({ sql: "SELECT count(*) n, sum(cost_usd) cost, count(cost_usd) priced FROM llm_calls WHERE ts>=?", args: [since] })).rows[0]!;
  return {
    repo, repoShort: shortRepo(repo), branch, sent, handoff,
    waiting: { count: waitingRows.length, top },
    week: { sent: Number(w.n), sessions: Number(w.s), kept, cameBack: back, muninnCostUsd: Number(c.priced) ? Number(c.cost) : null, muninnCalls: Number(c.n) },
  };
}

export async function panel(args: string[]) {
  const at = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] ?? null : null; };
  const db = await openDb();
  const data = await panelData(db, at("--session"), at("--cwd") ?? process.cwd());
  console.log(JSON.stringify(data));
}

/** One-click keep from the panel: muninn's defaults for delivery and scope. */
export async function keepWithDefaults(args: string[]) {
  const db = await openDb();
  const l = args[0] ? await getLesson(db, args[0]) : null;
  if (!l || l.status !== "proposed") { console.error("No waiting lesson with that id."); process.exitCode = 1; return; }
  const d = defaultRoute(l);
  await decide(db, l.id, { status: "live", alwaysOn: d.route === "always", triggers: d.route === "keyword" ? d.keywords : [], ...(d.global ? { global: true } : {}) });
  await syncCursor(db);
  console.log(`Kept ${l.id.slice(0, 8)}: ${d.route === "always" ? "always-on" : d.route === "keyword" ? `keyword ${d.keywords.join(", ")}` : "search only"}${d.global ? ", any repo" : ""}.`);
}
export async function reject(args: string[]) {
  const db = await openDb();
  const l = args[0] ? await getLesson(db, args[0]) : null;
  if (!l || l.status !== "proposed") { console.error("No waiting lesson with that id."); process.exitCode = 1; return; }
  await decide(db, l.id, { status: "rejected" });
  console.log(`Rejected ${l.id.slice(0, 8)}. muninn won't propose it again.`);
}
