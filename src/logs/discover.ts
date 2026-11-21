import { closeSync, globSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import { logRoots } from "../config.js";
import { repoIdentity } from "../repo/identity.js";
import { readClaude } from "./claude-code.js";
import { readCodex } from "./codex.js";
import { readAntigravity } from "./antigravity.js";
import { readCursor, slugToPath } from "./cursor.js";
import { isOwnRun, type Session } from "./types.js";
import { archivedOnly } from "../store/sessions.js";

export type Scan = { sessions: Session[]; byRepo: Map<string, Session[]>; missingFolder: number; ownRuns: number; files: { claude: number; codex: number; cursor: number; antigravity: number } };

export function logFiles() {
  const roots = logRoots();
  return {
    roots,
    claude: globSync("*/*.jsonl", { cwd: roots.claude }).map((f) => join(roots.claude, f)),
    codex: globSync("**/rollout-*.jsonl", { cwd: roots.codex }).map((f) => join(roots.codex, f)),
    cursor: globSync("*/agent-transcripts/**/*.jsonl", { cwd: roots.cursor }).map((f) => join(roots.cursor, f)),
    antigravity: globSync("{antigravity,antigravity-ide,antigravity-cli}/brain/*/.system_generated/logs/transcript.jsonl", { cwd: roots.antigravity }).map((f) => join(roots.antigravity, f)),
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
  const scan: Scan = { sessions: [], byRepo: new Map(), missingFolder: 0, ownRuns: 0, files: { claude: f.claude.length, codex: f.codex.length, cursor: f.cursor.length, antigravity: f.antigravity.length } };
  const all = [...f.claude.map(readClaude), ...f.codex.map(readCodex), ...f.cursor.map((x) => readCursor(x, f.roots.cursor)), ...f.antigravity.map(readAntigravity)];
  // Sessions whose log the tool has since deleted, read from muninn's compressed copy.
  for (const a of archivedOnly()) { try { all.push(a.tool === "claude" ? readClaude(a.file) : readCodex(a.file)); } catch { /* a damaged copy */ } }
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

/** The working folder a log was recorded in, read from the first part of the file only, so it's quick. */
function folderOf(file: string, tool: "claude" | "codex" | "cursor", cursorRoot: string): string | null {
  if (tool === "cursor") return slugToPath(file.slice(cursorRoot.length + 1).split(/[\\/]/)[0] ?? "");
  let head = "";
  try {
    const fd = openSync(file, "r");
    const buf = Buffer.alloc(65536);
    const n = readSync(fd, buf, 0, buf.length, 0);
    closeSync(fd);
    head = buf.subarray(0, n).toString("utf8");
  } catch { return null; }
  const m = head.match(/"cwd"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) return null;
  try { return JSON.parse(`"${m[1]}"`); } catch { return null; }
}

/**
 * Every repo you have sessions in on this machine, from the logs themselves, without a scan.
 * The page lists these so a repo shows up whether or not muninn has learned anything there yet.
 */
export function reposInLogs(): Map<string, string> {
  const f = logFiles();
  const folders = new Set<string>();
  for (const [tool, files] of [["claude", f.claude], ["codex", f.codex], ["cursor", f.cursor]] as const) {
    for (const file of files) { const d = folderOf(file, tool, f.roots.cursor); if (d) folders.add(d); }
  }
  // Antigravity logs don't record a folder: it's worked out from the files the agent touched.
  for (const file of f.antigravity) { try { const d = readAntigravity(file).cwd; if (d) folders.add(d); } catch { /* unreadable log */ } }
  const repos = new Map<string, string>();
  for (const d of folders) { const r = repoIdentity(d); if (r && !repos.has(r)) repos.set(r, d); }
  return repos;
}
