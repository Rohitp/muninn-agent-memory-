import { createClient, type Client } from "@libsql/client";
import { copyFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureHome } from "../config.js";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export async function openDb(opts: { migrate?: boolean; lockWaitMs?: number } = {}): Promise<Client> {
  const file = join(ensureHome(), "muninn.db");
  const existed = existsSync(file);
  const db = createClient({ url: `file:${file}` });
  await db.execute("PRAGMA journal_mode=WAL");
  await db.execute(`PRAGMA busy_timeout=${opts.lockWaitMs ?? 5000}`);
  if (opts.migrate !== false) await migrate(db, file, existed);
  return db;
}

async function migrate(db: Client, file: string, existed: boolean) {
  const hasMeta = (await db.execute("SELECT 1 FROM sqlite_master WHERE name='meta'")).rows.length > 0;
  const current = hasMeta ? Number((await db.execute("SELECT value FROM meta WHERE key='schema_version'")).rows[0]?.value ?? 0) : 0;
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  const pending = files.filter((f) => Number.parseInt(f, 10) > current);
  if (!pending.length) return;
  if (existed && current > 0) copyFileSync(file, `${file}.bak-v${current}`);
  for (const f of pending) {
    await db.executeMultiple(readFileSync(join(migrationsDir, f), "utf8"));
    await db.execute({ sql: "INSERT OR REPLACE INTO meta (key,value) VALUES ('schema_version',?)", args: [String(Number.parseInt(f, 10))] });
  }
}
