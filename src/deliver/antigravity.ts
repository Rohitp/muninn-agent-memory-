import type { Client } from "@libsql/client";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { cursorRules, type RuleFile } from "./cursor.js";
import { keepOutOfGit, repoRoot } from "./local-file.js";

/**
 * Lessons for Google Antigravity's agent, as rules files in a repo's .agents/rules/ (antigravity.google/docs/rules).
 * The same files muninn writes for Cursor, with Antigravity's frontmatter: lessons told every session become
 * `trigger: always_on`; keyword lessons become `trigger: model_decision`, which the agent reads when their
 * description fits the task. Kept out of git, and rewritten when lessons change. Per repo, off by default.
 */
const PREFIX = "muninn";
const DIR = join(".agents", "rules");
/** Antigravity drops a rules file over 24 KB, so muninn keeps each well under. */
const MAX = 20_000;

/** A Cursor rule file in Antigravity's form: same body, its own frontmatter, .md. */
export function toAntigravity(f: RuleFile): RuleFile {
  const m = f.body.match(/^---\n([\s\S]*?)\n---\n/);
  const head = m?.[1] ?? "";
  const always = /alwaysApply:\s*true/.test(head);
  const desc = head.match(/^description:\s*(.*)$/m)?.[1]?.trim() ?? "";
  const front = always ? "---\ntrigger: always_on\n---\n" : `---\ntrigger: model_decision\ndescription: ${desc}\n---\n`;
  const body = (m ? f.body.slice(m[0].length) : f.body).trimStart();
  return { name: f.name.replace(/\.mdc$/, ".md"), body: (front + "\n" + body).slice(0, MAX) };
}

export async function enabled(db: Client): Promise<string[]> {
  const v = (await db.execute("SELECT value FROM meta WHERE key='antigravity_repos'")).rows[0]?.value;
  return v ? JSON.parse(String(v)) : [];
}
const setEnabled = (db: Client, repos: string[]) => db.execute({ sql: "INSERT OR REPLACE INTO meta (key,value) VALUES ('antigravity_repos',?)", args: [JSON.stringify([...new Set(repos)].sort())] });

/** Writes a repo's rules files, removes muninn's that are no longer needed, and keeps them out of git. */
/** Writes muninn's rules files into one folder, removing muninn's files that are no longer needed. */
async function writeInto(db: Client, repo: string, folder: string, role: string | null): Promise<string[]> {
  const dir = join(folder, DIR);
  mkdirSync(dir, { recursive: true });
  const files = (await cursorRules(db, repo, folder, role)).map(toAntigravity);
  for (const f of files) writeFileSync(join(dir, f.name), f.body);
  const keep = new Set(files.map((f) => f.name));
  for (const f of readdirSync(dir)) if (f.startsWith(PREFIX) && f.endsWith(".md") && !keep.has(f)) rmSync(join(dir, f));
  return [...keep];
}
/** The repo's linked worktrees: an agent team often gives each role its own (.worktrees/builder, .worktrees/reviewer). */
function linkedWorktrees(root: string): string[] {
  try {
    return execFileSync("git", ["-C", root, "worktree", "list", "--porcelain"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n").filter((l) => l.startsWith("worktree ")).map((l) => l.slice(9)).filter((p) => p !== root && existsSync(p));
  } catch { return []; }
}

/**
 * Writes a repo's rules files, removes muninn's that are no longer needed, and keeps them out of git. Each linked
 * worktree gets its own copy, since files git ignores aren't in a worktree: the lessons for every agent, plus the
 * lessons for the role named like the worktree.
 */
export async function writeAntigravityRules(db: Client, repo: string): Promise<{ root: string; files: string[]; worktrees: string[] } | null> {
  const root = await repoRoot(db, repo);
  if (!root) return null;
  try { keepOutOfGit(root, `${DIR}/${PREFIX}*.md`, "lessons for Antigravity on this machine"); } catch { /* not a git repo */ }
  const files = await writeInto(db, repo, root, null);
  const worktrees = linkedWorktrees(root);
  for (const wt of worktrees) { try { await writeInto(db, repo, wt, basename(wt)); } catch { /* a worktree being removed */ } }
  return { root, files, worktrees };
}
export async function enableAntigravity(db: Client, repo: string) {
  await setEnabled(db, [...(await enabled(db)), repo]);
  return writeAntigravityRules(db, repo);
}
export async function disableAntigravity(db: Client, repo: string) {
  const root = await repoRoot(db, repo);
  const dir = root ? join(root, DIR) : null;
  for (const d of [dir, ...(root ? linkedWorktrees(root).map((w) => join(w, DIR)) : [])]) if (d && existsSync(d)) for (const f of readdirSync(d)) if (f.startsWith(PREFIX) && f.endsWith(".md")) rmSync(join(d, f));
  await setEnabled(db, (await enabled(db)).filter((r) => r !== repo));
}
/** Rewrites the files for every repo that has Antigravity on. Called after lessons change. */
export async function syncAntigravity(db: Client) {
  for (const repo of await enabled(db)) { try { await writeAntigravityRules(db, repo); } catch { /* a moved repo shouldn't stop the rest */ } }
}
