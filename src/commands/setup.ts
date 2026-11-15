import { createInterface } from "node:readline/promises";
import { enableCursor } from "../deliver/cursor.js";
import { logFiles } from "../logs/discover.js";
import { readCursor } from "../logs/cursor.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";
import { ensureRepo } from "../store/lessons.js";
import { uiDetached } from "../ui/detach.js";
import { codexPresent, install } from "./install.js";
import { learn } from "./learn.js";

const ask = async (q: string, def = true) => {
  if (!process.stdin.isTTY) return def;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`${q} (${def ? "Y/n" : "y/N"}) `)).trim().toLowerCase();
  rl.close();
  return a ? a.startsWith("y") : def;
};

/**
 * One command from nothing to a first look: hooks for Claude Code and Codex, Cursor rules for repos
 * Cursor is used in, a first scan of every repo, and the review page open in the browser.
 */
export async function setup(args: string[]) {
  console.log(`muninn learns from your coding sessions and gives your agents what you've taught them.

What it reads: your Claude Code, Codex and Cursor session logs, on this machine.
What it sends: redacted excerpts to your own Claude Code (or Codex) to write lessons. Nothing else leaves this machine.
What it changes: adds hooks to Claude Code${codexPresent() ? " and Codex" : ""}, and rules files in repos you use Cursor in.
Nothing reaches an agent until you keep it.
`);
  if (!(await ask("Set it up?"))) { console.log("Stopped. Nothing was changed."); return; }

  let step = 0;
  const heading = (t: string) => console.log(`\n${++step}. ${t}`);
  heading("Hooks");
  install();

  const f = logFiles();
  const cursorRepos = new Map<string, string>();
  for (const file of f.cursor) { const s = readCursor(file, f.roots.cursor); const r = s.cwd ? repoIdentity(s.cwd) : null; if (r && !cursorRepos.has(r)) cursorRepos.set(r, s.cwd); }
  if (cursorRepos.size) {
    heading(`Cursor: you've used it in ${cursorRepos.size} repo(s): ${[...cursorRepos.keys()].map((r) => r.split("/").pop()).join(", ")}.`);
    if (await ask("Write kept lessons as Cursor rules in those repos? The files stay out of git.")) {
      const db = await openDb();
      for (const [repo, cwd] of cursorRepos) { await ensureRepo(db, repo, cwd); try { await enableCursor(db, repo); } catch { /* a moved repo shouldn't stop setup */ } }
      console.log("   Done.");
    }
  }

  heading("First scan of every repo. This reads your logs and asks your Claude to write lessons, so it takes a few minutes.");
  const waiting = await learn({ allRepos: true, noReview: true });
  if (!waiting) { console.log("\nNothing to review yet. muninn scans again on its own as you work."); return; }

  if (args.includes("--no-open")) return;
  heading(`Opening the review page: ${waiting} lesson(s) to look at. Keep what's useful, usually one click each.`);
  try { console.log(`   ${await uiDetached({ open: true })}`); }
  catch (e) { console.log(`   Couldn't open it: ${e instanceof Error ? e.message : String(e)}. Run "muninn ui".`); }
  console.log('\nIn Claude Code, the muninn panel shows what was sent and why. Later, "muninn status" checks everything is working.');
}
