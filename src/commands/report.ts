import type { Client } from "@libsql/client";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";

const TOOL: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex", cursor: "Cursor" };
export type LessonReport = {
  id: string; text: string; kind: string; repo: string | null; keptAt: string; route: string;
  sent: number; sentSessions: number; before: number; after: number; afterTools: string[]; verdict: string;
};
export type Report = { lessons: LessonReport[]; lastLearn: string; handoffs: { written: number; delivered: number } };

/**
 * Whether kept lessons worked. "Seen again" means the same moment (a repeat, a correction, a failure)
 * turned up in a session after the lesson was kept. Evidence is only updated when muninn learn runs.
 */
export async function reportData(db: Client, repo: string | null): Promise<Report> {
  const where = repo ? "AND (l.repo_id=? OR l.scope='global')" : "";
  const lessons = (await db.execute({ sql: `SELECT l.id,l.text,l.kind,l.repo_id,coalesce(l.reviewed_at,l.created_at) kept,l.always_on,(SELECT group_concat(pattern, ', ') FROM triggers t WHERE t.lesson_id=l.id) kw FROM lessons l WHERE l.status='live' ${where} ORDER BY kept DESC`, args: repo ? [repo] : [] })).rows;
  const toolsWithDelivery = new Set((await db.execute("SELECT DISTINCT tool FROM deliveries WHERE outcome='sent'")).rows.map((r) => String(r.tool)));
  const cursorOn = String((await db.execute("SELECT value FROM meta WHERE key='cursor_repos'")).rows[0]?.value ?? "[]");
  const out: LessonReport[] = [];
  for (const l of lessons) {
    const id = String(l.id); const kept = String(l.kept);
    const d = (await db.execute({ sql: "SELECT count(*) n, count(DISTINCT session) s FROM deliveries WHERE lesson_id=? AND outcome='sent'", args: [id] })).rows[0]!;
    const ev = (await db.execute({ sql: "SELECT count(DISTINCT CASE WHEN seen_at<? THEN session END) b, count(DISTINCT CASE WHEN seen_at>=? THEN session END) a, group_concat(DISTINCT CASE WHEN seen_at>=? THEN tool END) t FROM evidence WHERE lesson_id=?", args: [kept, kept, kept, id] })).rows[0]!;
    const afterTools = String(ev.t ?? "").split(",").filter(Boolean);
    const route = l.always_on ? "always-on" : l.kw ? `keyword: ${l.kw}` : "search only";
    const after = Number(ev.a), sent = Number(d.n);
    let verdict: string;
    if (after === 0) verdict = sent ? "Not seen again since you kept it." : route === "search only" ? "Not seen again. It isn't sent automatically, only found by search." : "Not seen again, and not sent yet.";
    else {
      const missing = afterTools.filter((t) => !toolsWithDelivery.has(t) && !(t === "cursor" && l.repo_id && cursorOn.includes(String(l.repo_id))));
      verdict = `Seen again in ${after} session(s) since you kept it (${afterTools.map((t) => TOOL[t] ?? t).join(", ")}).`;
      if (missing.length) verdict += ` ${missing.map((t) => TOOL[t] ?? t).join(" and ")} wasn't getting lessons.`;
      else if (route === "search only") verdict += " It isn't sent automatically. Consider always-on or a keyword.";
      else if (!sent) verdict += " It was never sent: check its keyword.";
      else verdict += " It was sent, so the wording may need to be clearer.";
    }
    out.push({ id, text: String(l.text), kind: String(l.kind ?? "rule"), repo: l.repo_id ? String(l.repo_id) : null, keptAt: kept, route, sent, sentSessions: Number(d.s), before: Number(ev.b), after, afterTools, verdict });
  }
  const lastLearn = String((await db.execute("SELECT value FROM meta WHERE key='last_learn'")).rows[0]?.value ?? "");
  const h = (await db.execute({ sql: `SELECT count(*) n, (SELECT count(*) FROM deliveries WHERE handoff_id IS NOT NULL) d FROM handoffs ${repo ? "WHERE repo_id=?" : ""}`, args: repo ? [repo] : [] })).rows[0]!;
  return { lessons: out, lastLearn, handoffs: { written: Number(h.n), delivered: Number(h.d) } };
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
  console.log(`"Seen again" is updated when muninn learn runs. Last run: ${r.lastLearn ? r.lastLearn.slice(0, 16).replace("T", " ") : "never"}.`);
}
