import type { Client } from "@libsql/client";

/**
 * Repos you told muninn to leave alone: not listed, not scanned, and agents there aren't told anything.
 * A list rather than just deleting, because the repo's sessions are still in the logs and would bring it back.
 */
export async function ignoredRepos(db: Client): Promise<Set<string>> {
  const v = (await db.execute("SELECT value FROM meta WHERE key='ignored_repos'")).rows[0]?.value;
  try { return new Set(v ? (JSON.parse(String(v)) as string[]) : []); } catch { return new Set(); }
}
const save = (db: Client, s: Set<string>) => db.execute({ sql: "INSERT OR REPLACE INTO meta (key,value) VALUES ('ignored_repos',?)", args: [JSON.stringify([...s].sort())] });

/** Ignores a repo and removes what muninn kept for it. Returns how many lessons were removed. */
export async function ignoreRepo(db: Client, id: string): Promise<number> {
  const s = await ignoredRepos(db); s.add(id); await save(db, s);
  const lessons = (await db.execute({ sql: "SELECT id FROM lessons WHERE repo_id=?", args: [id] })).rows.map((r) => String(r.id));
  for (const l of lessons) for (const t of ["triggers", "evidence", "lesson_versions", "deliveries", "feedback", "questions"]) {
    try { await db.execute({ sql: `DELETE FROM ${t} WHERE lesson_id=?`, args: [l] }); } catch { /* a table this version doesn't have */ }
  }
  for (const t of ["lessons", "handoffs", "plan_items", "judged", "scan_counts", "memory_lines", "proposals", "checkpoints"]) {
    try { await db.execute({ sql: `DELETE FROM ${t} WHERE repo_id=?`, args: [id] }); } catch { /* a table this version doesn't have */ }
  }
  await db.execute({ sql: "DELETE FROM meta WHERE substr(key, instr(key, ':') + 1, ?) = ? AND key != 'ignored_repos'", args: [id.length, id] });
  await db.execute({ sql: "DELETE FROM repos WHERE id=?", args: [id] });
  return lessons.length;
}
export async function unignoreRepo(db: Client, id: string) {
  const s = await ignoredRepos(db); s.delete(id); await save(db, s);
}
