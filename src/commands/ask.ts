import type { Client } from "@libsql/client";
import { cosine, loadEmbedder, modelCached, type Embed } from "../embed/model.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";

export type AskHit = {
  id: string; repo_id: string | null; scope: string; kind: string; status: string; text: string; plain: string | null;
  updated_at: string; where: string; origin: string; matched: string | null;
};
const STOP = new Set(["the", "and", "for", "with", "how", "what", "where", "when", "why", "who", "which", "does", "this", "that", "are", "was", "can", "should", "would", "could", "there", "here", "from", "into", "about", "run", "use", "did", "our", "you", "your"]);
export const shortRepo = (r: string | null) => (r ? r.split("/").filter(Boolean).at(-1) ?? r : "global");
const TOOL: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex", cursor: "Cursor" };
const SIGNAL: Record<string, string> = {
  repeat: "You asked for this in several sessions",
  correction: "You corrected an agent about this",
  failure_then_fix: "Learned from a command that failed and was then fixed",
  mistake_returned: "Learned from a failing command that kept coming back",
  explained: "From something you explained",
  loop: "Learned from a command that failed the same way several times in a row",
  refetch: "Learned from a command re-run with different limits",
  stopped: "Learned from a command you stopped",
  confused: "Learned from times you asked what something meant",
  friction: "Learned from times something didn't work as you expected",
  wrong_path: "Learned from paths agents looked for in the wrong place",
  big_file: "Learned from a file too big to read in one go",
  skimmed: "Learned from long answers you skimmed or stopped",
};
/** Where a lesson came from, in words: "Learned from a command that failed and was then fixed, in Claude Code, Nov 6". */
export async function originOf(db: Client, l: { id: string; source: string; signal: string | null; created_at?: string }): Promise<string> {
  if (l.source === "manual") return "You added this";
  const e = (await db.execute({ sql: "SELECT tool, seen_at FROM evidence WHERE lesson_id=? ORDER BY seen_at LIMIT 1", args: [l.id] })).rows[0];
  const base = SIGNAL[l.signal ?? ""] ?? "Found in your sessions";
  if (!e) return base;
  const d = new Date(String(e.seen_at));
  const when = Number.isNaN(d.getTime()) ? "" : `, ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  return `${base}, in ${TOOL[String(e.tool)] ?? e.tool}${when}`;
}

/**
 * Searches lessons in every repo, with this repo first. Matches words in the lesson, its plain line and
 * its questions, and meaning against the lesson and the questions it answers. Results merged by rank.
 * Agents (muninn ask) only ever see kept items. The UI can include waiting ones, marked.
 */
export async function askData(db: Client, q: string, here: string | null, opts: { includeWaiting?: boolean; embed?: Embed } = {}): Promise<AskHit[]> {
  const statuses = opts.includeWaiting ? "('live','proposed')" : "('live')";
  const ranks = new Map<string, number>(); const matched = new Map<string, string>();
  const add = (ids: string[]) => ids.forEach((id, i) => ranks.set(id, (ranks.get(id) ?? 0) + 1 / (60 + i)));
  const words = (q.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? []).filter((w) => !STOP.has(w));
  if (words.length) {
    const fts = words.map((w) => `"${w}"`).join(" OR ");
    add((await db.execute({ sql: `SELECT f.lesson_id id FROM lessons_fts f JOIN lessons l ON l.id=f.lesson_id WHERE lessons_fts MATCH ? AND l.status IN ${statuses} ORDER BY rank LIMIT 20`, args: [fts] })).rows.map((r) => String(r.id)));
  }
  const embed = opts.embed ?? (modelCached() ? await loadEmbedder() : null);
  if (embed) {
    const v = (await embed([q])).get(q)!;
    const rows = (await db.execute(`SELECT id, vector_extract(embedding) e FROM lessons WHERE status IN ${statuses} AND embedding IS NOT NULL`)).rows;
    add(rows.map((r) => ({ id: String(r.id), s: cosine(v, Float32Array.from(JSON.parse(String(r.e)))) })).filter((x) => x.s > 0.65).sort((a, b) => b.s - a.s).slice(0, 20).map((x) => x.id));
    // Question to question is the closer match, so it counts on its own.
    const qs = (await db.execute(`SELECT q.lesson_id id, q.question, vector_extract(q.embedding) e FROM lesson_questions q JOIN lessons l ON l.id=q.lesson_id WHERE l.status IN ${statuses} AND q.embedding IS NOT NULL`)).rows;
    const best = new Map<string, { s: number; q: string }>();
    for (const r of qs) {
      const s = cosine(v, Float32Array.from(JSON.parse(String(r.e))));
      const id = String(r.id);
      if (s > 0.7 && s > (best.get(id)?.s ?? 0)) best.set(id, { s, q: String(r.question) });
    }
    const sorted = [...best.entries()].sort((a, b) => b[1].s - a[1].s).slice(0, 20);
    for (const [id, b] of sorted) matched.set(id, b.q);
    add(sorted.map(([id]) => id));
  }
  if (!ranks.size) return [];
  const ids = [...ranks.keys()];
  const rows = (await db.execute({ sql: `SELECT id,repo_id,scope,kind,status,source,signal,text,plain,updated_at FROM lessons WHERE off=0 AND id IN (${ids.map(() => "?").join(",")})`, args: ids })).rows;
  const sorted = rows.sort((a, b) => (Number(b.status === "live") - Number(a.status === "live")) || (Number(b.repo_id === here) - Number(a.repo_id === here)) || ranks.get(String(b.id))! - ranks.get(String(a.id))!).slice(0, opts.includeWaiting ? 8 : 5);
  for (const r of sorted.filter((r) => r.repo_id && r.repo_id !== here && r.status === "live")) await db.execute({ sql: "INSERT INTO search_log (id,ts,from_repo,result_repo,query_kind) VALUES (lower(hex(randomblob(16))),?,?,?,'ask')", args: [new Date().toISOString(), here, String(r.repo_id)] });
  const out: AskHit[] = [];
  for (const r of sorted) {
    const id = String(r.id); const repo = r.repo_id ? String(r.repo_id) : null;
    out.push({
      id, repo_id: repo, scope: String(r.scope), kind: String(r.kind ?? "rule"), status: String(r.status), text: String(r.text), plain: r.plain ? String(r.plain) : null,
      updated_at: String(r.updated_at), where: r.scope === "global" ? "any repo" : repo === here ? "this repo" : shortRepo(repo),
      origin: await originOf(db, { id, source: String(r.source), signal: r.signal ? String(r.signal) : null }), matched: matched.get(id) ?? null,
    });
  }
  return out;
}

export async function ask(args: string[]) {
  const q = args.filter((a) => !a.startsWith("--")).join(" ").trim();
  if (!q) { console.error('Usage: muninn ask "question"'); process.exitCode = 1; return; }
  const hits = await askData(await openDb(), q, repoIdentity(process.cwd()));
  if (!hits.length) { console.log("No kept lessons match."); return; }
  for (const r of hits) console.log(`- ${r.text}${r.plain ? `\n  In short: ${r.plain}` : ""}\n  ${r.where}, kept ${r.kind === "note" ? "note" : "lesson"}. ${r.origin}.`);
}
