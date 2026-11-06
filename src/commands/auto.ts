import { spawn } from "node:child_process";
import { closeSync, existsSync, globSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureHome, isPaused, logRoots, settings } from "../config.js";

const stampFile = () => join(ensureHome(), "last-auto.json");
const lockFile = () => join(ensureHome(), "auto.lock");

export function countLogs(): number {
  const r = logRoots();
  return globSync("*/*.jsonl", { cwd: r.claude }).length + globSync("**/rollout-*.jsonl", { cwd: r.codex }).length;
}
/** Whether a scan is due: at most once a day, or after enough new sessions. */
export function scanDue(now = Date.now()): boolean {
  const cfg = settings();
  if (!cfg.autoLearn || isPaused() || process.env.MUNINN_INTERNAL) return false;
  if (!existsSync(stampFile())) return true;
  const { at, logs } = JSON.parse(readFileSync(stampFile(), "utf8"));
  return now - at >= cfg.autoMinHours * 3_600_000 || countLogs() - logs >= cfg.autoMinNewSessions;
}
export function takeLock(now = Date.now()): boolean {
  const f = lockFile();
  if (existsSync(f) && now - statSync(f).mtimeMs < 3_600_000) return false;
  rmSync(f, { force: true });
  try { closeSync(openSync(f, "wx")); return true; } catch { return false; }
}
export const releaseLock = () => rmSync(lockFile(), { force: true });
export const stamp = (now = Date.now()) => writeFileSync(stampFile(), JSON.stringify({ at: now, logs: countLogs() }));

/** Called from the SessionEnd hook. Returns at once, leaving a separate process to scan. */
export function startAutoScan() {
  if (!scanDue()) return;
  const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js");
  const child = spawn(process.execPath, [cli, "learn", "--auto", "--all-repos"], { detached: true, stdio: "ignore", env: { ...process.env, MUNINN_INTERNAL: "" } });
  child.unref();
}
