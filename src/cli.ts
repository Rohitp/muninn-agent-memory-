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
  muninn keywords               Keywords in use, and how many lessons each has
  muninn status                 What muninn has learned and sent, and any problems
  muninn install [--learn]      Add Claude Code hooks (--learn: only automatic scans)
  muninn uninstall              Remove muninn's hooks
  muninn pause | resume         Stop or restart delivery and automatic scans
  muninn export [file]
  muninn purge --yes`;

async function main() {
  switch (cmd) {
    case "learn": {
      const auto = args.includes("--auto");
      const { learn } = await import("./commands/learn.js");
      if (!auto) return learn({ allRepos: args.includes("--all-repos") });
      const { takeLock, releaseLock, stamp, scanDue } = await import("./commands/auto.js");
      if (!scanDue() || !takeLock()) return;
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
    if (event === "SessionEnd") { (await import("./commands/auto.js")).startAutoScan(); return; }
    if (!existsSync(join(home(), "muninn.db"))) return;
    const [{ openDb }, { deliver, hookOutput }] = await Promise.all([import("./store/db.js"), import("./deliver/hook.js")]);
    const db = await openDb({ migrate: false, lockWaitMs: 100 });
    const text = await deliver(db, client, input);
    if (text) process.stdout.write(hookOutput(event, text));
  } catch (e) { errors(e); }
  finally { clearTimeout(timer); }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; });
