import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** How a client starts the server: this Node, this muninn, "mcp". The same Node the hooks use. */
export function serverCommand(): { command: string; args: string[] } {
  const p = join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js");
  const cli = existsSync(p) ? realpathSync(p) : p;
  return { command: realpathSync(process.execPath), args: [cli, "mcp"] };
}
/** The Claude desktop app's MCP settings file (or the one tests point at). */
export const desktopConfig = () => process.env.MUNINN_DESKTOP_CONFIG ?? join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
const hasClaude = () => spawnSync("claude", ["--version"], { stdio: "ignore" }).status === 0;

/** Registers muninn's MCP server with Claude Code (for every project) and the Claude desktop app. */
export function installMcp(): string[] {
  const { command, args } = serverCommand();
  const done: string[] = [];
  if (!process.env.MUNINN_DESKTOP_CONFIG && hasClaude()) {
    spawnSync("claude", ["mcp", "remove", "--scope", "user", "muninn"], { stdio: "ignore" });
    execFileSync("claude", ["mcp", "add", "--scope", "user", "muninn", "--", command, ...args], { stdio: "ignore" });
    done.push("Claude Code (every project)");
  }
  const file = desktopConfig();
  if (existsSync(dirname(file))) {
    let cfg: Record<string, any> = {};
    if (existsSync(file)) {
      try { cfg = JSON.parse(readFileSync(file, "utf8")); } catch { throw new Error(`${file} isn't valid JSON, so muninn left it alone.`); }
      copyFileSync(file, `${file}.muninn-backup`);
    }
    cfg.mcpServers = { ...(cfg.mcpServers ?? {}), muninn: { command, args } };
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
    done.push("the Claude desktop app (restart it to pick this up)");
  }
  return done;
}
export function uninstallMcp(): string[] {
  const done: string[] = [];
  if (!process.env.MUNINN_DESKTOP_CONFIG && hasClaude() && spawnSync("claude", ["mcp", "remove", "--scope", "user", "muninn"], { stdio: "ignore" }).status === 0) done.push("Claude Code");
  const file = desktopConfig();
  if (existsSync(file)) {
    try {
      const cfg = JSON.parse(readFileSync(file, "utf8"));
      if (cfg.mcpServers?.muninn) { delete cfg.mcpServers.muninn; writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n"); done.push("the Claude desktop app"); }
    } catch { /* leave a file muninn can't read alone */ }
  }
  return done;
}

/** muninn mcp                serve (Claude starts this; you don't need to)
 *  muninn mcp install        add it to Claude Code and the Claude desktop app
 *  muninn mcp uninstall */
export async function mcpCmd(args: string[]) {
  if (args[0] === "install") {
    const done = installMcp();
    const { command, args: a } = serverCommand();
    console.log(done.length ? `Added muninn's MCP server to ${done.join(" and ")}. Ask Claude about your past work in any chat, for example "what did we decide about the npm name?".` : "Found neither the claude command nor the Claude desktop app.");
    console.log(`For Cursor or another app, add an MCP server that runs:\n  ${command} ${a.join(" ")}`);
    return;
  }
  if (args[0] === "uninstall") { const d = uninstallMcp(); console.log(d.length ? `Removed muninn's MCP server from ${d.join(" and ")}.` : "It wasn't added anywhere."); return; }
  if (process.stdin.isTTY) { console.error('This is the MCP server, which chat apps start themselves. To add it to Claude: muninn mcp install'); process.exitCode = 1; return; }
  const { serveMcp } = await import("./server.js");
  await serveMcp();
}
