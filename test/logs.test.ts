import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readClaude } from "../src/logs/claude-code.js";
import { readCodex } from "../src/logs/codex.js";
import { scanLogs } from "../src/logs/discover.js";
import { OWN_RUN_MARK } from "../src/logs/types.js";
import { tmp, write } from "./helpers.js";

afterEach(() => { delete process.env.MUNINN_LOG_ROOT; });

describe("Claude Code reader", () => {
  it("returns typed text, agent text and failed commands, and skips the rest", () => {
    const f = join(tmp(), "s1.jsonl");
    write(f, [
      { type: "user", cwd: "/r", version: "2.1", timestamp: "t1", message: { content: "use pnpm here" } },
      { type: "user", isMeta: true, message: { content: "meta text" } },
      { type: "user", message: { content: "<command-name>/x</command-name>" } },
      { type: "attachment", attachment: { type: "hook_additional_context", content: "injected lesson" } },
      { type: "assistant", timestamp: "t2", message: { content: [{ type: "text", text: "ok" }, { type: "tool_use", id: "a", name: "Bash", input: { command: "make" } }] } },
      { type: "user", timestamp: "t3", toolUseResult: { stderr: "boom" }, message: { content: [{ type: "tool_result", tool_use_id: "a", is_error: true }] } },
      { type: "brand-new-type" },
      { type: "assistant", timestamp: "t4" },
    ]);
    const s = readClaude(f);
    expect(s.cwd).toBe("/r");
    expect(s.unknown).toBe(1);
    expect(s.events.map((e) => e.k)).toEqual(["typed", "agent", "cmd"]);
    expect(s.events[2]).toMatchObject({ cmd: "make", failed: true, output: "boom" });
    expect(JSON.stringify(s.events)).not.toContain("injected lesson");
  });
});
describe("Codex reader", () => {
  it("reads items and exit codes", () => {
    const f = join(tmp(), "rollout-1.jsonl");
    write(f, [
      { type: "session_meta", payload: { cwd: "/r", cli_version: "0.155" } },
      { type: "event_msg", timestamp: "t1", payload: { type: "item_completed", item: { type: "UserMessage", content: [{ type: "text", text: "use pnpm" }] } } },
      { type: "event_msg", timestamp: "t2", payload: { type: "item_completed", item: { type: "CommandExecution", command: ["make"], exit_code: 2, aggregated_output: "boom" } } },
      { type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<environment_context>x</environment_context>" }] } },
    ]);
    const s = readCodex(f);
    expect(s.clientVersion).toBe("0.155");
    expect(s.events).toHaveLength(2);
    expect(s.events[1]).toMatchObject({ failed: true });
  });
});
describe("scanLogs", () => {
  it("groups by repo, and skips muninn's own runs and missing folders", () => {
    const root = tmp(); process.env.MUNINN_LOG_ROOT = root;
    const repo = join(tmp(), "repo"); mkdirSync(repo);
    execFileSync("git", ["init", "-q", repo]);
    const u = (cwd: string, text: string) => ({ type: "user", cwd, timestamp: "t", message: { content: text } });
    write(join(root, "claude/projects/p/a.jsonl"), [u(repo, "real work")]);
    write(join(root, "claude/projects/p/b.jsonl"), [u(repo, `${OWN_RUN_MARK} write lessons`)]);
    write(join(root, "claude/projects/p/c.jsonl"), [u("/no/such/folder", "gone")]);
    const scan = scanLogs();
    expect(scan.sessions).toHaveLength(1);
    expect(scan.ownRuns).toBe(1);
    expect(scan.missingFolder).toBe(1);
  });
});
