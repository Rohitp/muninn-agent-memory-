import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const settingsFile = () => process.env.MUNINN_CLAUDE_SETTINGS ?? join(homedir(), ".claude", "settings.json");
const cli = () => { const p = join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js"); return existsSync(p) ? realpathSync(p) : p; };
const hookCommand = () => `"${realpathSync(process.execPath)}" "${cli()}" hook --client claude-code`;
const isOurs = (h: any) => typeof h?.command === "string" && h.command.includes("hook --client") && h.command.includes("cli.js");
export const DELIVERY_EVENTS: Record<string, string | undefined> = { SessionStart: undefined, UserPromptSubmit: undefined, PostToolUseFailure: "Bash", SubagentStart: undefined };
export const ALL_EVENTS = [...Object.keys(DELIVERY_EVENTS), "SessionEnd"];

function read(file: string): any {
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch { throw new Error(`${file} isn't valid JSON, so muninn left it alone.`); }
}
/** Adds muninn's hooks for Claude Code, keeping every other hook. Codex follows once its hook file is checked live. */
export function install(events = ALL_EVENTS) {
  const file = settingsFile();
  const cfg = read(file);
  cfg.hooks ??= {};
  const added: string[] = [];
  for (const ev of events) {
    const list: any[] = (cfg.hooks[ev] ??= []);
    if (list.some((g) => g.hooks?.some(isOurs))) continue;
    const matcher = DELIVERY_EVENTS[ev];
    list.push({ ...(matcher ? { matcher } : {}), hooks: [{ type: "command", command: hookCommand(), timeout: 5 }] });
    added.push(ev);
  }
  if (!added.length) { console.log("muninn's hooks are already installed."); return; }
  if (existsSync(file)) copyFileSync(file, `${file}.muninn-backup`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`Added muninn hooks to ${file} for ${added.join(", ")}. The previous file is saved next to it as .muninn-backup.`);
  if (added.includes("SessionEnd")) console.log('Automatic scans send redacted excerpts to your Claude Code or Codex. Turn them off with "autoLearn": false in muninn\'s config.json.');
  console.log("Cursor also runs hooks from this file. muninn tries to spot Cursor and send nothing there, but that hasn't been tested.");
}
export const installLearnHook = () => install(["SessionEnd"]);
export function uninstall() {
  const file = settingsFile();
  const cfg = read(file);
  if (!cfg.hooks) return;
  for (const ev of Object.keys(cfg.hooks)) {
    const kept = (cfg.hooks[ev] as any[]).map((g) => ({ ...g, hooks: (g.hooks ?? []).filter((h: any) => !isOurs(h)) })).filter((g) => g.hooks.length);
    if (kept.length) cfg.hooks[ev] = kept; else delete cfg.hooks[ev];
  }
  if (!Object.keys(cfg.hooks).length) delete cfg.hooks;
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
}
export const removeLearnHook = uninstall;
export function installed(): string[] {
  const cfg = read(settingsFile());
  return ALL_EVENTS.filter((ev) => (cfg.hooks?.[ev] ?? []).some((g: any) => g.hooks?.some(isOurs)));
}
