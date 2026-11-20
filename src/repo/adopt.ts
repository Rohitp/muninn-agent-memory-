import type { Client } from "@libsql/client";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

/**
 * A repo with no remote is known by its folder path. Once a remote is added (say, the first push), its identity
 * becomes the remote, and everything filed under the path would be orphaned. This moves lessons, handoffs, the plan
 * and settings from the path to the new identity. Cheap when there's nothing to do: one lookup.
 */
export async function adoptRepo(db: Client, id: string | null, cwd: string): Promise<boolean> {
  if (!id || id.startsWith("/")) return false;
  let top: string;
  try { top = execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).trim(); }
  catch { return false; }
  // The same folder can be spelled two ways on macOS (/var and /private/var); look for either.
  const spellings = [...new Set([top, top.replace(/^\/private(?=\/)/, ""), realpathSync(top)])];
  // Filed under the folder (no remote before), or under an earlier remote for this same folder (the repo was
  // renamed or moved, so its remote URL changed).
  const olds = new Set((await db.execute({ sql: `SELECT id FROM repos WHERE id IN (${spellings.map(() => "?").join(",")})`, args: spellings })).rows.map((r) => String(r.id)));
  for (const r of (await db.execute({ sql: "SELECT id, paths FROM repos WHERE id != ? AND id NOT LIKE '/%'", args: [id] })).rows) {
    try { if ((JSON.parse(String(r.paths)) as string[]).some((p) => spellings.includes(p))) olds.add(String(r.id)); } catch { /* unreadable paths */ }
  }
  olds.delete(id);
  if (!olds.size) return false;
  for (const from of olds) await move(db, from, id);
  return true;
}

/** Moves everything filed under one repo id to another. */
async function move(db: Client, top: string, id: string) {
  // The new repo row must exist before anything points at it.
  await db.execute({ sql: "INSERT OR IGNORE INTO repos (id, paths) SELECT ?, paths FROM repos WHERE id=?", args: [id, top] });
  for (const table of ["lessons", "handoffs", "plan_items", "judged", "scan_counts", "memory_lines", "proposals"]) {
    try { await db.execute({ sql: `UPDATE OR IGNORE ${table} SET repo_id=? WHERE repo_id=?`, args: [id, top] }); } catch { /* a table this version doesn't have */ }
  }
  // Per-repo settings live in meta under keys ending with the repo id, or with the id then "@branch".
  for (const prefix of ["dial:", "plan_file:", "nudged:", "lesson_file:", "scanned:"]) {
    await db.execute({ sql: "UPDATE OR IGNORE meta SET key=? WHERE key=?", args: [prefix + id, prefix + top] });
  }
  for (const prefix of ["plan_status:", "plan_caught_up:"]) {
    for (const r of (await db.execute({ sql: "SELECT key FROM meta WHERE substr(key,1,?)=?", args: [prefix.length + top.length + 1, `${prefix}${top}@`] })).rows) {
      const key = String(r.key);
      await db.execute({ sql: "UPDATE OR IGNORE meta SET key=? WHERE key=?", args: [prefix + id + key.slice(prefix.length + top.length), key] });
    }
  }
  const cursor = (await db.execute("SELECT value FROM meta WHERE key='cursor_repos'")).rows[0]?.value;
  if (cursor) {
    const list = (JSON.parse(String(cursor)) as string[]).map((r) => (r === top ? id : r));
    await db.execute({ sql: "UPDATE meta SET value=? WHERE key='cursor_repos'", args: [JSON.stringify([...new Set(list)])] });
  }
  // Anything left on the old id (a row the new id already had) stays there rather than being lost.
  const left = (await db.execute({ sql: "SELECT (SELECT count(*) FROM lessons WHERE repo_id=?) + (SELECT count(*) FROM handoffs WHERE repo_id=?) n", args: [top, top] })).rows[0]?.n;
  if (!Number(left)) await db.execute({ sql: "DELETE FROM repos WHERE id=?", args: [top] });
}
