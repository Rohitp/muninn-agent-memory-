import type { Client } from "@libsql/client";
import { getDial, type Dial } from "../store/dial.js";
import { shortRepo } from "./ask.js";
import { whySent } from "./panel.js";
import { reportData } from "./report.js";
import { defaultRoute } from "./review.js";

export type ReceiptLine = { at: string; tool: string; kind: "lesson" | "handoff"; id: string; text: string; why: string; session: string | null };
export type Carried = { id: string; label: string; route: string; state: "lit" | "armed" | "fading"; lastTold: string | null; global: boolean };
export type HomeData = {
  repo: string | null; repoShort: string; dial: Dial;
  stats: { told: number; sessions: number; cameBack: number; costUsd: number | null };
  /** The week as answers to "is muninn helping?", for plain sentences rather than raw counters. */
  week: {
    sessions: number;
    mostTold: { label: string; sessions: number } | null;
    problems: { kept: number; cameBack: number };
    handoffs: number;
    costUsd: number | null;
  };
  lastToldAt: string | null;
  receipt: ReceiptLine[];
  waiting: { count: number; top: { id: string; text: string; plain: string | null; origin: string; route: string }[] };
  cameBack: { id: string; text: string; verdict: string; fix: string | null }[];
  carry: Carried[];
};

const FADE_DAYS = 14;
/** A short name for a lesson: its plain line or text, up to the first sentence or 60 characters. */
export const label = (s: string) => {
  const first = (s.split(/(?<=[.!?])\s/)[0] ?? s).replace(/\.$/, "");
  if (first.length <= 60) return first;
  const cut = first.slice(0, 60);
  // Cut at a word, never mid-word.
  return cut.slice(0, cut.lastIndexOf(" ") > 30 ? cut.lastIndexOf(" ") : 59).replace(/[\s,;:]+$/, "") + "…";
};

/** Everything the Home screen and the Claude Code panel show. With a session, the receipt is that session's; otherwise the last day's in this repo. */
export async function homeData(db: Client, repo: string | null, session?: string | null): Promise<HomeData> {
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const since1 = new Date(Date.now() - 86_400_000).toISOString();
  const inRepo = repo ? "(l.repo_id=? OR l.scope='global')" : "1=1";
  const rargs = repo ? [repo] : [];

  const lessonRows = (await db.execute({ sql: `SELECT d.ts, d.tool, d.session, d.event, d.source, d.trigger_id, l.id, l.text, l.plain FROM deliveries d JOIN lessons l ON l.id=d.lesson_id WHERE d.outcome='sent' AND ${session ? "d.session=?" : `d.ts>=? AND ${inRepo}`} ORDER BY d.ts DESC LIMIT 12`, args: session ? [session] : [since1, ...rargs] })).rows;
  const handoffRows = (await db.execute({ sql: `SELECT d.ts, d.tool, d.session, h.id, h.text, h.branch FROM deliveries d JOIN handoffs h ON h.id=d.handoff_id WHERE ${session ? "d.session=?" : `d.ts>=? ${repo ? "AND h.repo_id=?" : ""}`} ORDER BY d.ts DESC LIMIT 4`, args: session ? [session] : [since1, ...rargs] })).rows;
  const receipt: ReceiptLine[] = [
    ...lessonRows.map((r) => ({ at: String(r.ts), tool: String(r.tool), kind: "lesson" as const, id: String(r.id), text: String(r.plain ?? r.text), why: whySent(String(r.event), r.source ? String(r.source) : null, r.trigger_id ? String(r.trigger_id) : null), session: r.session ? String(r.session) : null })),
    ...handoffRows.map((r) => ({ at: String(r.ts), tool: String(r.tool), kind: "handoff" as const, id: String(r.id), text: `Where you left off: ${String(r.text).split("\n").find((x) => /^(Done|Next|Open):/.test(x))?.replace(/^\w+:\s*/, "") ?? String(r.text).split("\n")[0]}`, why: `you came back to ${r.branch}`, session: r.session ? String(r.session) : null })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  // One line per lesson: the newest time it was told.
  const seen = new Set<string>();
  const receiptOnce = receipt.filter((x) => (seen.has(x.kind + x.id) ? false : (seen.add(x.kind + x.id), true)));

  const w = (await db.execute({ sql: "SELECT count(*) n, count(DISTINCT session) s, max(ts) last FROM deliveries WHERE outcome='sent' AND ts>=?", args: [since7] })).rows[0]!;
  const c = (await db.execute({ sql: "SELECT sum(cost_usd) cost, count(cost_usd) priced FROM llm_calls WHERE ts>=?", args: [since7] })).rows[0]!;
  const report = await reportData(db, repo);
  const cameBack = report.lessons.filter((l) => l.after > 0).map((l) => ({ id: l.id, text: label(l.text), verdict: l.verdict, fix: l.fix }));

  const waitingRows = (await db.execute({ sql: `SELECT id,text,plain,kind,signal,source,suggested_keywords,suggested_scope FROM lessons l WHERE status='proposed' ${repo ? "AND repo_id=?" : ""} ORDER BY sessions DESC, last_seen DESC`, args: rargs })).rows;
  const { originOf } = await import("./ask.js");
  const top = [];
  for (const r of waitingRows.slice(0, 3)) {
    const d = defaultRoute({ text: String(r.text), kind: String(r.kind ?? "rule"), signal: r.signal ? String(r.signal) : null, suggested_keywords: r.suggested_keywords ? String(r.suggested_keywords) : null, suggested_scope: r.suggested_scope ? String(r.suggested_scope) : null });
    top.push({ id: String(r.id), text: String(r.text), plain: r.plain ? String(r.plain) : null, origin: await originOf(db, { id: String(r.id), source: String(r.source), signal: r.signal ? String(r.signal) : null }), route: d.route === "always" ? `every session${d.global ? ", every repo" : ", this repo"}` : d.route === "keyword" ? `when "${d.keywords.join('", "')}" comes up` : "only when searched" });
  }

  const carryRows = (await db.execute({ sql: `SELECT l.id, l.text, l.plain, l.always_on, l.scope, coalesce(l.reviewed_at,l.created_at) kept, (SELECT group_concat(pattern, '", "') FROM triggers t WHERE t.lesson_id=l.id) kw, (SELECT max(ts) FROM deliveries d WHERE d.lesson_id=l.id AND d.outcome='sent') last FROM lessons l WHERE l.status='live' AND ${inRepo} ORDER BY l.always_on DESC, last DESC`, args: rargs })).rows;
  const fadeBefore = new Date(Date.now() - FADE_DAYS * 86_400_000).toISOString();
  const carry: Carried[] = carryRows.map((r) => {
    const last = r.last ? String(r.last) : null;
    const fading = (last ?? String(r.kept)) < fadeBefore;
    return { id: String(r.id), label: label(String(r.plain ?? r.text)), route: r.always_on ? "every session" : r.kw ? `when "${r.kw}" comes up` : "only when searched", state: fading ? "fading" : r.always_on ? "lit" : "armed", lastTold: last, global: r.scope === "global" };
  });

  const most = (await db.execute({ sql: `SELECT l.text, l.plain, count(DISTINCT d.session) s FROM deliveries d JOIN lessons l ON l.id=d.lesson_id WHERE d.outcome='sent' AND d.ts>=? AND ${inRepo} GROUP BY l.id ORDER BY s DESC LIMIT 1`, args: [since7, ...rargs] })).rows[0];
  const lessonSessions = Number((await db.execute({ sql: `SELECT count(DISTINCT d.session) s FROM deliveries d JOIN lessons l ON l.id=d.lesson_id WHERE d.outcome='sent' AND d.ts>=? AND ${inRepo}`, args: [since7, ...rargs] })).rows[0]?.s ?? 0);
  const handoffs = Number((await db.execute({ sql: `SELECT count(*) n FROM deliveries d JOIN handoffs h ON h.id=d.handoff_id WHERE d.outcome='sent' AND d.ts>=? ${repo ? "AND h.repo_id=?" : ""}`, args: [since7, ...rargs] })).rows[0]?.n ?? 0);
  // "Problems you kept a lesson for": kept lessons that came from something going wrong before (evidence before keeping).
  const withProblem = report.lessons.filter((l) => l.before > 0);

  return {
    week: {
      sessions: lessonSessions,
      mostTold: most ? { label: label(String(most.plain ?? most.text)), sessions: Number(most.s) } : null,
      problems: { kept: withProblem.length, cameBack: withProblem.filter((l) => l.after > 0).length },
      handoffs,
      costUsd: Number(c.priced) ? Number(c.cost) : null,
    },
    repo, repoShort: shortRepo(repo), dial: await getDial(db, repo),
    stats: { told: Number(w.n), sessions: Number(w.s), cameBack: cameBack.length, costUsd: Number(c.priced) ? Number(c.cost) : null },
    lastToldAt: w.last ? String(w.last) : null,
    receipt: receiptOnce,
    waiting: { count: waitingRows.length, top },
    cameBack, carry,
  };
}
