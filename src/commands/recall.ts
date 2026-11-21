import type { Client } from "@libsql/client";
import { cosine, loadEmbedder, modelCached, type Embed } from "../embed/model.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";
import { unvec } from "../store/sessions.js";

export type RecallHit = { id: string; repo: string | null; session: string; tool: string; branch: string | null; ts: string; text: string; score: number; by: ("words" | "meaning")[] };
const STOP = new Set(["the", "and", "for", "with", "how", "what", "where", "when", "why", "who", "which", "did", "does", "this", "that", "are", "was", "can", "you", "our", "had", "have", "last", "time", "fix", "fixed"]);
/** How close in meaning an exchange must be to count, on the local model's 0 to 1 scale. */
export const MEANING_MIN = 0.55;

/**
 * Searches every stored exchange (what you typed, what the agent said and ran) by words and by meaning,
 * in this repo or all of them, and merges the two rankings.
 */
export async function recallData(db: Client, q: string, repo: string | null, opts: { embed?: Embed; limit?: number; days?: number } = {}): Promise<RecallHit[]> {
  const where = [repo ? "c.repo_id=?" : "1", opts.days ? "c.ts>=?" : "1"].join(" AND ");
  const args = [...(repo ? [repo] : []), ...(opts.days ? [new Date(Date.now() - opts.days * 86_400_000).toISOString()] : [])];
  const score = new Map<string, number>(); const by = new Map<string, Set<"words" | "meaning">>();
  const add = (ids: string[], how: "words" | "meaning") => ids.forEach((id, i) => { score.set(id, (score.get(id) ?? 0) + 1 / (60 + i)); by.set(id, (by.get(id) ?? new Set()).add(how)); });
  const words = (q.toLowerCase().match(/[a-z0-9_.-]{3,}/g) ?? []).filter((w) => !STOP.has(w));
  if (words.length) {
    const fts = words.map((w) => `"${w.replace(/"/g, "")}"`).join(" OR ");
    add((await db.execute({ sql: `SELECT f.chunk_id id FROM chunks_fts f JOIN chunks c ON c.id=f.chunk_id WHERE chunks_fts MATCH ? AND ${where} ORDER BY f.rank LIMIT 30`, args: [fts, ...args] })).rows.map((r) => String(r.id)), "words");
  }
  const embed = opts.embed ?? (modelCached() ? await loadEmbedder() : null);
  if (embed) {
    const v = (await embed([q])).get(q)!;
    const rows = (await db.execute({ sql: `SELECT c.id, c.embedding FROM chunks c WHERE c.embedding IS NOT NULL AND ${where}`, args })).rows;
    add(rows.map((r) => ({ id: String(r.id), s: cosine(v, unvec(r.embedding)) })).filter((x) => x.s >= MEANING_MIN).sort((a, b) => b.s - a.s).slice(0, 30).map((x) => x.id), "meaning");
  }
  if (!score.size) return [];
  const top = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, opts.limit ?? 6);
  const ids = top.map(([id]) => id);
  const rows = (await db.execute({ sql: `SELECT id,repo_id,session,tool,branch,ts,text FROM chunks WHERE id IN (${ids.map(() => "?").join(",")})`, args: ids })).rows;
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  return top.flatMap(([id, s]) => {
    const r = byId.get(id);
    return r ? [{ id, repo: r.repo_id ? String(r.repo_id) : null, session: String(r.session), tool: String(r.tool), branch: r.branch ? String(r.branch) : null, ts: String(r.ts), text: String(r.text), score: s, by: [...(by.get(id) ?? [])] }] : [];
  });
}

const TOOL: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex", cursor: "Cursor", antigravity: "Antigravity", plan: "Plan" };
const date = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
export function recallText(hits: RecallHit[], full = false): string {
  return hits.map((h) => {
    const head = `${date(h.ts)} · ${TOOL[h.tool] ?? h.tool}${h.repo ? ` · ${h.repo.split("/").pop()}` : ""}${h.branch ? ` · ${h.branch}` : ""}`;
    const body = full ? h.text : h.text.split("\n").map((l) => (l.length > 260 ? `${l.slice(0, 259)}…` : l)).slice(0, 4).join("\n");
    return `${head}\n${body.split("\n").map((l) => `  ${l}`).join("\n")}`;
  }).join("\n\n");
}

/** muninn recall "what" [--all-repos] [--days N] [--full] */
export async function recall(args: string[]) {
  const val = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  const skip = new Set([val("--days")].filter(Boolean));
  const q = args.filter((a) => !a.startsWith("--") && !skip.has(a)).join(" ").trim();
  if (!q) { console.error('Usage: muninn recall "what you\'re looking for" [--all-repos] [--days 30] [--full]'); process.exitCode = 1; return; }
  const db = await openDb();
  const stored = Number((await db.execute("SELECT count(*) n FROM chunks")).rows[0]?.n ?? 0);
  if (!stored) { console.log('Nothing stored yet. Run "muninn learn --all-repos" once; after that muninn keeps your sessions as you work.'); return; }
  const repo = args.includes("--all-repos") ? null : repoIdentity(process.cwd());
  const hits = await recallData(db, q, repo, { days: val("--days") ? Number(val("--days")) : undefined, limit: 6 });
  if (!hits.length) { console.log(`Nothing in ${repo ? "this repo's" : "your"} sessions matches.${repo ? " Try --all-repos." : ""}`); return; }
  console.log(recallText(hits, args.includes("--full")));
}
