#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureHome, home } from "./config.js";

const [cmd, ...args] = process.argv.slice(2);
const USAGE = `muninn: lessons that carry across coding sessions

  muninn learn [--all-repos]    Find lessons in your logs and review them
  muninn review                 Review lessons that are waiting
  muninn add "text" [--always-on] [--trigger word] [--global]
  muninn list [--all] [--status proposed|live|rejected|retired]
  muninn show <id>
  muninn edit <id> [--text "..."] [--always-on|--not-always-on] [--trigger word] [--global|--repo-scope]
  muninn retire <id>
  muninn ask "question"         Search kept lessons and notes in every repo
  muninn handoff [--list]       Where the last session on this branch left off
  muninn setup                  Set everything up and take a first look (start here)
  muninn report [--all]         Did kept lessons work: delivered, and seen again since
  muninn keep <id> | reject <id>  Keep a waiting lesson with muninn's suggested delivery, or reject it
  muninn dial [quiet|start|anytime]  When muninn speaks up to agents here: only when asked,
                                at session start, or whenever relevant
  muninn ui                     Open muninn in your browser
  muninn cursor on|off|sync     Write kept lessons as Cursor rules in this repo
  muninn keywords               Keywords in use, and how many lessons each has
  muninn status                 What muninn has learned and sent, and any problems
  muninn install [--learn]      Add Claude Code and Codex hooks (--learn: only automatic scans)
  muninn uninstall              Remove muninn's hooks
  muninn pause | resume         Stop or restart delivery and automatic scans
  muninn export [file]
  muninn purge --yes`;

const CHANGES = new Set(["learn", "review", "add", "edit", "retire", "keep", "reject"]);

async function cursorCmd(sub: string) {
  const [{ openDb }, { repoIdentity }, c] = await Promise.all([import("./store/db.js"), import("./repo/identity.js"), import("./deliver/cursor.js")]);
  const db = await openDb();
  const repo = repoIdentity(process.cwd());
  if (sub === "sync") { await c.syncCursor(db); console.log("Cursor rules rewritten for every repo that has them on."); return; }
  if (!repo) { console.error("Run this inside a git repo."); process.exitCode = 1; return; }
  if (sub === "off") { await c.disableCursor(db, repo); console.log("Removed muninn's Cursor rules from this repo."); return; }
  if (sub !== "on") { console.error("Usage: muninn cursor on|off|sync"); process.exitCode = 1; return; }
  const { ensureRepo } = await import("./store/lessons.js");
  await ensureRepo(db, repo, process.cwd());
  const r = await c.enableCursor(db, repo);
  if (!r) { console.error("Couldn't find this repo's folder."); process.exitCode = 1; return; }
  console.log(`Wrote ${r.files.join(", ")} in ${r.root}/.cursor/rules. They're listed in .git/info/exclude, so git ignores them without changing any shared file. muninn rewrites them when lessons change.`);
}

/** muninn uses Node 22 features (fs.globSync among them). On older Node, say so plainly instead of crashing on an import. */
function nodeTooOld(): boolean {
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 22) return false;
  console.error(`muninn needs Node 22 or newer. This is Node ${process.versions.node}.
Install Node 22 (for example "fnm install 22", "nvm install 22" or "brew install node@22"), open a new terminal,
then in the muninn folder run: pnpm install && pnpm build && npm link`);
  process.exitCode = 1;
  return true;
}

async function main() {
  if (nodeTooOld() && cmd !== "hook") return;
  switch (cmd) {
    case "learn": {
      const auto = args.includes("--auto");
      const { learn } = await import("./commands/learn.js");
      if (!auto) return learn({ allRepos: args.includes("--all-repos") });
      const { takeLock, releaseLock, stamp, scanDue } = await import("./commands/auto.js");
      // --force is the page's "Check now": run even if a scan isn't due yet.
      if ((!args.includes("--force") && !scanDue()) || !takeLock()) return;
      try { await learn({ allRepos: true, auto: true }); stamp(); } finally { releaseLock(); }
      return;
    }
    case "review": {
      const [{ openDb }, { repoIdentity }, { review }] = await Promise.all([import("./store/db.js"), import("./repo/identity.js"), import("./commands/review.js")]);
      return review(await openDb(), args.includes("--all") ? null : repoIdentity(process.cwd()));
    }
    case "add": return (await import("./commands/lessons.js")).add(args);
    case "list": return (await import("./commands/lessons.js")).list(args);
    case "show": return (await import("./commands/lessons.js")).show(args);
    case "edit": return (await import("./commands/lessons.js")).edit(args);
    case "retire": return (await import("./commands/lessons.js")).retire(args);
    case "export": return (await import("./commands/lessons.js")).exportLessons(args);
    case "purge": return (await import("./commands/lessons.js")).purge(args);
    case "install": { const m = await import("./commands/install.js"); return args.includes("--learn") ? m.installLearnHook() : m.install(); }
    case "uninstall": { (await import("./commands/install.js")).uninstall(); console.log("Removed muninn's hooks. Lessons are kept."); return; }
    case "ask": return (await import("./commands/ask.js")).ask(args);
    case "cursor": return cursorCmd(args[0] ?? "");
    case "handoff": return (await import("./commands/handoff.js")).handoff(args);
    case "report": return (await import("./commands/report.js")).report(args);
    case "setup": return (await import("./commands/setup.js")).setup(args);
    case "panel": return (await import("./commands/panel.js")).panel(args);
    case "keep": return (await import("./commands/panel.js")).keepWithDefaults(args);
    case "reject": return (await import("./commands/panel.js")).reject(args);
    case "dial": return (await import("./commands/panel.js")).dial(args);
    case "feedback": return (await import("./commands/panel.js")).feedback(args);
    case "ui": {
      if (!args.includes("--detach")) return (await import("./ui/server.js")).serve(args);
      console.log(await (await import("./ui/detach.js")).uiDetached({ open: !args.includes("--no-open") }));
      return;
    }
    case "status": return (await import("./commands/status.js")).status();
    case "keywords": return (await import("./commands/status.js")).keywords();
    case "pause": writeFileSync(join(ensureHome(), "paused"), ""); console.log("Paused."); return;
    case "resume": rmSync(join(ensureHome(), "paused"), { force: true }); console.log("Resumed."); return;
    case "hook": return runHook(args[args.indexOf("--client") + 1] ?? "unknown");
    default: console.log(USAGE); if (cmd && cmd !== "help" && cmd !== "--help") process.exitCode = 1;
  }
}
/** Hook failures must never interrupt the agent, so every path exits 0, and the client's own timeout is the hard stop. */
async function runHook(client: string) {
  const errors = (e: unknown) => { try { appendFileSync(join(ensureHome(), "hook-errors.log"), `${new Date().toISOString()} ${client} ${e instanceof Error ? e.message : String(e)}\n`); } catch { /* nothing else to do */ } };
  if (process.env.MUNINN_INTERNAL) return;
  const timer = setTimeout(() => { errors(new Error("timed out")); process.exit(0); }, 500);
  try {
    const input = JSON.parse(readFileSync(0, "utf8") || "{}");
    const event = String(input.hook_event_name ?? "");
    if (event === "SessionEnd") {
      const auto = await import("./commands/auto.js");
      if (typeof input.transcript_path === "string") auto.startHandoff(input.transcript_path, client);
      auto.startAutoScan(); return;
    }
    if (!existsSync(join(home(), "muninn.db"))) return;
    const [{ openDb }, { deliver, hookOutput }] = await Promise.all([import("./store/db.js"), import("./deliver/hook.js")]);
    // Upgrades the database if muninn was updated since, so new code never meets an old schema (a no-op otherwise).
    const db = await openDb({ lockWaitMs: 100 });
    // Codex doesn't document the shape of a Bash result. Keep the first one's shape (types only) to check failure detection.
    if (client === "codex" && event === "PostToolUse") {
      const r = input.tool_response;
      const shape = r && typeof r === "object" ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v])) : typeof r;
      await db.execute({ sql: "INSERT OR IGNORE INTO meta (key,value) VALUES ('codex_tool_response_shape',?)", args: [JSON.stringify(shape)] });
    }
    const text = await deliver(db, client, input);
    if (text) process.stdout.write(hookOutput(event, text));
  } catch (e) { errors(e); }
  finally { clearTimeout(timer); }
}

main().then(async () => {
  if (!CHANGES.has(cmd ?? "") || process.exitCode) return;
  try { const [{ openDb }, { syncCursor }] = await Promise.all([import("./store/db.js"), import("./deliver/cursor.js")]); await syncCursor(await openDb()); } catch { /* Cursor files are a convenience */ }
}).catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; });
