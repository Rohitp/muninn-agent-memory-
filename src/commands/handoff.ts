import { existsSync } from "node:fs";
import { isPaused, settings } from "../config.js";
import { syncCursor } from "../deliver/cursor.js";
import { age, currentBranch, latestHandoff, makeHandoff } from "../handoff/handoff.js";
import { pickRunner, saveUsage } from "../learn/writer.js";
import { readAny } from "../logs/discover.js";
import { isOwnRun } from "../logs/types.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";

/** `muninn handoff` shows where the last session on this branch left off. With --transcript, writes one (used by the SessionEnd hook). */
export async function handoff(args: string[]) {
  const i = args.indexOf("--transcript");
  if (i >= 0) {
    const file = args[i + 1] ?? "";
    if (isPaused() || !existsSync(file)) return;
    const s = readAny(file);
    if (isOwnRun(s)) return;
    const runner = pickRunner("background");
    if (!runner) return;
    const db = await openDb();
    try { if (await makeHandoff(db, s, runner)) await syncCursor(db); }
    finally { await saveUsage(db, runner, "handoff"); }
    return;
  }
  const db = await openDb();
  const repo = repoIdentity(process.cwd());
  if (!repo) { console.error("Run this inside a git repo."); process.exitCode = 1; return; }
  if (args.includes("--list")) {
    const rows = (await db.execute({ sql: "SELECT branch,tool,created_at,text FROM handoffs WHERE repo_id=? ORDER BY created_at DESC LIMIT 10", args: [repo] })).rows;
    if (!rows.length) { console.log("No handoffs for this repo yet."); return; }
    for (const r of rows) console.log(`\n${r.branch} · ${r.tool} · ${age(String(r.created_at))}\n${r.text}`);
    return;
  }
  const branch = currentBranch(process.cwd()) ?? "unknown";
  const h = await latestHandoff(db, repo, branch, settings().handoffDays);
  if (!h) { console.log(`No handoff on ${branch} in the last ${settings().handoffDays} days. They're written when a session ends.`); return; }
  console.log(`${h.branch} · ${h.tool} · ${age(h.created_at)}\n${h.text}`);
}
