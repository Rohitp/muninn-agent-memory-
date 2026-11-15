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
  /** How old a handoff can be and still be given to the next session. 0 means no limit. */
  handoffDays: 0,
  /** Past this many days, a handoff is given with a note that it may be out of date. */
  handoffStaleDays: 7,
  handoffsPerRun: 3,
  /** Model for summaries: handoffs, plain lines, answers. "" uses the client default. */
  backgroundModel: "haiku",
  /** Model for deciding what is worth a lesson. "" uses the client default. */
  judgeModel: "",
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
