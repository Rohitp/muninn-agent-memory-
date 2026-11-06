import { globSync } from "node:fs";
import { join } from "node:path";
import { logRoots } from "../config.js";
import { repoIdentity } from "../repo/identity.js";
import { readClaude } from "./claude-code.js";
import { readCodex } from "./codex.js";
import { isOwnRun, type Session } from "./types.js";

export type Scan = { sessions: Session[]; byRepo: Map<string, Session[]>; missingFolder: number; ownRuns: number; files: { claude: number; codex: number } };

/** Reads every available log and groups sessions by repo. Agent subprocess logs are skipped. */
export function scanLogs(): Scan {
  const roots = logRoots();
  const claude = globSync("*/*.jsonl", { cwd: roots.claude }).map((f) => join(roots.claude, f));
  const codex = globSync("**/rollout-*.jsonl", { cwd: roots.codex }).map((f) => join(roots.codex, f));
  const scan: Scan = { sessions: [], byRepo: new Map(), missingFolder: 0, ownRuns: 0, files: { claude: claude.length, codex: codex.length } };
  const all = [...claude.map(readClaude), ...codex.map(readCodex)];
  for (const s of all) {
    if (!s.events.some((e) => e.k === "typed")) continue;
    if (isOwnRun(s)) { scan.ownRuns++; continue; }
    const repo = s.cwd ? repoIdentity(s.cwd) : null;
    if (!repo) { scan.missingFolder++; continue; }
    scan.sessions.push(s);
    if (!scan.byRepo.has(repo)) scan.byRepo.set(repo, []);
    scan.byRepo.get(repo)!.push(s);
  }
  return scan;
}
