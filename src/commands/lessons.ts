import { rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { home, ensureHome } from "../config.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";
import { createLesson, decide, ensureRepo, getLesson, listLessons, routeOf } from "../store/lessons.js";
import { removeLearnHook } from "./install.js";

function flags(args: string[]) {
  const f: Record<string, string | boolean> = {}; const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--always-on" || a === "--global" || a === "--repo-scope" || a === "--not-always-on" || a === "--yes") f[a.slice(2)] = true;
    else if (a.startsWith("--")) f[a.slice(2)] = args[++i] ?? "";
    else rest.push(a);
  }
  return { f, rest };
}
const need = async (id: string | undefined) => {
  const db = await openDb();
  const l = id ? await getLesson(db, id) : null;
  if (!l) { console.error("No lesson with that id."); process.exit(1); }
  return { db, l };
};

export async function add(args: string[]) {
  const { f, rest } = flags(args);
  const text = rest.join(" ").trim();
  if (!text) { console.error('Usage: muninn add "lesson text" [--always-on] [--trigger word] [--global]'); process.exitCode = 1; return; }
  const db = await openDb();
  const repo = f.global ? null : repoIdentity(process.cwd());
  if (repo) await ensureRepo(db, repo, process.cwd());
  const id = await createLesson(db, { repo_id: repo, text, source: "manual", status: "live", by: "person", reviewed: true });
  await decide(db, id, { alwaysOn: !!f["always-on"], ...(typeof f.trigger === "string" ? { triggers: [f.trigger] } : {}) });
  const l = (await getLesson(db, id))!;
  console.log(`Added ${id.slice(0, 8)}.`);
  if (!(await routeOf(db, l))) console.log("It's searchable, but it won't be delivered automatically. Add --always-on or --trigger.");
}
export async function list(args: string[]) {
  const { f } = flags(args);
  const db = await openDb();
  const repo = f.all ? null : repoIdentity(process.cwd());
  for (const l of await listLessons(db, { repo, ...(typeof f.status === "string" ? { status: f.status } : {}) })) console.log(`${l.id.slice(0, 8)}  ${l.status.padEnd(8)} ${String(l.signal ?? l.source).padEnd(17)} ${l.text.slice(0, 100)}`);
}
export async function show(args: string[]) {
  const { db, l } = await need(args[0]);
  const t = await db.execute({ sql: "SELECT pattern FROM triggers WHERE lesson_id=?", args: [l.id] });
  const e = await db.execute({ sql: "SELECT tool,seen_at,quote FROM evidence WHERE lesson_id=?", args: [l.id] });
  console.log(JSON.stringify({ ...l, triggers: t.rows.map((r) => r.pattern), evidence: e.rows }, null, 2));
}
export async function edit(args: string[]) {
  const { f, rest } = flags(args);
  const { db, l } = await need(rest[0]);
  const text = typeof f.text === "string" ? f.text : undefined;
  await decide(db, l.id, {
    ...(text ? { text } : {}),
    ...(f["always-on"] ? { alwaysOn: true } : f["not-always-on"] ? { alwaysOn: false } : {}),
    ...(f.global ? { global: true } : f["repo-scope"] ? { global: false } : {}),
    ...(typeof f.trigger === "string" ? { triggers: f.trigger ? [f.trigger] : [] } : {}),
    ...(typeof f.status === "string" && f.status === "live" ? { status: "live" as const } : {}),
  });
  console.log(`Updated ${l.id.slice(0, 8)}.`);
}
export async function retire(args: string[]) {
  const { db, l } = await need(args[0]);
  await decide(db, l.id, { status: "retired" });
  console.log(`Retired ${l.id.slice(0, 8)}. It won't be proposed again.`);
}
export async function exportLessons(args: string[]) {
  const db = await openDb();
  const out = args[0] ?? join(ensureHome(), "export.jsonl");
  const rows = await listLessons(db);
  writeFileSync(out, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""), { mode: 0o600 });
  console.log(`Wrote ${rows.length} lesson(s) to ${out}.`);
}
export async function purge(args: string[]) {
  if (!args.includes("--yes")) { console.error(`This removes muninn's hooks and deletes ${home()}, including all lessons, the model and backups. Run again with --yes.`); process.exitCode = 1; return; }
  removeLearnHook();
  try { const { disableCursor } = await import("../deliver/cursor.js"); await disableCursor(await openDb(), null); } catch { /* the store may already be gone */ }
  if (existsSync(home())) rmSync(home(), { recursive: true, force: true });
  console.log("Removed muninn's hooks and data.");
}
