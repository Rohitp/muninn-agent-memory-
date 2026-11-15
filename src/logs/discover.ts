import { globSync } from "node:fs";
import { join } from "node:path";
import { logRoots } from "../config.js";
import { repoIdentity } from "../repo/identity.js";
import { readClaude } from "./claude-code.js";
import { readCodex } from "./codex.js";
import { readCursor } from "./cursor.js";
import { isOwnRun, type Session } from "./types.js";

export type Scan = { sessions: Session[]; byRepo: Map<string, Session[]>; missingFolder: number; ownRuns: number; files: { claude: number; codex: number; cursor: number } };

export function logFiles() {
  const roots = logRoots();
  return {
    roots,
    claude: globSync("*/*.jsonl", { cwd: roots.claude }).map((f) => join(roots.claude, f)),
    codex: globSync("**/rollout-*.jsonl", { cwd: roots.codex }).map((f) => join(roots.codex, f)),
    cursor: globSync("*/agent-transcripts/**/*.jsonl", { cwd: roots.cursor }).map((f) => join(roots.cursor, f)),
  };
}
/** Reads one transcript, picking the reader by where the file lives. */
export function readAny(file: string): Session {
  const roots = logRoots();
  if (file.startsWith(roots.cursor) || file.includes("/.cursor/")) return readCursor(file, file.startsWith(roots.cursor) ? roots.cursor : file.slice(0, file.indexOf("/.cursor/") + 17));
  if (file.startsWith(roots.codex) || file.includes("/.codex/") || /rollout-.*\.jsonl$/.test(file)) return readCodex(file);
  return readClaude(file);
}

/** Reads every available log and groups sessions by repo. Agent subprocess logs are skipped. */
export function scanLogs(): Scan {
  const f = logFiles();
  const scan: Scan = { sessions: [], byRepo: new Map(), missingFolder: 0, ownRuns: 0, files: { claude: f.claude.length, codex: f.codex.length, cursor: f.cursor.length } };
  const all = [...f.claude.map(readClaude), ...f.codex.map(readCodex), ...f.cursor.map((x) => readCursor(x, f.roots.cursor))];
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
