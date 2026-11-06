import type { Client } from "@libsql/client";
import { randomUUID } from "node:crypto";

export type Lesson = { id: string; repo_id: string | null; scope: string; text: string; source: string; signal: string | null; status: string; sessions: number; last_seen: string | null; reviewed_at: string | null; first_shown_at: string | null; news_to_engineer: number | null; edited_by_person: number; always_on: number };
const COLS = "id,repo_id,scope,text,source,signal,status,sessions,last_seen,reviewed_at,first_shown_at,news_to_engineer,edited_by_person,always_on";
const now = () => new Date().toISOString();

export async function ensureRepo(db: Client, id: string, path: string) {
  await db.execute({ sql: "INSERT OR IGNORE INTO repos (id,paths) VALUES (?,?)", args: [id, JSON.stringify([path])] });
}
async function version(db: Client, id: string, by: string) {
  const l = await getLesson(db, id);
  const triggers = (await db.execute({ sql: "SELECT pattern FROM triggers WHERE lesson_id=?", args: [id] })).rows.map((r) => r.pattern);
  await db.execute({ sql: "INSERT INTO lesson_versions (id,lesson_id,snapshot,changed_by,changed_at) VALUES (?,?,?,?,?)", args: [randomUUID(), id, JSON.stringify({ ...l, triggers }), by, now()] });
}
export async function createLesson(db: Client, l: { repo_id: string | null; scope?: string; text: string; source: string; signal?: string | null; status: string; sessions?: number; last_seen?: string | null; vector?: Float32Array; by: string; reviewed?: boolean }) {
  const id = randomUUID(); const t = now();
  const vec = l.vector ? `[${[...l.vector].join(",")}]` : null;
  await db.execute({
    sql: `INSERT INTO lessons (id,repo_id,scope,text,source,signal,status,sessions,last_seen,reviewed_at,embedding,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,${vec ? "vector32(?)" : "NULL"},?,?)`,
    args: [id, l.repo_id, l.scope ?? (l.repo_id ? "repo" : "global"), l.text, l.source, l.signal ?? null, l.status, l.sessions ?? 0, l.last_seen ?? null, l.reviewed ? t : null, ...(vec ? [vec] : []), t, t],
  });
  await db.execute({ sql: "INSERT INTO lessons_fts (lesson_id,text) VALUES (?,?)", args: [id, l.text] });
  await version(db, id, l.by);
  return id;
}
export async function getLesson(db: Client, id: string): Promise<Lesson | null> {
  const r = await db.execute({ sql: `SELECT ${COLS} FROM lessons WHERE id=? OR id LIKE ?`, args: [id, `${id}%`] });
  return (r.rows[0] as unknown as Lesson) ?? null;
}
export async function listLessons(db: Client, f: { repo?: string | null; status?: string } = {}): Promise<Lesson[]> {
  const where: string[] = []; const args: string[] = [];
  if (f.repo) { where.push("repo_id=?"); args.push(f.repo); }
  if (f.status) { where.push("status=?"); args.push(f.status); }
  const r = await db.execute({ sql: `SELECT ${COLS} FROM lessons ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY sessions DESC, last_seen DESC`, args });
  return r.rows as unknown as Lesson[];
}
export async function lessonVectors(db: Client, repo: string): Promise<{ id: string; status: string; text: string; vector: Float32Array | null }[]> {
  const r = await db.execute({ sql: "SELECT id,status,text,vector_extract(embedding) v FROM lessons WHERE repo_id=? AND embedding IS NOT NULL", args: [repo] });
  return r.rows.map((x) => ({ id: String(x.id), status: String(x.status), text: String(x.text), vector: x.v ? Float32Array.from(JSON.parse(String(x.v))) : null }));
}
export async function addEvidence(db: Client, id: string, quotes: { tool: string; session: string; ts: string; quote: string }[]) {
  for (const q of quotes) await db.execute({ sql: "INSERT OR IGNORE INTO evidence (lesson_id,tool,session,seen_at,quote) VALUES (?,?,?,?,?)", args: [id, q.tool, q.session, q.ts, q.quote] });
}
export async function touchSeen(db: Client, id: string, sessions: number, last: string) {
  await db.execute({ sql: "UPDATE lessons SET sessions=max(sessions,?), last_seen=max(coalesce(last_seen,''),?), updated_at=? WHERE id=?", args: [sessions, last, now(), id] });
}
export async function markShown(db: Client, id: string) {
  await db.execute({ sql: "UPDATE lessons SET first_shown_at=coalesce(first_shown_at,?) WHERE id=?", args: [now(), id] });
}
/** A person's decision. Agents and scans never call this. */
export async function decide(db: Client, id: string, d: { status?: "live" | "rejected" | "retired"; text?: string; news?: boolean; alwaysOn?: boolean; global?: boolean; triggers?: string[] }) {
  const sets = ["updated_at=?", "reviewed_at=?"]; const t = now(); const args: (string | number)[] = [t, t];
  if (d.status) { sets.push("status=?"); args.push(d.status); }
  if (d.text !== undefined) { sets.push("text=?", "edited_by_person=1"); args.push(d.text); }
  if (d.news !== undefined) { sets.push("news_to_engineer=?"); args.push(d.news ? 1 : 0); }
  if (d.alwaysOn !== undefined) { sets.push("always_on=?"); args.push(d.alwaysOn ? 1 : 0); }
  if (d.global !== undefined) { sets.push("scope=?"); args.push(d.global ? "global" : "repo"); }
  await db.execute({ sql: `UPDATE lessons SET ${sets.join(",")} WHERE id=?`, args: [...args, id] });
  if (d.text !== undefined) {
    await db.execute({ sql: "DELETE FROM lessons_fts WHERE lesson_id=?", args: [id] });
    await db.execute({ sql: "INSERT INTO lessons_fts (lesson_id,text) VALUES (?,?)", args: [id, d.text] });
  }
  if (d.triggers) {
    await db.execute({ sql: "DELETE FROM triggers WHERE lesson_id=?", args: [id] });
    for (const p of d.triggers) await db.execute({ sql: "INSERT INTO triggers (id,lesson_id,pattern,created_at) VALUES (?,?,?,?)", args: [randomUUID(), id, p, t] });
  }
  await version(db, id, "person");
}
export const routeOf = async (db: Client, l: Lesson) => (l.always_on ? true : (await db.execute({ sql: "SELECT 1 FROM triggers WHERE lesson_id=? LIMIT 1", args: [l.id] })).rows.length > 0);
