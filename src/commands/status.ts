import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { home, isPaused } from "../config.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";
import { keywordsInUse } from "../store/lessons.js";
import { installed } from "./install.js";

export async function status() {
  const db = await openDb();
  const repo = repoIdentity(process.cwd());
  const meta = async (k: string) => String((await db.execute({ sql: "SELECT value FROM meta WHERE key=?", args: [k] })).rows[0]?.value ?? "");
  const counts = (await db.execute({ sql: "SELECT status,count(*) n FROM lessons WHERE repo_id IS ? OR repo_id=? OR scope='global' GROUP BY status", args: [repo, repo] })).rows.map((r) => `${r.n} ${r.status}`).join(", ");
  const lastLearn = await meta("last_learn");
  console.log(`Repo: ${repo ?? "not in a git repo"}`);
  console.log(`Lessons here and global: ${counts || "none"}`);
  console.log(`Last learn: ${lastLearn || "never"}`);
  if (lastLearn && Date.now() - Date.parse(lastLearn) > 21 * 86_400_000) console.log("  That's over 3 weeks ago. Claude Code deletes logs after 30 days by default.");
  const hooks = installed();
  console.log(`Claude Code hooks: ${hooks.length ? hooks.join(", ") : "not installed. Run muninn install"}${isPaused() ? " (paused)" : ""}`);
  for (const r of (await db.execute("SELECT tool, max(ts) last, sum(outcome='sent') sent FROM deliveries GROUP BY tool")).rows) console.log(`Last hook run from ${r.tool}: ${r.last}. Lessons sent so far: ${r.sent}`);
  const kw = await keywordsInUse(db, repo);
  if (kw.length) console.log(`Keywords: ${kw.map((k) => `${k.pattern} (${k.lessons})`).join(", ")}`);
  for (const r of (await db.execute("SELECT tool, client_version, unknown_records FROM scan_counts WHERE unknown_records>0")).rows) console.log(`Unrecognised log records: ${r.tool} ${r.client_version}: ${r.unknown_records}`);
  const errors = join(home(), "hook-errors.log");
  if (existsSync(errors)) console.log(`Recent hook errors:\n${readFileSync(errors, "utf8").trim().split("\n").slice(-3).join("\n")}`);
  try {
    const s = JSON.parse(readFileSync(join(homedir(), ".claude", "settings.json"), "utf8"));
    if (!s.cleanupPeriodDays || s.cleanupPeriodDays <= 30) console.log("Claude Code keeps logs for 30 days by default. Set cleanupPeriodDays in ~/.claude/settings.json to keep more for muninn to learn from.");
  } catch { /* no settings file */ }
}
export async function keywords() {
  const db = await openDb();
  const kw = await keywordsInUse(db, repoIdentity(process.cwd()));
  if (!kw.length) { console.log("No keywords yet."); return; }
  for (const k of kw) console.log(`${k.pattern.padEnd(24)} ${k.lessons} lesson(s)`);
}
