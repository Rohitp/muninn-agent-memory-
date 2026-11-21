import type { Client } from "@libsql/client";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { home, isPaused } from "../config.js";
import { repoIdentity } from "../repo/identity.js";
import { modelCached } from "../embed/model.js";
import { openDb } from "../store/db.js";
import { keywordsInUse } from "../store/lessons.js";
import { EVENTS, codexPresent, installed } from "./install.js";

const ago = (iso: string, now = Date.now()) => {
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  const h = Math.round(m / 60);
  return m < 1 ? "just now" : m < 60 ? `${m} minute${m === 1 ? "" : "s"} ago` : m < 2880 ? `${h} hour${h === 1 ? "" : "s"} ago` : `${Math.round(m / 1440)} days ago`;
};
const HOOK_WORDS: Record<string, string> = { SessionStart: "session start", UserPromptSubmit: "your prompts", PostToolUseFailure: "failed commands", PostToolUse: "failed commands", SubagentStart: "subagents", Stop: "plan updates while you work", PreCompact: "plan updates before compaction", SessionEnd: "session end" };

export type Health = { state: "not-set-up" | "paused" | "waiting" | "working" | "problem"; line: string; lastCall: string | null; errors: string[] };

/**
 * Is muninn working? There's no process to check: Claude Code calls muninn at set moments.
 * So "working" means its hooks are installed and Claude Code called them recently, with no error since.
 */
export async function health(db: Client, opts: { hooks?: string[]; paused?: boolean; errorLog?: string } = {}): Promise<Health> {
  const hooks = opts.hooks ?? installed();
  const lastCall = String((await db.execute("SELECT max(ts) t FROM deliveries WHERE tool='claude-code'")).rows[0]?.t ?? "") || null;
  const log = opts.errorLog ?? join(home(), "hook-errors.log");
  // Only errors newer than the last successful call matter: older ones were followed by a working call.
  const errors = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean).filter((l) => !lastCall || l.slice(0, 24) > lastCall).slice(-3) : [];
  if (!hooks.length) return { state: "not-set-up", line: "muninn isn't set up on this machine. Run: muninn setup", lastCall, errors };
  if (opts.paused ?? isPaused()) return { state: "paused", line: "muninn is paused, so your agents aren't told anything. Run: muninn resume", lastCall, errors };
  if (errors.length) return { state: "problem", line: `muninn had a problem the last time Claude Code called it (${ago(errors.at(-1)!.slice(0, 24))}). The error is below.`, lastCall, errors };
  if (!lastCall) return { state: "waiting", line: "muninn is set up, but Claude Code hasn't called it yet. Start a Claude Code session in a git repo, send a message, then check again.", lastCall, errors };
  return { state: "working", line: `muninn is working. Claude Code last called it ${ago(lastCall)}.`, lastCall, errors };
}

export async function status() {
  const db = await openDb();
  const repo = repoIdentity(process.cwd());
  const meta = async (k: string) => String((await db.execute({ sql: "SELECT value FROM meta WHERE key=?", args: [k] })).rows[0]?.value ?? "");
  const h = await health(db);
  console.log(h.line);
  for (const e of h.errors) console.log(`  ${e}`);

  console.log("");
  const hooks = installed();
  const missing = Object.keys(EVENTS["claude-code"]).filter((e) => !hooks.includes(e));
  console.log(`Claude Code: ${hooks.length ? (missing.length ? `connected, but not for ${missing.map((e) => HOOK_WORDS[e]).join(", ")}. Run: muninn install` : "connected") : "not connected"}`);
  if (codexPresent()) {
    const ch = installed("codex");
    const cm = Object.keys(EVENTS.codex).filter((e) => !ch.includes(e));
    console.log(`Codex: ${ch.length ? `${cm.length ? `connected, but not for ${cm.map((e) => HOOK_WORDS[e]).join(", ")}. Run: muninn install, then trust it in Codex's /hooks` : "connected (Codex runs the hooks only after you trust them in /hooks)"}` : "not connected. Run: muninn install"}`);
  }
  const lastLearn = await meta("last_learn");
  if (!modelCached()) console.log('Checked your sessions for lessons: never, because the local model isn\'t downloaded yet. Run "muninn learn --all-repos" once to download it (about 33 MB).');
  else console.log(`Checked your sessions for lessons: ${lastLearn ? ago(lastLearn) : "not yet"} (it does this on its own after you work)`);
  const live = (await db.execute({ sql: "SELECT count(*) n FROM lessons WHERE status='live' AND off=0 AND (repo_id IS ? OR repo_id=? OR scope='global')", args: [repo, repo] })).rows[0]?.n ?? 0;
  const waiting = (await db.execute({ sql: "SELECT count(*) n FROM lessons WHERE status='proposed' AND (repo_id IS ? OR repo_id=?)", args: [repo, repo] })).rows[0]?.n ?? 0;
  console.log(`${repo ? `In this repo (${repo.split("/").pop()})` : "Here (not a git repo)"}: agents are told ${live} lesson${Number(live) === 1 ? "" : "s"}${Number(waiting) ? `, and ${waiting} suggestion${Number(waiting) === 1 ? " is" : "s are"} waiting in muninn ui` : ""}.`);
  if (!repo) console.log("  muninn learns per repo, so run your agents inside a project that's a git repo.");

  const notes: string[] = [];
  for (const r of (await db.execute("SELECT tool, client_version, unknown_records FROM scan_counts WHERE unknown_records>0")).rows) notes.push(`Some ${r.tool} ${r.client_version} log records weren't recognised (${r.unknown_records}), so a log format may have changed.`);
  const shape = await meta("codex_tool_response_shape");
  if (shape) notes.push(`Codex command results look like ${shape}; muninn reads failures from an exit code in there.`);
  // muninn's MCP server lets agents ask it questions; Claude Code can lose it if a running session rewrites its settings.
  try {
    const { claudeHasMuninn } = await import("../mcp/install.js");
    if (claudeHasMuninn() === false) notes.push('Claude Code doesn\'t list muninn\'s MCP server, so its agents can\'t ask muninn questions (where_left_off, get_plan, search_history). Close running Claude Code sessions, then run "muninn mcp install".');
  } catch { /* status shouldn't fail on this */ }
  // Claude Code deletes its logs after 30 days, but each scan keeps a compressed copy in ~/.muninn/archive.
  // That only matters if scans have stopped for long enough that logs could go before they're copied.
  try {
    const { archiveDir } = await import("../store/sessions.js");
    const { readdirSync, statSync } = await import("node:fs");
    const newest = readdirSync(archiveDir(), { recursive: true }).map((f) => { try { return statSync(join(archiveDir(), String(f))).mtimeMs; } catch { return 0; } }).reduce((a, b) => Math.max(a, b), 0);
    if (!newest || Date.now() - newest > 20 * 86_400_000) notes.push(`Claude Code deletes session logs after 30 days, and muninn copies them only when it scans. ${newest ? "It hasn't copied any for over 20 days" : "It hasn't copied any yet"}: run "muninn learn --all-repos" so older sessions aren't lost.`);
  } catch { notes.push('Claude Code deletes session logs after 30 days, and muninn copies them only when it scans. Run "muninn learn --all-repos" once so they are kept.'); }
  if (notes.length) { console.log(""); for (const n of notes) console.log(`Note: ${n}`); }
}
export async function keywords() {
  const db = await openDb();
  const kw = await keywordsInUse(db, repoIdentity(process.cwd()));
  if (!kw.length) { console.log("No keywords yet."); return; }
  for (const k of kw) console.log(`${k.pattern.padEnd(24)} ${k.lessons} lesson(s)`);
}
