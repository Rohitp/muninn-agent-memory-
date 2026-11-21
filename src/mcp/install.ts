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
/** Whether Claude Code lists muninn among its MCP servers. Null when Claude Code isn't installed here. */
export function claudeHasMuninn(): boolean | null {
  if (process.env.MUNINN_DESKTOP_CONFIG || !hasClaude()) return null;
  return spawnSync("claude", ["mcp", "get", "muninn"], { stdio: "ignore", timeout: 20_000 }).status === 0;
}

/** Antigravity's global MCP settings (antigravity.google/docs/mcp), or the one tests point at. */
export const antigravityConfig = () => process.env.MUNINN_ANTIGRAVITY_MCP ?? join(homedir(), ".gemini", "config", "mcp_config.json");
/** Cursor's global MCP settings, same shape as Antigravity's (docs.cursor.com/context/mcp), or the one tests point at. */
export const cursorConfig = () => process.env.MUNINN_CURSOR_MCP ?? join(homedir(), ".cursor", "mcp.json");
/** Codex's settings (TOML, with [mcp_servers.<name>] tables), or the one tests point at. */
export const codexConfig = () => process.env.MUNINN_CODEX_CONFIG ?? join(homedir(), ".codex", "config.toml");
const tomlStr = (s: string) => JSON.stringify(s);
/** Adds or removes muninn's [mcp_servers.muninn] table in Codex's config.toml, keeping everything else and a backup. */
export function setCodexServer(file: string, entry: { command: string; args: string[] } | null): boolean {
  const raw = existsSync(file) ? readFileSync(file, "utf8") : "";
  // The table runs from its header to the next table header.
  const without = raw.replace(/(^|\n)\[mcp_servers\.muninn\][\s\S]*?(?=\n\[|$)/, "").replace(/\n{3,}/g, "\n\n");
  if (!entry) { if (without === raw) return false; writeFileSync(file, without.trimEnd() + "\n"); return true; }
  if (raw) copyFileSync(file, `${file}.muninn-backup`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${without.trimEnd()}${without.trim() ? "\n\n" : ""}[mcp_servers.muninn]\ncommand = ${tomlStr(entry.command)}\nargs = [${entry.args.map(tomlStr).join(", ")}]\n`);
  return true;
}
/** Adds or removes muninn in a JSON file of the {"mcpServers": {...}} shape, keeping everything else and a backup. */
function setServer(file: string, entry: { command: string; args: string[] } | null): boolean {
  let cfg: Record<string, any> = {};
  if (existsSync(file)) {
    const raw = readFileSync(file, "utf8");
    if (raw.trim()) { try { cfg = JSON.parse(raw); } catch { throw new Error(`${file} isn't valid JSON, so muninn left it alone.`); } }
    if (entry) copyFileSync(file, `${file}.muninn-backup`);
  } else if (!entry) return false;
  if (!entry && !cfg.mcpServers?.muninn) return false;
  const servers = { ...(cfg.mcpServers ?? {}) };
  if (entry) servers.muninn = entry; else delete servers.muninn;
  cfg.mcpServers = servers;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
  return true;
}

/** Registers muninn's MCP server with Claude Code (for every project), the Claude desktop app and Antigravity. */
export function installMcp(): string[] {
  const { command, args } = serverCommand();
  const done: string[] = [];
  if (!process.env.MUNINN_DESKTOP_CONFIG && hasClaude()) {
    spawnSync("claude", ["mcp", "remove", "--scope", "user", "muninn"], { stdio: "ignore" });
    execFileSync("claude", ["mcp", "add", "--scope", "user", "muninn", "--", command, ...args], { stdio: "ignore" });
    // Claude Code sessions already running can rewrite its settings from memory and drop what was just added.
    done.push(claudeHasMuninn() ? "Claude Code (every project)" : "Claude Code, though it doesn't list muninn yet: close running Claude Code sessions and run \"muninn mcp install\" again");
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
  if (existsSync(dirname(antigravityConfig())) && setServer(antigravityConfig(), { command, args })) done.push("Antigravity");
  // Cursor and Codex, where they're installed (their settings folder exists).
  if (existsSync(dirname(cursorConfig())) && setServer(cursorConfig(), { command, args })) done.push("Cursor");
  if (existsSync(dirname(codexConfig())) && setCodexServer(codexConfig(), { command, args })) done.push("Codex");
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
  try { if (setServer(antigravityConfig(), null)) done.push("Antigravity"); } catch { /* leave a file muninn can't read alone */ }
  try { if (setServer(cursorConfig(), null)) done.push("Cursor"); } catch { /* leave a file muninn can't read alone */ }
  try { if (setCodexServer(codexConfig(), null)) done.push("Codex"); } catch { /* leave a file muninn can't read alone */ }
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
    console.log(`Cursor and Codex get it too when they are installed here. For another app, add an MCP server that runs:\n  ${command} ${a.join(" ")}`);
    return;
  }
  if (args[0] === "uninstall") { const d = uninstallMcp(); console.log(d.length ? `Removed muninn's MCP server from ${d.join(" and ")}.` : "It wasn't added anywhere."); return; }
  if (process.stdin.isTTY) { console.error('This is the MCP server, which chat apps start themselves. To add it to Claude: muninn mcp install'); process.exitCode = 1; return; }
  const { serveMcp } = await import("./server.js");
  await serveMcp();
}
