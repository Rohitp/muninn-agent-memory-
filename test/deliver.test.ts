import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { deliver, fromCursor, hookOutput, matches } from "../src/deliver/hook.js";
import { openDb } from "../src/store/db.js";
import { createLesson, decide, ensureRepo } from "../src/store/lessons.js";
import { repoIdentity } from "../src/repo/identity.js";
import { tmp, useHome } from "./helpers.js";

let cwd = ""; let repo = "";
beforeEach(() => { useHome(); cwd = join(tmp(), "repo"); mkdirSync(cwd); execFileSync("git", ["init", "-q", cwd]); repo = repoIdentity(cwd)!; });
const lesson = async (text: string, o: { alwaysOn?: boolean; keyword?: string; status?: string; repo?: string | null; global?: boolean } = {}) => {
  const db = await openDb(); await ensureRepo(db, repo, cwd);
  const id = await createLesson(db, { repo_id: o.repo === undefined ? repo : o.repo, text, source: "manual", status: o.status ?? "live", by: "person" });
  await decide(db, id, { alwaysOn: !!o.alwaysOn, ...(o.keyword ? { triggers: [o.keyword] } : {}), ...(o.global ? { global: true } : {}) });
  return id;
};
const run = async (input: Record<string, unknown>) => deliver(await openDb(), "claude-code", { session_id: "s1", cwd, ...input });

describe("matching", () => {
  it("is case-insensitive and needs whole words", () => {
    expect(matches("estimate", "Run the ESTIMATE tests")).toBe(true);
    expect(matches("estimate", "run estimates")).toBe(false);
    expect(matches("c++", "build the c++ code")).toBe(true);
  });
});
describe("deliver", () => {
  it("sends always-on lessons at session start, once per session, and again after compaction", async () => {
    await lesson("Quote === in zsh", { alwaysOn: true });
    expect(await run({ hook_event_name: "SessionStart", source: "startup" })).toContain("Quote === in zsh");
    expect(await run({ hook_event_name: "SessionStart", source: "resume" })).toBeNull();
    expect(await run({ hook_event_name: "SessionStart", source: "compact" })).toContain("Quote === in zsh");
  });
  it("sends keyword lessons on a matching prompt or failed command, and not others", async () => {
    await lesson("Set the API key before estimate tests", { keyword: "estimate" });
    expect(await run({ hook_event_name: "UserPromptSubmit", prompt: "fix the banner" })).toBeNull();
    expect(await run({ hook_event_name: "UserPromptSubmit", prompt: "run the estimate tests" })).toContain("API key");
    expect(await deliver(await openDb(), "claude-code", { session_id: "s2", cwd, hook_event_name: "PostToolUseFailure", tool_input: { command: "pytest estimate" }, error: "Exit code 1" })).toContain("API key");
  });
  it("only sends live lessons for this repo, plus global ones", async () => {
    await lesson("proposed one", { alwaysOn: true, status: "proposed" });
    await ensureRepo(await openDb(), "elsewhere", "/elsewhere");
    await lesson("other repo", { alwaysOn: true, repo: "elsewhere" });
    await lesson("global one", { alwaysOn: true, repo: null, global: true });
    const out = await run({ hook_event_name: "SessionStart", source: "startup" });
    expect(out).toContain("global one");
    expect(out).not.toContain("other repo");
    expect(out).not.toContain("proposed one");
  });
  it("sends at most 3, always-on first, and logs the rest as skipped", async () => {
    for (let i = 0; i < 5; i++) await lesson(`lesson ${i}`, { keyword: "deploy" });
    await lesson("always-on deploy lesson", { keyword: "deploy", alwaysOn: true });
    const out = (await run({ hook_event_name: "UserPromptSubmit", prompt: "deploy it" }))!;
    expect(out.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(3);
    expect(out).toContain("always-on deploy lesson");
    const rows = (await (await openDb()).execute("SELECT outcome, count(*) n FROM deliveries GROUP BY outcome")).rows;
    expect(Object.fromEntries(rows.map((r) => [r.outcome, r.n]))).toMatchObject({ sent: 3, limit: 3 });
  });
  it("tells the agent when lessons are waiting", async () => {
    await lesson("waiting", { status: "proposed" });
    expect(await run({ hook_event_name: "SessionStart", source: "startup" })).toContain("muninn review");
  });
  it("sends nothing to Cursor or while paused, and logs why", async () => {
    await lesson("x", { alwaysOn: true });
    expect(fromCursor({ conversation_id: "c" })).toBe(true);
    expect(await run({ hook_event_name: "SessionStart", source: "startup", conversation_id: "c" })).toBeNull();
    writeFileSync(join(process.env.MUNINN_HOME!, "paused"), "");
    expect(await run({ hook_event_name: "SessionStart", source: "startup" })).toBeNull();
    const rows = (await (await openDb()).execute("SELECT outcome FROM deliveries")).rows.map((r) => r.outcome);
    expect(rows).toEqual(["unsupported_client", "paused"]);
  });
  it("produces Claude Code's output shape", () => {
    expect(JSON.parse(hookOutput("SessionStart", "hi"))).toEqual({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "hi" } });
  });
});

describe("loops caught as they happen", () => {
  it("tells the agent on the 3rd failure in a row with the same error, by a short name, then not again until the 6th", async () => {
    const db = await openDb(); await ensureRepo(db, repo, cwd);
    const fail = (error: string) => deliver(db, "claude-code", { hook_event_name: "PostToolUseFailure", session_id: "s1", cwd, tool_input: { command: "uv run ruff format -q . && uv run ruff check . && make test" }, error });
    expect(await fail("error: 2 files would be reformatted")).toBeNull();
    expect(await fail("error: 2 files would be reformatted")).toBeNull();
    const third = await fail("error: 2 files would be reformatted");
    expect(third).toContain("`ruff format` has failed 3 times in a row");
    expect(third).not.toContain("&&");
    expect(await fail("error: 2 files would be reformatted")).toBeNull();
    // A different error starts the count again.
    expect(await fail("error: no such file")).toBeNull();
    const { panelData } = await import("../src/commands/panel.js");
    const loops = (await panelData(db, "s1", cwd)).loops;
    expect(loops).toEqual([expect.objectContaining({ name: "ruff format", n: 4, told: true })]);
  });
  it("counts loops but doesn't interrupt when muninn only speaks at session start", async () => {
    const db = await openDb(); await ensureRepo(db, repo, cwd);
    const { setDial } = await import("../src/store/dial.js");
    await setDial(db, repo, "start");
    for (let i = 0; i < 3; i++) expect(await deliver(db, "claude-code", { hook_event_name: "PostToolUseFailure", session_id: "s2", cwd, tool_input: { command: "make lint" }, error: "error: boom" })).toBeNull();
    const { panelData } = await import("../src/commands/panel.js");
    expect((await panelData(db, "s2", cwd)).loops[0]).toMatchObject({ name: "make lint", n: 3 });
  });
});
