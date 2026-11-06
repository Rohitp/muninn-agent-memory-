import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const settingsFile = () => process.env.MUNINN_CLAUDE_SETTINGS ?? join(homedir(), ".claude", "settings.json");
const hookCommand = () => `${process.execPath} ${join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js")} hook --client claude-code`;
const isOurs = (h: any) => typeof h?.command === "string" && h.command.includes("hook --client") && /muninn|cli\.js/.test(h.command);

function read(file: string): any {
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch { throw new Error(`${file} isn't valid JSON, so muninn left it alone.`); }
}
/** Adds the SessionEnd hook for Claude Code. Codex follows once its hook file is checked live. */
export function installLearnHook() {
  const file = settingsFile();
  const cfg = read(file);
  const list: any[] = ((cfg.hooks ??= {}).SessionEnd ??= []);
  if (list.some((g) => g.hooks?.some(isOurs))) { console.log("The learning hook is already installed."); return; }
  if (existsSync(file)) copyFileSync(file, `${file}.muninn-backup`);
  list.push({ hooks: [{ type: "command", command: hookCommand(), timeout: 5 }] });
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`Added a SessionEnd hook to ${file}. A backup is next to it. Automatic scans send redacted excerpts to your client. Turn them off with "autoLearn": false in config.json.`);
}
export function removeLearnHook() {
  const file = settingsFile();
  const cfg = read(file);
  const list: any[] | undefined = cfg.hooks?.SessionEnd;
  if (!list) return;
  const kept = list.map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h: any) => !isOurs(h)) })).filter((g) => g.hooks.length);
  if (kept.length) cfg.hooks.SessionEnd = kept; else delete cfg.hooks.SessionEnd;
  if (!Object.keys(cfg.hooks).length) delete cfg.hooks;
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
}
