import { createInterface } from "node:readline/promises";
import { loadEmbedder, modelCached, MODEL_SIZE, MODEL_SOURCE } from "../embed/model.js";
import { uiDetached } from "../ui/detach.js";
import { codexPresent } from "./install.js";
import { learn } from "./learn.js";
import { pickRunner } from "../learn/writer.js";

const ask = async (q: string, def = true) => {
  if (!process.stdin.isTTY) return def;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`${q} (${def ? "Y/n" : "y/N"}) `)).trim().toLowerCase();
  rl.close();
  return a ? a.startsWith("y") : def;
};

/**
 * One command from nothing to a first look: every coding tool on this machine connected (connect.ts), the local
 * model, a first scan of every repo (which also turns on Cursor and Antigravity rules where they're used), and the
 * review page open in the browser.
 */
export async function setup(args: string[]) {
  console.log(`secondnature (muninn for short, which is also its command) learns from your coding sessions and gives your agents what you've taught them.

What it reads: your Claude Code, Codex, Cursor and Antigravity session logs, on this machine.
What it sends: redacted excerpts to your own Claude Code (or Codex) to write lessons.
What it downloads: a small local model (${MODEL_SIZE}, from ${MODEL_SOURCE}), once. Nothing else leaves this machine.
What it connects, wherever each is installed:
  - hooks in Claude Code${codexPresent() ? ", Codex" : ""} and Antigravity, so agents are told what you kept at the right moment
  - muninn's MCP server in Claude Code (through its plugin), the Claude desktop app, Cursor, Codex and Antigravity, so agents can ask it questions
  - rules files in repos where you use Cursor or Antigravity (they stay out of git)${process.platform === "darwin" ? "\n  - a background check every few hours on this Mac" : ""}
Nothing reaches an agent until you keep it. "muninn uninstall" undoes the hooks; "muninn connect" re-checks everything.
`);
  if (!(await ask("Set it up?"))) { console.log("Stopped. Nothing was changed."); return; }

  let step = 0;
  const heading = (t: string) => console.log(`\n${++step}. ${t}`);
  heading("Connecting your coding tools");
  const { connectEverything } = await import("./connect.js");
  await connectEverything();

  // Downloaded now, not at the first scan: with no sessions yet that scan stops early, and automatic scans can't ask.
  if (!modelCached()) {
    heading(`Local model (${MODEL_SIZE}). It runs on this machine and spots instructions that mean the same thing.`);
    try { await loadEmbedder(); console.log("   Done."); }
    catch (e) { console.log(`   Couldn't download it: ${e instanceof Error ? e.message : String(e)}. Run "muninn learn --all-repos" later to try again.`); }
  }

  // Without a client, only instructions you repeated word for word can become lessons; say so before the scan, not after.
  const noClient = !pickRunner("judge");
  if (noClient) {
    heading("muninn couldn't find the claude command (or codex). It uses your own Claude Code to write lessons from what it finds.");
    console.log(`   Without it, only instructions you repeated can become lessons. To fix it: install Claude Code's command line tool
   (https://claude.com/claude-code), check that "claude --version" works in a new terminal, then run "muninn learn --all-repos".`);
  }

  heading("First scan of every repo. This reads your logs and asks your Claude to write lessons, so it takes a few minutes.");
  const waiting = await learn({ allRepos: true, noReview: true });
  if (!waiting) { console.log(noClient ? "\nNothing to review yet. Once the claude command works, run \"muninn learn --all-repos\" to look again." : "\nNothing to review yet. muninn scans again on its own as you work."); return; }

  if (args.includes("--no-open")) { console.log(`\n${waiting} lesson(s) to look at. Run "muninn ui" to review them.`); return; }
  heading(`Opening the review page: ${waiting} lesson(s) to look at. Keep what's useful, usually one click each.`);
  try { console.log(`   ${await uiDetached({ open: true })}`); }
  catch (e) { console.log(`   Couldn't open it: ${e instanceof Error ? e.message : String(e)}. Run "muninn ui".`); }
  console.log('\nIn Claude Code, the muninn panel shows what was sent and why. Later, "muninn status" checks everything is working.');
}
