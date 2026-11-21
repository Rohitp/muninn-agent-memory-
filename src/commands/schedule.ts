import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureHome } from "../config.js";

/**
 * A macOS background job (a launchd "LaunchAgent") that asks muninn every few hours whether a scan is due.
 * Scans otherwise start only when a Claude Code or Codex session ends, so days spent only in Antigravity or
 * Cursor would wait for one. The job runs the same scan as those hooks, which does nothing unless one is due
 * (24 hours, or 5 new session logs) and nothing while muninn is paused.
 */
export const LABEL = "dev.secondnature.muninn.scan";
export const EVERY_HOURS = 3;
const agentsDir = () => process.env.MUNINN_LAUNCH_AGENTS ?? join(homedir(), "Library", "LaunchAgents");
export const plistPath = () => join(agentsDir(), `${LABEL}.plist`);
/** Tests write the file without loading it into launchd. */
const launchctl = (...a: string[]) => { if (!process.env.MUNINN_LAUNCH_AGENTS) execFileSync("launchctl", a, { stdio: "ignore" }); };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function plist(node: string, cli: string, log: string): string {
  // launchd starts jobs with a bare PATH; muninn needs git, and your claude or codex to write lessons.
  const path = [dirname(node), join(homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].join(":");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${esc(node)}</string><string>${esc(cli)}</string><string>learn</string><string>--auto</string><string>--all-repos</string></array>
  <key>StartInterval</key><integer>${EVERY_HOURS * 3600}</integer>
  <key>RunAtLoad</key><false/>
  <key>LowPriorityIO</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${esc(path)}</string></dict>
  <key>StandardOutPath</key><string>${esc(log)}</string>
  <key>StandardErrorPath</key><string>${esc(log)}</string>
</dict>
</plist>
`;
}

export const scheduleOn = () => existsSync(plistPath());
/** The job is a macOS LaunchAgent; elsewhere scans start only when a session ends, or when you ask. */
export const scheduleSupported = () => process.platform === "darwin" || !!process.env.MUNINN_LAUNCH_AGENTS;

/** Installs or removes the job without printing, for the command and the page. Returns whether it changed anything. */
export function setSchedule(on: boolean): boolean {
  if (!scheduleSupported()) throw new Error("The background job is for macOS only.");
  const file = plistPath();
  if (!on) {
    if (!existsSync(file)) return false;
    try { launchctl("bootout", `gui/${process.getuid?.()}`, file); } catch { /* not loaded */ }
    rmSync(file);
    return true;
  }
  const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js");
  mkdirSync(dirname(file), { recursive: true });
  if (existsSync(file)) { try { launchctl("bootout", `gui/${process.getuid?.()}`, file); } catch { /* not loaded */ } }
  writeFileSync(file, plist(process.execPath, cli, join(ensureHome(), "background.log")));
  launchctl("bootstrap", `gui/${process.getuid?.()}`, file);
  return true;
}

export function schedule(sub: string) {
  if (!scheduleSupported()) { console.log("The background job is for macOS. Elsewhere, scans start when a Claude Code or Codex session ends, or with muninn learn."); return; }
  if (sub === "off") {
    console.log(setSchedule(false) ? "Removed muninn's background job. Scans start again only when a Claude Code or Codex session ends, or when you ask." : "The background job isn't installed.");
    return;
  }
  if (sub === "on") {
    setSchedule(true);
    console.log(`Installed muninn's background job (${plistPath()}). Every ${EVERY_HOURS} hours it checks whether a scan is due, so Antigravity and Cursor sessions are scanned even on days without Claude Code. Remove it with "muninn schedule off".`);
    return;
  }
  console.log(scheduleOn() ? `On: every ${EVERY_HOURS} hours muninn checks whether a scan is due. "muninn schedule off" removes it.` : `Off. "muninn schedule on" adds a macOS background job that checks every ${EVERY_HOURS} hours whether a scan is due.`);
}
