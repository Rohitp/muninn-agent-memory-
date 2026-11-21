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

describe("a repo's folder", () => {
  it("is its main folder, even when first seen from a worktree, and a worktree recorded earlier is corrected", async () => {
    const { mainFolder } = await import("../src/repo/identity.js");
    const db = await openDb();
    const wt = join(root, ".worktrees", "reviewer");
    execFileSync("git", ["-C", root, "worktree", "add", "-q", wt]);
    const real = execFileSync("git", ["-C", root, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
    expect(mainFolder(wt)).toBe(real);
    await db.execute({ sql: "UPDATE repos SET paths=? WHERE id=?", args: [JSON.stringify([wt]), repo] });
    await ensureRepo(db, repo, wt);
    expect(JSON.parse(String((await db.execute({ sql: "SELECT paths FROM repos WHERE id=?", args: [repo] })).rows[0]!.paths))).toEqual([real]);
  });
});

describe("runs, as the page and insights read them", () => {
  it("say how many messages you typed in each session, quote each handoff, and list by repo", async () => {
    const { buildRuns, listRuns, saveRuns } = await import("../src/workflow/runs.js");
    const db = await openDb();
    const lead: Session = { id: "p", tool: "claude-code", cwd: root, clientVersion: "1", unknown: 0, events: [{ k: "typed", text: "build it", ts: T(0) }, { k: "agent", text: "ok", ts: T(6) }],
      subagents: [{ id: "s", tool: "claude-code", cwd: root, clientVersion: "1", unknown: 0, parent: "p", agentType: "reviewer", task: "Review the ledger diff", events: [{ k: "agent", text: "x", ts: T(2) }] }] };
    const runs = buildRuns(repo, [lead]);
    expect(runs[0]!.sessions.map((s) => [s.role, s.typed])).toEqual([["main", 1], ["reviewer", 0]]);
    expect(runs[0]!.handoffs[0]).toMatchObject({ from_role: "main", to_role: "reviewer", evidence: "Review the ledger diff" });
    await saveRuns(db, runs);
    expect((await listRuns(db, repo)).map((r) => r.id)).toEqual([runs[0]!.id]);
  });
});

describe("work fixed after it was approved", () => {
  it("becomes a lesson for the role that approved it, and a send-back quotes its whole sentence", async () => {
    const { sentenceAround } = await import("../src/workflow/runs.js");
    const { REJECTS } = await import("../src/workflow/runs.js");
    expect(REJECTS.test("The schedule's RunTask is rejected (for example, overrides not accepted).")).toBe(false);
    expect(REJECTS.test("Rejecting this PR: the migration is missing.")).toBe(true);
    expect(sentenceAround("Looks fine overall. But the migration is wrong, so changes requested here. Thanks", 50)).toBe("But the migration is wrong, so changes requested here.");
    const msg = (m: number, text: string) => ({ ts: T(m), dir: "out" as const, from: null, to: [...text.matchAll(/@([\w-]+)/g)].map((x) => x[1]!), text });
    const agent = (id: string, type: string, m: number, messages: ReturnType<typeof msg>[]): Session => ({ id, tool: "antigravity", cwd: root, clientVersion: "1", unknown: 0, parent: "p", agentType: type, events: [{ k: "agent", text: "x", ts: T(m) }], messages });
    const lead: Session = { id: "p", tool: "antigravity", cwd: root, clientVersion: "1", unknown: 0, events: [{ k: "typed", text: "go", ts: T(0) }, { k: "agent", text: "ok", ts: T(9) }], subagents: [
      agent("v", "reviewer", 2, [msg(2, "@builder [done] PR #1 APPROVE"), msg(5, "@builder [done] PR #2 APPROVE")]),
      agent("b", "builder", 4, [msg(4, "@everyone PR #2 opened\n- fix: null guard (M1 #3 follow-up)"), msg(7, "@everyone PR #3 opened\n- fix: bad parse (M2 #5 follow-up)")]),
    ] };
    const ms = feedbackMoments(repo, [lead]);
    expect(ms.map((m) => [m.signal, m.role]).sort()).toEqual([["missed", "reviewer"], ["sent_back", "builder"]]);
    expect(ms.find((m) => m.signal === "missed")!.quotes[0]!.quote).toBe("fixed after reviewer approved: - fix: null guard (M1 #3 follow-up)");
  });
});
