#!/usr/bin/env node
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureHome } from "./config.js";

const [cmd, ...args] = process.argv.slice(2);
const USAGE = `muninn: lessons that carry across coding sessions

  muninn learn [--all-repos]    Find lessons in your logs and review them
  muninn review                 Review lessons that are waiting
  muninn add "text" [--always-on] [--trigger word] [--global]
  muninn list [--all] [--status proposed|live|rejected|retired]
  muninn show <id>
  muninn edit <id> [--text "..."] [--always-on|--not-always-on] [--trigger word] [--global|--repo-scope]
  muninn retire <id>
  muninn install --learn        Scan automatically after Claude Code sessions end
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
    case "install": {
      if (!args.includes("--learn")) { console.log("Delivery hooks arrive with Stage 2. For now: muninn install --learn"); return; }
      return (await import("./commands/install.js")).installLearnHook();
    }
    case "pause": writeFileSync(join(ensureHome(), "paused"), ""); console.log("Paused."); return;
    case "resume": rmSync(join(ensureHome(), "paused"), { force: true }); console.log("Resumed."); return;
    case "hook": {
      // Hook failures must never interrupt the agent.
      try {
        const input = JSON.parse(readFileSync(0, "utf8") || "{}");
        if ((input.hook_event_name ?? "") === "SessionEnd") (await import("./commands/auto.js")).startAutoScan();
      } catch { /* exit 0 regardless */ }
      return;
    }
    default: console.log(USAGE); if (cmd && cmd !== "help" && cmd !== "--help") process.exitCode = 1;
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; });
