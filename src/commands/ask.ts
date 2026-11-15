import { loadEmbedder, modelCached, cosine } from "../embed/model.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";

import type { Client } from "@libsql/client";

export type AskHit = { id: string; repo_id: string | null; scope: string; kind: string; text: string; updated_at: string; where: string };
/** Searches live lessons in every repo, with this repo first. Keyword and meaning results are merged by rank. */
export async function askData(db: Client, q: string, here: string | null): Promise<AskHit[]> {
  const ranks = new Map<string, number>();
  const add = (ids: string[]) => ids.forEach((id, i) => ranks.set(id, (ranks.get(id) ?? 0) + 1 / (60 + i)));
  const STOP = new Set(["the", "and", "for", "with", "how", "what", "where", "when", "why", "who", "which", "does", "this", "that", "are", "was", "can", "should", "would", "could", "there", "here", "from", "into", "about", "run", "use"]);
  const words = (q.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? []).filter((w) => !STOP.has(w));
  if (words.length) {
    const fts = words.map((w) => `"${w}"`).join(" OR ");
    add((await db.execute({ sql: "SELECT f.lesson_id id FROM lessons_fts f JOIN lessons l ON l.id=f.lesson_id WHERE lessons_fts MATCH ? AND l.status='live' ORDER BY rank LIMIT 20", args: [fts] })).rows.map((r) => String(r.id)));
  }
  if (modelCached()) {
    const embed = await loadEmbedder();
    const v = (await embed([q])).get(q)!;
    const rows = (await db.execute("SELECT id, vector_extract(embedding) e FROM lessons WHERE status='live' AND embedding IS NOT NULL")).rows;
    add(rows.map((r) => ({ id: String(r.id), s: cosine(v, Float32Array.from(JSON.parse(String(r.e)))) })).filter((x) => x.s > 0.65).sort((a, b) => b.s - a.s).slice(0, 20).map((x) => x.id));
  }
  if (!ranks.size) return [];
  const ids = [...ranks.keys()];
  const rows = (await db.execute({ sql: `SELECT id,repo_id,scope,kind,text,updated_at FROM lessons WHERE id IN (${ids.map(() => "?").join(",")})`, args: ids })).rows;
  const sorted = rows.sort((a, b) => (Number(b.repo_id === here) - Number(a.repo_id === here)) || ranks.get(String(b.id))! - ranks.get(String(a.id))!).slice(0, 5);
  const crossRepo = sorted.filter((r) => r.repo_id && r.repo_id !== here);
  for (const r of crossRepo) await db.execute({ sql: "INSERT INTO search_log (id,ts,from_repo,result_repo,query_kind) VALUES (lower(hex(randomblob(16))),?,?,?,'ask')", args: [new Date().toISOString(), here, String(r.repo_id)] });
  return sorted.map((r) => ({ id: String(r.id), repo_id: r.repo_id ? String(r.repo_id) : null, scope: String(r.scope), kind: String(r.kind ?? "rule"), text: String(r.text), updated_at: String(r.updated_at), where: r.scope === "global" ? "global" : r.repo_id === here ? "this repo" : `from ${r.repo_id}` }));
}

export async function ask(args: string[]) {
  const q = args.filter((a) => !a.startsWith("--")).join(" ").trim();
  if (!q) { console.error('Usage: muninn ask "question"'); process.exitCode = 1; return; }
  const hits = await askData(await openDb(), q, repoIdentity(process.cwd()));
  if (!hits.length) { console.log("No kept lessons match."); return; }
  for (const r of hits) console.log(`- ${r.text}\n  ${r.where}, kept ${r.kind === "note" ? "note" : "lesson"}, updated ${r.updated_at.slice(0, 10)}`);
}
