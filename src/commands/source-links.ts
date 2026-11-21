import type { Client } from "@libsql/client";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { Source } from "./answer.js";

/** Somewhere a source can be opened: a page on GitHub, or the session's log on this machine. */
export type SourceLink = { label: string; url?: string; log?: string; mono?: boolean };

/** https://github.com/owner/name for a repo muninn knows by its GitHub address, else null. */
export function githubUrl(repo: string | null | undefined): string | null {
  const m = repo ? /^github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i.exec(repo) : null;
  return m ? `https://github.com/${m[1]}/${m[2]}` : null;
}

/** Commit hashes and pull request numbers a piece of text names. Hashes need a digit and a letter, so words and numbers don't count. */
export function refsIn(text: string): { shas: string[]; prs: number[] } {
  const shas = [...new Set((text.match(/\b[0-9a-f]{7,40}\b/g) ?? []).filter((s) => /\d/.test(s) && /[a-f]/.test(s)))];
  const prs = [...new Set([...text.matchAll(/\b(?:PR|pull request)\s*#?(\d{1,6})\b/gi)].map((m) => Number(m[1])))];
  return { shas, prs };
}

const isCommit = (root: string, sha: string) => {
  try { execFileSync("git", ["-C", root, "cat-file", "-e", `${sha}^{commit}`], { stdio: "ignore", timeout: 2000 }); return true; } catch { return false; }
};

/**
 * Links for each source: the commits and pull requests it names on GitHub (commits only when this machine's
 * checkout has them, so a stray hex word isn't linked), the branch it was on, and a session's log file.
 */
export async function withLinks(db: Client, sources: Source[]): Promise<(Source & { links: SourceLink[] })[]> {
  const roots = new Map<string, string | null>();
  const rootOf = async (repo: string) => {
    if (!roots.has(repo)) {
      const row = (await db.execute({ sql: "SELECT paths FROM repos WHERE id=?", args: [repo] })).rows[0];
      roots.set(repo, row ? ((JSON.parse(String(row.paths)) as string[]).find((p) => existsSync(p)) ?? null) : null);
    }
    return roots.get(repo) ?? null;
  };
  const out = [];
  for (const s of sources) {
    const links: SourceLink[] = [];
    const gh = githubUrl(s.repo);
    let text = s.text;
    // Finished work carries the commit or PR muninn grouped it under.
    if (s.id.startsWith("plan:")) {
      const ref = (await db.execute({ sql: "SELECT o.ref FROM plan_items i JOIN plan_outcomes o ON o.id=i.outcome_id WHERE i.id=?", args: [s.id.slice(5)] }).catch(() => ({ rows: [] }))).rows[0]?.ref;
      if (ref) text += ` ${String(ref)}`;
    }
    if (gh && s.repo) {
      const { shas, prs } = refsIn(text);
      const root = shas.length ? await rootOf(s.repo) : null;
      for (const sha of shas.slice(0, 3)) if (root && isCommit(root, sha)) links.push({ label: sha.slice(0, 7), url: `${gh}/commit/${sha}`, mono: true });
      for (const pr of prs.slice(0, 2)) links.push({ label: `PR #${pr}`, url: `${gh}/pull/${pr}` });
      if (s.branch) links.push({ label: `${s.branch} on GitHub`, url: `${gh}/tree/${encodeURIComponent(s.branch).replace(/%2F/g, "/")}` });
    }
    if (s.kind === "session" && s.session) {
      const f = (await db.execute({ sql: "SELECT file FROM session_files WHERE session=? LIMIT 1", args: [s.session] })).rows[0]?.file;
      if (f && existsSync(String(f))) links.push({ label: "Show the log", log: s.session });
    }
    out.push({ ...s, links });
  }
  return out;
}

/** The log file of a session, if it's still on this machine. */
export async function logFile(db: Client, session: string): Promise<string | null> {
  const f = (await db.execute({ sql: "SELECT file FROM session_files WHERE session=? LIMIT 1", args: [session] })).rows[0]?.file;
  return f && existsSync(String(f)) ? String(f) : null;
}
