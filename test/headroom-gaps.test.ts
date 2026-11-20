import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { deliver, fileCall } from "../src/deliver/hook.js";
import { whySent } from "../src/commands/panel.js";
import { END, findBlock, START, setLessonFile, syncLessonFiles, withBlock } from "../src/deliver/local-file.js";
import { findMoments } from "../src/learn/signals.js";
import { readClaude } from "../src/logs/claude-code.js";
import type { LogEvent, Session } from "../src/logs/types.js";
import { repoIdentity } from "../src/repo/identity.js";
import { openDb } from "../src/store/db.js";
import { createLesson, decide, ensureRepo } from "../src/store/lessons.js";
import { fakeEmbed, tmp, useHome, write } from "./helpers.js";

const at = (d: number, s = 0) => new Date(Date.UTC(2026, 10, d, 10, 0, s)).toISOString();
const sess = (id: string, events: LogEvent[], cwd = "/r"): Session => ({ id, tool: "claude-code", cwd, clientVersion: "1", unknown: 0, events });
const find = (sessions: Session[]) => findMoments(sessions, fakeEmbed, { cutoff: 0.9, minSessions: 2 });
const file = (tool: string, path: string, failed: boolean, output = "", ts = at(1), pattern?: string): LogEvent => ({ k: "file", tool, path, failed, output, ts, ...(pattern ? { pattern } : {}) });
const cmd = (c: string, failed: boolean, output = "", ts = at(1)): LogEvent => ({ k: "cmd", cmd: c, failed, output, ts });

describe("Claude Code reader: file tools and stopped answers", () => {
  it("records reads and searches with their path, and the engineer stopping an answer", () => {
    const f = join(tmp(), "s.jsonl");
    write(f, [
      { type: "user", cwd: "/r", timestamp: "t1", message: { content: "where is the parser?" } },
      { type: "assistant", timestamp: "t2", message: { content: [{ type: "tool_use", id: "a", name: "Read", input: { file_path: "/r/src/parse.ts" } }, { type: "tool_use", id: "b", name: "Grep", input: { pattern: "parse", path: "/r/lib" } }] } },
      { type: "user", timestamp: "t3", message: { content: [{ type: "tool_result", tool_use_id: "a", is_error: true, content: "<tool_use_error>File does not exist.</tool_use_error>" }] } },
      { type: "user", timestamp: "t4", toolUseResult: { filenames: [] }, message: { content: [{ type: "tool_result", tool_use_id: "b", content: "Found 1 file" }] } },
      { type: "user", timestamp: "t5", message: { content: [{ type: "text", text: "[Request interrupted by user]" }] } },
      { type: "user", timestamp: "t6", message: { content: [{ type: "text", text: "[Request interrupted by user for tool use]" }] } },
    ]);
    const s = readClaude(f);
    expect(s.events.map((e) => e.k)).toEqual(["typed", "file", "file", "interrupt"]);
    expect(s.events[1]).toMatchObject({ tool: "read", path: "/r/src/parse.ts", failed: true });
    expect(s.events[2]).toMatchObject({ tool: "grep", path: "/r/lib", pattern: "parse", failed: false });
  });
});

describe("wrong paths", () => {
  it("matches a missing path to where the same file was found, and keeps it once it happens in two sessions", async () => {
    const guess = (id: string, d: number) => sess(id, [
      file("read", "/r/core/Entity.java", true, "File does not exist.", at(d)),
      cmd("ls", false, "", at(d)),
      file("read", "/r/common/Entity.java", false, "", at(d)),
    ]);
    expect((await find([guess("a", 1)])).filter((m) => m.signal === "wrong_path")).toHaveLength(0);
    const m = (await find([guess("a", 1), guess("b", 2)])).filter((x) => x.signal === "wrong_path");
    expect(m).toHaveLength(1);
    expect(m[0]!.text).toContain("Agents looked in `core/` for files that are in `common/`");
    expect(m[0]!.quotes[0]!.quote).toContain("missing: core/Entity.java");
    expect(m[0]!.sessions).toBe(2);
  });
  it("reads missing paths from a shell's 'No such file or directory', including after a cd", async () => {
    const s = (id: string, d: number) => sess(id, [
      cmd("cd /r/app && cat src/config.ts", true, "cat: src/config.ts: No such file or directory", at(d)),
      cmd("cat /r/app/config/config.ts", false, "export {}", at(d)),
    ]);
    const m = (await find([s("a", 1), s("b", 2)])).filter((x) => x.signal === "wrong_path");
    expect(m).toHaveLength(1);
    expect(m[0]!.context).toContain("app/src/config.ts → app/config/config.ts");
  });
  it("doesn't match a different file, or a find made long after the miss", async () => {
    const other = (id: string, d: number) => sess(id, [file("read", "/r/a/x.ts", true, "File does not exist.", at(d)), file("read", "/r/b/y.ts", false, "", at(d))]);
    expect((await find([other("a", 1), other("b", 2)])).filter((x) => x.signal === "wrong_path")).toHaveLength(0);
    const late = (id: string, d: number) => sess(id, [file("read", "/r/a/x.ts", true, "File does not exist.", at(d)), ...Array.from({ length: 13 }, () => cmd("make", false, "", at(d))), file("read", "/r/b/x.ts", false, "", at(d))]);
    expect((await find([late("a", 1), late("b", 2)])).filter((x) => x.signal === "wrong_path")).toHaveLength(0);
  });
  it("finds a file too big to read in one go, in two sessions", async () => {
    const big = (id: string, d: number) => sess(id, [file("read", "/r/server.py", true, "File content (41000 tokens) exceeds maximum allowed tokens (25000).", at(d))]);
    const m = (await find([big("a", 1), big("b", 2)])).filter((x) => x.signal === "big_file");
    expect(m.map((x) => x.text)).toEqual(["`server.py` was too big to read in one go, in 2 sessions"]);
  });
});

describe("skimmed answers", () => {
  const long = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
  // A 300-word answer takes about 72 seconds to read.
  const exchange = (d: number, s: number, replyAfter: number | "stop"): LogEvent[] => [
    { k: "agent", text: long(300), ts: at(d, s) },
    replyAfter === "stop" ? { k: "interrupt", ts: at(d, s + 5) } : { k: "typed", text: "ok do it", ts: at(d, s + replyAfter) },
  ];
  it("counts long answers replied to before they could be read, and answers stopped while written", async () => {
    const events = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((i) => exchange(1, i * 100, i < 3 ? 10 : i === 3 ? "stop" : 90));
    const m = (await find([sess("a", events)])).filter((x) => x.signal === "skimmed");
    expect(m).toHaveLength(1);
    expect(m[0]!.text).toBe("Of 10 long answers, the engineer replied to 3 faster than they could have read them and stopped 1 while they were being written (typical length of those: 300 words)");
  });
  it("says nothing when long answers were read, or there are too few to tell", async () => {
    const read = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((i) => exchange(1, i * 100, 90));
    expect((await find([sess("a", read)])).filter((x) => x.signal === "skimmed")).toHaveLength(0);
    const few = [0, 1, 2].flatMap((i) => exchange(1, i * 100, 5));
    expect((await find([sess("a", few)])).filter((x) => x.signal === "skimmed")).toHaveLength(0);
  });
});

describe("muninn's part of CLAUDE.local.md", () => {
  it("adds, replaces and removes only its own part, and ignores markers in code examples", () => {
    const block = `${START}\n- one\n${END}`;
    const own = "# My notes\n\nKeep this.\n";
    const added = withBlock(own, block);
    expect(added).toBe(`# My notes\n\nKeep this.\n\n${block}\n`);
    expect(withBlock(added, `${START}\n- two\n${END}`)).toContain("- two");
    expect(withBlock(added, `${START}\n- two\n${END}`)).not.toContain("- one");
    expect(withBlock(added, null)).toBe(own);
    const example = "```\n" + block + "\n```\n";
    expect(findBlock(example)).toBeNull();
    expect(findBlock(`Say ${START} inline\n`)).toBeNull();
  });
});

describe("the lesson file setting", () => {
  let root = ""; let repo = "";
  beforeEach(async () => {
    useHome(); root = join(tmp(), "repo"); mkdirSync(root); execFileSync("git", ["init", "-q", root]);
    repo = repoIdentity(root)!; await ensureRepo(await openDb(), repo, root);
  });
  const lesson = async (text: string, alwaysOn: boolean) => {
    const db = await openDb();
    const id = await createLesson(db, { repo_id: repo, text, source: "manual", status: "live", by: "person" });
    await decide(db, id, { alwaysOn, ...(alwaysOn ? {} : { triggers: ["deploy"] }) });
    return id;
  };
  it("writes always-on lessons for this machine only, keeps the file out of git, and follows lesson changes", async () => {
    const db = await openDb();
    writeFileSync(join(root, "CLAUDE.local.md"), "# Mine\n");
    const id = await lesson("Quote === in zsh --> carefully", true);
    await lesson("Deploy from main", false);
    await setLessonFile(db, repo, "local");
    const text = readFileSync(join(root, "CLAUDE.local.md"), "utf8");
    expect(text.startsWith("# Mine\n")).toBe(true);
    expect(text).toContain("- Quote === in zsh --&gt; carefully");
    expect(text).not.toContain("Deploy from main");
    expect(execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" })).toBe("");
    await decide(db, id, { status: "retired" });
    await syncLessonFiles(db);
    expect(readFileSync(join(root, "CLAUDE.local.md"), "utf8")).toContain("- None yet.");
    await setLessonFile(db, repo, "off");
    expect(readFileSync(join(root, "CLAUDE.local.md"), "utf8")).toBe("# Mine\n");
  });
  it("removes the file when muninn's part was all it held, and writes nothing while off", async () => {
    const db = await openDb();
    await syncLessonFiles(db);
    expect(existsSync(join(root, "CLAUDE.local.md"))).toBe(false);
    await setLessonFile(db, repo, "local");
    await setLessonFile(db, repo, "off");
    expect(existsSync(join(root, "CLAUDE.local.md"))).toBe(false);
  });
  it("stops Claude Code being sent the same always-on lessons at session start, but not Codex", async () => {
    await lesson("Quote === in zsh", true);
    const db = await openDb();
    await setLessonFile(db, repo, "local");
    const start = (client: string, id: string) => deliver(db, client, { hook_event_name: "SessionStart", source: "startup", session_id: id, cwd: root });
    expect(await start("claude-code", "s1") ?? "").not.toContain("Quote === in zsh");
    expect(await start("codex", "s2")).toContain("Quote === in zsh");
    // Still logged as told, from the file, so the panel can say so.
    const told = (await db.execute("SELECT trigger_id, tokens FROM deliveries WHERE session='s1' AND outcome='sent'")).rows;
    expect(told.map((r) => [r.trigger_id, r.tokens])).toEqual([["CLAUDE.local.md", 0]]);
    expect(whySent("SessionStart", "startup", "CLAUDE.local.md")).toBe("always-on, read from CLAUDE.local.md");
  });
});

describe("live loop warning for file tools", () => {
  beforeEach(() => { useHome(); });
  it("names a failed read or search the way a person would", () => {
    expect(fileCall({ tool_name: "Read", cwd: "/r", tool_input: { file_path: "/r/src/a.ts" } })?.cmd).toBe("read src/a.ts");
    expect(fileCall({ tool_name: "Grep", cwd: "/r", tool_input: { pattern: "parse", path: "/r/lib" } })?.cmd).toBe("grep 'parse' in lib");
    expect(fileCall({ tool_name: "Bash", tool_input: { command: "ls" } })).toBeNull();
  });
  it("tells the agent on the third failed read of the same missing file, and not for different files", async () => {
    const db = await openDb();
    const cwd = tmp();
    const read = (path: string) => deliver(db, "claude-code", { hook_event_name: "PostToolUseFailure", session_id: "s1", cwd, tool_name: "Read", tool_input: { file_path: `${cwd}/${path}` }, error: "File does not exist." });
    expect(await read("a.ts")).toBeNull();
    expect(await read("b.ts")).toBeNull();
    expect(await read("a.ts")).toBeNull();
    expect(await read("a.ts")).toContain("`read a.ts` has failed 3 times in a row");
  });
});
