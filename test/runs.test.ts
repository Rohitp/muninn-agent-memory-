import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { readAntigravity } from "../src/logs/antigravity.js";
import { readClaude } from "../src/logs/claude-code.js";
import type { Session } from "../src/logs/types.js";
import { buildRuns, roleOf } from "../src/workflow/runs.js";
import { tmp, useHome, write } from "./helpers.js";

beforeEach(() => useHome());
const T = (m: number) => new Date(Date.UTC(2026, 10, 21, 10, m)).toISOString();

describe("subagent logs", () => {
  it("are read with their type and task, never as something you typed, with tokens per reply", () => {
    const dir = join(tmp(), "proj", "parent-1", "subagents");
    write(join(dir, "agent-a1.jsonl"), [
      { isSidechain: true, type: "user", cwd: "/r", timestamp: T(0), message: { role: "user", content: "Review the diff for bugs" } },
      { isSidechain: true, type: "assistant", timestamp: T(1), message: { id: "m1", model: "claude-opus-5-5", content: [{ type: "text", text: "Found one." }], usage: { input_tokens: 100, output_tokens: 20 } } },
      { isSidechain: true, type: "assistant", timestamp: T(1), message: { id: "m1", content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "pnpm test" } }], usage: { input_tokens: 100, output_tokens: 20 } } },
    ]);
    writeFileSync(join(dir, "agent-a1.meta.json"), JSON.stringify({ agentType: "reviewer", description: "Review" }));
    const s = readClaude(join(dir, "agent-a1.jsonl"));
    expect(s).toMatchObject({ parent: "parent-1", agentType: "reviewer", task: "Review: Review the diff for bugs", usage: { input: 100, output: 20 } });
    expect(s.events.some((e) => e.k === "typed")).toBe(false);
    expect(s.events.map((e) => e.k)).toEqual(["agent"]);
  });
});

describe("Antigravity swarms", () => {
  it("read who started an agent, its assignment, and the board messages it posted", () => {
    const f = join(tmp(), "antigravity", "brain", "agent-b", ".system_generated", "logs", "transcript.jsonl");
    write(f, [
      { step_index: 0, source: "SYSTEM", type: "SYSTEM_MESSAGE", created_at: T(0), content: "<SYSTEM_MESSAGE>\n[Message] timestamp=x sender=11111111-aaaa priority=HIGH content=[swarm] new board message #2 </SYSTEM_MESSAGE>" },
      { step_index: 1, source: "SYSTEM", type: "SYSTEM_MESSAGE", created_at: T(0), content: "<SYSTEM_MESSAGE>\n[Message] timestamp=x sender=22222222-bbbb priority=HIGH content=You have just started. You are the Builder.</SYSTEM_MESSAGE>" },
      { step_index: 2, source: "MODEL", type: "PLANNER_RESPONSE", created_at: T(5), input_tokens: 50, output_tokens: 7, tool_calls: [{ name: "post_message", args: { text: JSON.stringify("@reviewer @qa [done] PR #2 opened\n- fix: guard null (M1 #4 follow-up)") } }] },
    ]);
    const s = readAntigravity(f);
    expect(s).toMatchObject({ parent: "22222222-bbbb", task: "You have just started. You are the Builder." });
    expect(s.messages?.filter((m) => m.dir === "out")).toEqual([{ ts: T(5), dir: "out", from: null, to: ["reviewer", "qa"], text: "@reviewer @qa [done] PR #2 opened\n- fix: guard null (M1 #4 follow-up)" }]);
  });
});

const session = (id: string, cwd: string, mins: number[], extra: Partial<Session> = {}): Session => ({
  id, tool: "claude-code", cwd, clientVersion: "1", unknown: 0,
  events: mins.map((m) => ({ k: "cmd", cmd: "ls", failed: false, output: "", ts: T(m) })), turns: mins.map((m) => ({ ts: T(m), input: 10, output: 5 })), ...extra,
});

describe("workflow runs", () => {
  let root = "";
  beforeEach(() => { root = join(tmp(), "shop"); mkdirSync(root); execFileSync("git", ["init", "-q", root]); execFileSync("git", ["-C", root, "commit", "-q", "--allow-empty", "-m", "x"]); });
  it("give worktree sessions their worktree's name as their role", () => {
    execFileSync("git", ["-C", root, "worktree", "add", "-q", join(root, ".worktrees", "builder")]);
    expect(roleOf(session("a", join(root, ".worktrees", "builder"), [0]))).toBe("builder");
    expect(roleOf(session("b", root, [0]))).toBe("main");
  });
  it("cut a session left open into bursts, and put a subagent in its parent's burst", () => {
    const sub = session("sub", root, [3, 4], { parent: "p", agentType: "reviewer" });
    const runs = buildRuns("r", [session("p", root, [0, 5, 200, 210], { subagents: [sub] })]);
    expect(runs.map((r) => r.roles)).toEqual([["main", "reviewer"], ["main"]]);
    expect(runs[0]!.team).toBe(true);
    expect(runs[0]!.tokens_out).toBe(5 * 2 + 5 * 2);
  });
  it("count approvals, send-backs and follow-up fixes from board messages", () => {
    const msg = (m: number, text: string) => ({ ts: T(m), dir: "out" as const, from: null, to: [...text.matchAll(/@([\w-]+)/g)].map((x) => x[1]!), text });
    const builder = session("b", root, [1, 2], { parent: "p", agentType: "builder", messages: [msg(2, "@reviewer [done] PR #2 opened\n- fix: null guard (M1 #4 follow-up)")] });
    const reviewer = session("v", root, [3], { parent: "p", agentType: "reviewer", messages: [msg(3, "@builder changes requested: missing tests")] });
    const qa = session("q", root, [4], { parent: "p", agentType: "qa", messages: [msg(4, "@builder [done] QA PASS on PR #2")] });
    const [run] = buildRuns("r", [session("p", root, [0, 5], { subagents: [builder, reviewer, qa] })]);
    expect(run!.handoffs.map((h) => [h.from_role, h.kind])).toEqual([["builder", "rework"], ["reviewer", "review_rejected"], ["qa", "approved"]]);
    expect(run!.handoffs[0]!.note).toBe("- fix: null guard (M1 #4 follow-up)");
  });
});
