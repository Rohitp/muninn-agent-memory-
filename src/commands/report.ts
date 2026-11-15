import type { Client } from "@libsql/client";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";

const TOOL: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex", cursor: "Cursor" };
export type LessonReport = {
  id: string; text: string; kind: string; repo: string | null; keptAt: string; route: string;
  sent: number; sentSessions: number; before: number; after: number; afterTools: string[]; verdict: string;
  /** A one-click change that would likely have helped, if any. */
  fix: "always-on" | null;
};
export type Spend = { what: string; calls: number; tokens: number; costUsd: number | null };
export type Report = { lessons: LessonReport[]; lastLearn: string; handoffs: { written: number; delivered: number }; days: number; spend: Spend[]; delivered: { tokens: number; sessions: number } };

/**
 * Whether kept lessons worked. "Seen again" means the same moment (a repeat, a correction, a failure)
 * turned up in a session after the lesson was kept. Evidence is only updated when muninn learn runs.
 */
export async function reportData(db: Client, repo: string | null): Promise<Report> {
  const where = repo ? "AND (l.repo_id=? OR l.scope='global')" : "";
  const lessons = (await db.execute({ sql: `SELECT l.id,l.text,l.kind,l.repo_id,coalesce(l.reviewed_at,l.created_at) kept,l.always_on,(SELECT group_concat(pattern, ', ') FROM triggers t WHERE t.lesson_id=l.id) kw FROM lessons l WHERE l.status='live' ${where} ORDER BY kept DESC`, args: repo ? [repo] : [] })).rows;
  // A tool gets lessons if muninn's hook runs there, whether or not anything matched.
  const toolsWithDelivery = new Set((await db.execute("SELECT DISTINCT tool FROM deliveries WHERE outcome NOT IN ('unsupported_client')")).rows.map((r) => String(r.tool)));
  const cursorOn = String((await db.execute("SELECT value FROM meta WHERE key='cursor_repos'")).rows[0]?.value ?? "[]");
  const out: LessonReport[] = [];
  for (const l of lessons) {
    const id = String(l.id); const kept = String(l.kept);
    const d = (await db.execute({ sql: "SELECT count(*) n, count(DISTINCT session) s FROM deliveries WHERE lesson_id=? AND outcome='sent'", args: [id] })).rows[0]!;
    const ev = (await db.execute({ sql: "SELECT count(DISTINCT CASE WHEN seen_at<? THEN session END) b, count(DISTINCT CASE WHEN seen_at>=? THEN session END) a, group_concat(DISTINCT CASE WHEN seen_at>=? THEN tool END) t FROM evidence WHERE lesson_id=?", args: [kept, kept, kept, id] })).rows[0]!;
    const afterTools = String(ev.t ?? "").split(",").filter(Boolean);
    const route = l.always_on ? "always-on" : l.kw ? `keyword: ${l.kw}` : "search only";
    const after = Number(ev.a), sent = Number(d.n);
    // Sessions where the problem came back but this lesson was never sent, in tools that do get lessons.
    const missed = (await db.execute({ sql: "SELECT e.session, min(e.seen_at) at FROM evidence e WHERE e.lesson_id=? AND e.seen_at>=? AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.lesson_id=e.lesson_id AND d.session=e.session AND d.outcome='sent') GROUP BY e.session ORDER BY at", args: [id, kept] })).rows;
    const missedInDeliveredTools: string[] = [];
    for (const r of missed) {
      const tool = (await db.execute({ sql: "SELECT tool FROM evidence WHERE lesson_id=? AND session=? LIMIT 1", args: [id, String(r.session)] })).rows[0]?.tool;
      if (tool && toolsWithDelivery.has(String(tool))) missedInDeliveredTools.push(String(r.at).slice(0, 10));
    }
    let verdict: string; let fix: LessonReport["fix"] = null;
    if (after === 0) verdict = sent ? "Not seen again since you kept it." : route === "search only" ? "Not seen again. It isn't sent automatically, only found by search." : "Not seen again, and not sent yet.";
    else if (missedInDeliveredTools.length && !l.always_on) {
      const dates = [...new Set(missedInDeliveredTools)].map((d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })).join(", ");
      verdict = `Came back on ${dates} in a session where it wasn't sent: ${l.kw ? `its keyword "${l.kw}" didn't match what you typed` : "it isn't sent automatically"}. Make it always-on?`;
      fix = "always-on";
    } else {
      const missing = afterTools.filter((t) => !toolsWithDelivery.has(t) && !(t === "cursor" && l.repo_id && cursorOn.includes(String(l.repo_id))));
      verdict = `Seen again in ${after} session(s) since you kept it (${afterTools.map((t) => TOOL[t] ?? t).join(", ")}).`;
      if (missing.length) verdict += ` ${missing.map((t) => TOOL[t] ?? t).join(" and ")} wasn't getting lessons.`;
      else if (route === "search only") verdict += " It isn't sent automatically. Consider always-on or a keyword.";
      else if (!sent) verdict += " It was never sent: check its keyword.";
      else verdict += " It was sent, so the wording may need to be clearer.";
    }
    out.push({ id, text: String(l.text), kind: String(l.kind ?? "rule"), repo: l.repo_id ? String(l.repo_id) : null, keptAt: kept, route, sent, sentSessions: Number(d.s), before: Number(ev.b), after, afterTools, verdict, fix });
  }
  const lastLearn = String((await db.execute("SELECT value FROM meta WHERE key='last_learn'")).rows[0]?.value ?? "");
  const h = (await db.execute({ sql: `SELECT count(*) n, (SELECT count(*) FROM deliveries WHERE handoff_id IS NOT NULL) d FROM handoffs ${repo ? "WHERE repo_id=?" : ""}`, args: repo ? [repo] : [] })).rows[0]!;
  // What muninn itself cost over the last 30 days, and what it added to agents' context. All repos, since calls aren't per repo.
  const days = 30; const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const spend = (await db.execute({ sql: "SELECT what, count(*) calls, sum(input_tokens+output_tokens+cache_read+cache_write) tokens, sum(cost_usd) cost, count(cost_usd) priced FROM llm_calls WHERE ts>=? GROUP BY what ORDER BY tokens DESC", args: [since] })).rows
    .map((r) => ({ what: String(r.what), calls: Number(r.calls), tokens: Number(r.tokens ?? 0), costUsd: Number(r.priced) ? Number(r.cost) : null }));
  const dl = (await db.execute({ sql: "SELECT coalesce(sum(tokens),0) t, count(DISTINCT session) s FROM deliveries WHERE outcome='sent' AND ts>=?", args: [since] })).rows[0]!;
  return { lessons: out, lastLearn, handoffs: { written: Number(h.n), delivered: Number(h.d) }, days, spend, delivered: { tokens: Number(dl.t), sessions: Number(dl.s) } };
}

export async function report(args: string[]) {
  const db = await openDb();
  const repo = args.includes("--all") ? null : repoIdentity(process.cwd());
  const r = await reportData(db, repo);
  if (!r.lessons.length) { console.log("No kept lessons yet."); return; }
  for (const l of r.lessons) {
    console.log(`\n${l.id.slice(0, 8)}  ${l.kind === "note" ? "[note] " : ""}${l.text.length > 110 ? l.text.slice(0, 109) + "…" : l.text}`);
    console.log(`  Kept ${l.keptAt.slice(0, 10)}, ${l.route}. Sent ${l.sent} time(s) in ${l.sentSessions} session(s). Seen in ${l.before} session(s) before you kept it.`);
    console.log(`  ${l.verdict}`);
  }
  console.log(`\nHandoffs: ${r.handoffs.written} written, ${r.handoffs.delivered} delivered.`);
  console.log(`\nLast ${r.days} days, all repos:`);
  console.log(`  Added to agents' context: about ${r.delivered.tokens.toLocaleString()} tokens across ${r.delivered.sessions} session(s).`);
  if (!r.spend.length) console.log("  muninn's own AI calls: none recorded yet.");
  for (const x of r.spend) console.log(`  ${x.what}: ${x.calls} call(s), ${x.tokens.toLocaleString()} tokens${x.costUsd != null ? `, about $${x.costUsd.toFixed(2)} at list price` : ""}`);
  console.log(`  Kept lessons whose problem came back after keeping: ${r.lessons.filter((l) => l.after > 0).length} of ${r.lessons.length}.`);
  console.log(`"Seen again" is updated when muninn learn runs. Last run: ${r.lastLearn ? r.lastLearn.slice(0, 16).replace("T", " ") : "never"}.`);
}
