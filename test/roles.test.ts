import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { enableAntigravity } from "../src/deliver/antigravity.js";
import { deliver } from "../src/deliver/hook.js";
import { repoIdentity } from "../src/repo/identity.js";
import { openDb } from "../src/store/db.js";
import { createLesson, decide, ensureRepo } from "../src/store/lessons.js";
import type { Session } from "../src/logs/types.js";
import { feedbackMoments } from "../src/workflow/feedback.js";
import { tmp, useHome } from "./helpers.js";

let root = ""; let repo = "";
beforeEach(async () => {
  useHome(); root = join(tmp(), "factory"); mkdirSync(root); execFileSync("git", ["init", "-q", root]); execFileSync("git", ["-C", root, "commit", "-q", "--allow-empty", "-m", "x"]);
  execFileSync("git", ["-C", root, "remote", "add", "origin", "https://github.com/example/factory.git"]);
  repo = repoIdentity(root)!; await ensureRepo(await openDb(), repo, root);
});
const T = (m: number) => new Date(Date.UTC(2026, 10, 21, 10, m)).toISOString();

describe("agents sending each other's work back", () => {
  it("becomes a moment for the role whose work it was, once it has happened twice", () => {
    const msg = (m: number, text: string) => ({ ts: T(m), dir: "out" as const, from: null, to: [...text.matchAll(/@([\w-]+)/g)].map((x) => x[1]!), text });
    const agent = (id: string, type: string, m: number, messages: ReturnType<typeof msg>[]): Session => ({ id, tool: "antigravity", cwd: root, clientVersion: "1", unknown: 0, parent: "p", agentType: type, events: [{ k: "agent", text: "x", ts: T(m) }], messages });
    const once = [agent("v1", "reviewer", 2, [msg(2, "@builder changes requested: migrations not run against Postgres")])];
    const twice = [...once, agent("v2", "reviewer", 4, [msg(4, "@builder changes requested: schema drift, run migrate first")])];
    const lead = (subs: Session[]): Session => ({ id: "p", tool: "antigravity", cwd: root, clientVersion: "1", unknown: 0, events: [{ k: "typed", text: "go", ts: T(0) }, { k: "agent", text: "ok", ts: T(5) }], subagents: subs });
    expect(feedbackMoments(repo, [lead(once)])).toEqual([]);
    const [m] = feedbackMoments(repo, [lead(twice)]);
    expect(m).toMatchObject({ signal: "sent_back", role: "builder" });
    expect(m!.quotes.map((q) => q.quote)).toEqual(["reviewer sent back: changes requested: migrations not run against Postgres", "reviewer sent back: changes requested: schema drift, run migrate first"]);
  });
});

describe("lessons for a role", () => {
  it("are told only to that role's subagent, and to a session in that role's worktree", async () => {
    const db = await openDb();
    const forAll = await createLesson(db, { repo_id: repo, text: "Use uv for Python", source: "manual", status: "live", by: "person" });
    const forBuilder = await createLesson(db, { repo_id: repo, text: "Builder: run migrate before opening a PR", source: "inferred", signal: "sent_back", status: "live", by: "t", role: "builder" });
    for (const id of [forAll, forBuilder]) await decide(db, id, { alwaysOn: true });
    const told = async (input: Record<string, unknown>) => JSON.stringify(await deliver(db, "claude-code", { session_id: String(Math.random()), cwd: root, ...input }));
    expect(await told({ hook_event_name: "SubagentStart", agent_type: "builder" })).toContain("run migrate");
    expect(await told({ hook_event_name: "SubagentStart", agent_type: "reviewer" })).not.toContain("run migrate");
    expect(await told({ hook_event_name: "SessionStart", source: "startup" })).not.toContain("run migrate");
    execFileSync("git", ["-C", root, "worktree", "add", "-q", join(root, ".worktrees", "builder")]);
    const inWorktree = JSON.stringify(await deliver(db, "claude-code", { hook_event_name: "SessionStart", source: "startup", session_id: "w", cwd: join(root, ".worktrees", "builder") }));
    expect(inWorktree).toContain("run migrate");
    expect(inWorktree).toContain("Use uv");
  });
  it("go into that role's worktree as Antigravity rules, and not into the others", async () => {
    const db = await openDb();
    const id = await createLesson(db, { repo_id: repo, text: "Builder: run migrate before opening a PR", source: "inferred", status: "live", by: "t", role: "builder" });
    await decide(db, id, { alwaysOn: true });
    for (const w of ["builder", "reviewer"]) execFileSync("git", ["-C", root, "worktree", "add", "-q", join(root, ".worktrees", w)]);
    const r = await enableAntigravity(db, repo);
    expect(r?.worktrees).toHaveLength(2);
    const rules = (folder: string) => readFileSync(join(folder, ".agents", "rules", "muninn.md"), "utf8");
    expect(rules(join(root, ".worktrees", "builder"))).toContain("run migrate");
    expect(rules(join(root, ".worktrees", "reviewer"))).not.toContain("run migrate");
    expect(rules(root)).not.toContain("run migrate");
    expect(existsSync(join(root, ".worktrees", "reviewer", ".agents", "rules", "muninn.md"))).toBe(true);
  });
});
