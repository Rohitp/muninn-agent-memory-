import type { Scan } from "../logs/discover.js";
import type { Session } from "../logs/types.js";

const TOOL: Record<Session["tool"], string> = { "claude-code": "Claude Code", codex: "Codex", cursor: "Cursor", antigravity: "Antigravity" };
const ORDER: Session["tool"][] = ["claude-code", "codex", "cursor", "antigravity"];
/** The scan counts log files under shorter keys. */
const FILES: Record<Session["tool"], keyof Scan["files"]> = { "claude-code": "claude", codex: "codex", cursor: "cursor", antigravity: "antigravity" };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "a, b and c" */
const list = (xs: string[]) => xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
/** "github.com/rohitp/dartboard" → "rohitp/dartboard" */
export const repoLabel = (repo: string) => repo.replace(/^[^/]+\.[^/]+\//, "");
/** "2 Antigravity and 1 Claude Code", for the sessions given. */
const byTool = (sessions: Session[]) => list(ORDER.map((t) => [t, sessions.filter((s) => s.tool === t).length] as const).filter(([, n]) => n).map(([t, n]) => `${n} ${TOOL[t]}`));

/**
 * What muninn learn says before it starts: sessions in this repo first, then a line about the rest of the machine.
 * A log file is one conversation file from an agent; a session is one muninn can learn from: you typed in it and it ran in a git repo.
 */
export function scanSummary(scan: Scan, here: string | null, ignored: Set<string>): string[] {
  const lines: string[] = [];
  const looked = list(ORDER.filter((t) => scan.files[FILES[t]]).map((t) => `${scan.files[FILES[t]]} ${TOOL[t]}`));
  const repos = [...scan.byRepo.keys()].filter((r) => !ignored.has(r));
  const noRepo = scan.missingFolder ? ` ${plural(scan.missingFolder, "session")} you typed in ran outside a git repo, such as a question asked with no project open, so there's no repo to learn them for.` : "";
  if (here) {
    const mine = ignored.has(here) ? [] : scan.byRepo.get(here) ?? [];
    if (ignored.has(here)) lines.push(`This repo, ${repoLabel(here)}: you told muninn to ignore it, so nothing here is read. Undo with "muninn ignore-repo --undo".`);
    else if (mine.length) lines.push(`This repo, ${repoLabel(here)}: reading ${plural(mine.length, "session")} (${byTool(mine)}).`);
    else lines.push(`This repo, ${repoLabel(here)}: no sessions yet. muninn looked through ${looked || "no"} conversation logs on this machine and none of them ran here.`);
    const others = repos.filter((r) => r !== here);
    const n = others.reduce((a, r) => a + scan.byRepo.get(r)!.length, 0);
    if (n || noRepo) lines.push(`Elsewhere on this machine:${n ? ` ${plural(n, "session")} in ${plural(others.length, "other repo")}, learned from on their own as you work there or with "muninn learn --all-repos".` : ""}${noRepo}`);
    return lines;
  }
  const n = repos.reduce((a, r) => a + scan.byRepo.get(r)!.length, 0);
  lines.push(`Looked through ${looked || "no"} conversation logs. Reading ${plural(n, "session")} in ${plural(repos.length, "repo")}:`);
  for (const r of [...repos].sort((a, b) => scan.byRepo.get(b)!.length - scan.byRepo.get(a)!.length)) lines.push(`  ${repoLabel(r)}: ${byTool(scan.byRepo.get(r)!)}`);
  if (noRepo) lines.push(noRepo.trim());
  return lines;
}

/** What one repo's scan found, gathered while it runs so it prints as one block. */
export type RepoReport = {
  repo: string; sessions: number; minSessions: number;
  /** Moments from repeats, corrections, failed commands and the other signals, and what became of them. */
  moments: number; known: number; newLessons: number; noise: number;
  /** Long sessions read in parts by your Claude, if it ran. */
  review: { calls: number; sessions: number; added: number; known: number } | null;
  /** Anything else worth saying about this repo, already in words. */
  notes: string[];
};

const matched = (n: number) => (n === 1 ? "1 matched a lesson you already have" : `${n} matched lessons you already have`);
/** One repo's block: what's new first, then how it was found, then anything to look at. */
export function repoBlock(r: RepoReport): string[] {
  const added = r.newLessons + (r.review?.added ?? 0);
  const lines = [`${repoLabel(r.repo)} (${plural(r.sessions, "session")}): ${added ? `${plural(added, "new suggestion")}, waiting in muninn ui.` : "nothing new."}`];
  if (r.moments) lines.push(`  Spotted ${plural(r.moments, "moment")}: ${list([matched(r.known), `${r.newLessons} new`, r.noise ? `${r.noise} judged noise by your Claude` : ""].filter(Boolean))}.`);
  if (r.review?.calls) lines.push(`  Read ${plural(r.review.calls, "part")} of ${plural(r.review.sessions, "long session")}: ${plural(r.review.added, "new suggestion")}${r.review.known ? `, ${matched(r.review.known)}` : ""}.`);
  if (r.sessions < r.minSessions) lines.push(`  Only ${plural(r.sessions, "session")} so far. Something you say again counts once it's in ${r.minSessions} sessions.`);
  for (const n of r.notes) lines.push(`  ${n}`);
  return lines;
}
