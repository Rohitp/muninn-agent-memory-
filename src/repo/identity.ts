import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const cache = new Map<string, string | null>();
const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

export function cleanRemote(url: string): string {
  return url.trim().replace(/^[a-z+]+:\/\//i, "").replace(/^[^@/]+@/, "").replace(/^([^/:]+):/, "$1/").replace(/\.git$/, "").replace(/\/$/, "").toLowerCase();
}

/** Repo identity for a directory, or null if it is gone or not in a repo. */
export function repoIdentity(dir: string): string | null {
  if (cache.has(dir)) return cache.get(dir)!;
  let id: string | null = null;
  if (existsSync(dir)) {
    try {
      const common = resolve(dir, git(dir, "rev-parse", "--git-common-dir"));
      try { id = cleanRemote(git(dir, "remote", "get-url", "origin")); } catch { id = dirname(common); }
    } catch { id = null; }
  }
  cache.set(dir, id);
  return id;
}
