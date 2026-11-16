import { describe, expect, it } from "vitest";
import { findMoments, type Signal } from "../src/learn/signals.js";
import type { LogEvent, Session } from "../src/logs/types.js";
import { fakeEmbed } from "./helpers.js";

/**
 * Known cases: real situations from session logs (names and paths changed), each marked with what muninn should
 * find. Every false detection found in use is added here as a case that must stay quiet, so it can't come back,
 * and every true one as a case that must still be caught. Add to this list; don't loosen it.
 */
type Case = { name: string; why: string; events: LogEvent[]; expect: Partial<Record<Signal, number>> };

let t = 0;
const ts = () => `2026-11-16T10:${String(Math.floor(t / 60) % 60).padStart(2, "0")}:${String(t++ % 60).padStart(2, "0")}.000Z`;
const ran = (cmd: string, output: string, failed = false): LogEvent => ({ k: "cmd", cmd, failed, output, ts: ts() });
const lines = (prefix: string, from: number, n: number) => Array.from({ length: n }, (_, i) => `${prefix} line ${from + i} of the build log`).join("\n");

const CASES: Case[] = [
  {
    name: "different edit scripts that each trim their output",
    why: "Nov 16: 30 different `python3 - <<'EOF'` edit scripts, each ending `| head -3`, became a false re-fetch lesson because only first lines were compared.",
    events: [1, 2, 3, 4, 5].map((i) => ran(`cd /work/app; python3 - <<'EOF'\np='src/file${i}.ts'; s=open(p).read()\ns=s.replace('a${i}','b${i}'); open(p,'w').write(s)\nEOF\ngrep -n "b${i}" src/file${i}.ts | head -${i}`, `${i}:const b${i} = 1`)),
    expect: { refetch: 0, loop: 0, failure_then_fix: 0 },
  },
  {
    name: "reading a long file in separate slices",
    why: "Each slice is printed once, so nothing is read twice.",
    events: [ran("sed -n 1,80p src/app.ts", lines("a", 1, 80)), ran("sed -n 81,160p src/app.ts", lines("a", 81, 80)), ran("sed -n 161,240p src/app.ts", lines("a", 161, 80))],
    expect: { refetch: 0 },
  },
  {
    name: "different scripts failing with the same kind of error",
    why: "Separate scripts that each hit a SyntaxError aren't one command retried blindly.",
    events: ["users", "orders", "invoices"].map((t) => ran(`python3 - <<'EOF'\nimport json\nrows = json.load(open("${t}.json")\nEOF`, `  File "<stdin>", line 2\nSyntaxError: '(' was never closed`, true)),
    expect: { loop: 0, failure_then_fix: 0 },
  },
  {
    name: "harmless failures",
    why: "grep finding nothing and a missing file check are normal, not mistakes.",
    events: [ran("grep -rn foo src", "", true), ran("grep -rn foo src", "", true), ran("ls missing/", "ls: missing/: No such file or directory", true), ran("ls missing/", "ls: missing/: No such file or directory", true)],
    expect: { failure_then_fix: 0, loop: 0, mistake_returned: 0 },
  },
  {
    name: "the same test output read again with a bigger tail",
    why: "A true re-fetch: each bigger tail re-prints what the smaller one showed.",
    events: [ran("make test | tail -5", lines("t", 96, 5)), ran("make test | tail -20", lines("t", 81, 20)), ran("make test | tail -60", lines("t", 41, 60))],
    expect: { refetch: 1 },
  },
  {
    name: "a lint chain failing until the error is fixed",
    why: "A true failure then fix, from a real session: the chain was re-run unchanged before the file was fixed.",
    events: [
      ran("uv run ruff format -q . && uv run ruff check . && uv run pytest -q", "src/a.py:3:1: F401 `os` imported but unused\nFound 1 error.", true),
      ran("uv run ruff format -q . && uv run ruff check . && uv run pytest -q", "src/a.py:3:1: F401 `os` imported but unused\nFound 1 error.", true),
      ran("sed -i '' '3d' src/a.py", ""),
      ran("uv run ruff format -q . && uv run ruff check . && uv run pytest -q", "12 passed"),
    ],
    expect: { failure_then_fix: 1, loop: 0 },
  },
  {
    name: "the same command failing the same way, then dropped",
    why: "A true loop: three identical failures, never fixed.",
    events: [ran("make deploy", "error: missing DEPLOY_TOKEN", true), ran("make deploy", "error: missing DEPLOY_TOKEN", true), ran("make deploy", "error: missing DEPLOY_TOKEN", true), ran("git status", "clean")],
    expect: { loop: 1 },
  },
  {
    name: "a command the engineer stopped twice",
    why: "A true stop: the engineer refused the same command in two sessions.",
    events: [{ ...ran("rm -rf build", "The user doesn't want to proceed with this tool use.", true), stopped: true }, { ...ran("rm -rf build", "The user doesn't want to proceed with this tool use.", true), stopped: true }],
    expect: { stopped: 1 },
  },

  {
    name: "asking what new names mean, in one long session",
    why: "Nov 15-16: across 40 messages the engineer asked what 6 things meant (names the agent introduced without saying what they were), with typos.",
    events: [
      { k: "agent", text: "Both tasks are merged. Next up is harder-data.", ts: ts() }, { k: "typed", text: "what is harder-data?", ts: ts() },
      { k: "agent", text: "Run make try-ledger to see it.", ts: ts() }, { k: "typed", text: "what is try-ledger? what does it do?", ts: ts() },
      { k: "agent", text: "The first check screen is next.", ts: ts() }, { k: "typed", text: "whast the flow we're taling about?", ts: ts() },
      { k: "agent", text: "Stamps: matched or in order.", ts: ts() }, { k: "typed", text: "testeed. wht is matched vs in order?", ts: ts() },
      { k: "typed", text: "Yes, keep going", ts: ts() },
    ],
    expect: { confused: 1, friction: 0 },
  },
  {
    name: "reporting that things didn't work as expected",
    why: "Nov 16: the page didn't render, the app got stuck, a permission prompt surprised the engineer.",
    events: [
      { k: "typed", text: "the UI doesnt render well. the lines in the page are all over", ts: ts() },
      { k: "typed", text: "we have bypass permission enabled why are we asking for simple api calls?", ts: ts() },
      { k: "typed", text: "stuck in loading", ts: ts() },
    ],
    expect: { friction: 1, confused: 0 },
  },
  {
    name: "asking what's next, and approvals",
    why: "Asking for the next step isn't confusion, and approving isn't friction.",
    events: ["whats next?", "what's next for this?", "what else is missing?", "Yes, build both", "Push them", "okay. start again"].map((text) => ({ k: "typed" as const, text, ts: ts() })),
    expect: { confused: 0, friction: 0 },
  },
  {
    name: "two questions are not a pattern",
    why: "Fewer than 3 such messages could be any session.",
    events: [{ k: "typed", text: "what is the lab page?", ts: ts() }, { k: "typed", text: "i dont understand this", ts: ts() }],
    expect: { confused: 0 },
  },
];

const session = (events: LogEvent[]): Session => ({ id: "s", tool: "claude-code", cwd: "/work/app", clientVersion: "1", unknown: 0, events: [{ k: "typed", text: "go", ts: "2026-11-16T09:00:00.000Z" }, ...events] });

describe("known cases", () => {
  for (const c of CASES) {
    it(c.name, async () => {
      const found = await findMoments([session(c.events)], fakeEmbed, { cutoff: 0.85, minSessions: 3 });
      for (const [signal, n] of Object.entries(c.expect)) expect(found.filter((m) => m.signal === signal), `${signal}: ${c.why}`).toHaveLength(n!);
    });
  }
});
