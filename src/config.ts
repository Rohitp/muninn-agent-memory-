import { existsSync, mkdirSync, chmodSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const home = () => process.env.MUNINN_HOME ?? join(homedir(), ".muninn");
export function ensureHome(): string {
  const h = home();
  mkdirSync(h, { recursive: true });
  chmodSync(h, 0o700);
  return h;
}
export const DEFAULTS = {
  minSessions: 3,
  similarityCutoff: 0.85,
  shownPerRun: 10,
  autoLearn: true,
  autoMinNewSessions: 5,
  autoMinHours: 24,
  maxPerDelivery: 3,
  tokensPerDelivery: 300,
  tokensPerSession: 1000,
  hookLimitMs: 500,
  notesPerRun: 30,
  handoffDays: 7,
  handoffsPerRun: 3,
};
export type Settings = typeof DEFAULTS;
export function settings(): Settings {
  const f = join(home(), "config.json");
  return existsSync(f) ? { ...DEFAULTS, ...JSON.parse(readFileSync(f, "utf8")) } : { ...DEFAULTS };
}
export const logRoots = () => {
  const r = process.env.MUNINN_LOG_ROOT;
  return {
    claude: r ? join(r, "claude", "projects") : join(homedir(), ".claude", "projects"),
    codex: r ? join(r, "codex", "sessions") : join(homedir(), ".codex", "sessions"),
    cursor: r ? join(r, "cursor", "projects") : join(homedir(), ".cursor", "projects"),
  };
};
export const isPaused = () => existsSync(join(home(), "paused"));
