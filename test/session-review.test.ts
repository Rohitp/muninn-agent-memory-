import { beforeEach, describe, expect, it } from "vitest";
import type { LogEvent, Session } from "../src/logs/types.js";
import { chunksToReview, REVIEW, reviewSessions } from "../src/learn/session-review.js";
import type { Runner } from "../src/learn/writer.js";
import { openDb } from "../src/store/db.js";
import { ensureRepo } from "../src/store/lessons.js";
import { fakeEmbed, useHome } from "./helpers.js";

const repo = "github.com/me/app";
const at = (m: number) => new Date(Date.UTC(2026, 9, 1, 9, m)).toISOString();

/** A long session: n typed messages, each answered, with two that ask for plain words and a build that failed. */
function longSession(id: string, n: number): Session {
  const events: LogEvent[] = [];
  for (let i = 0; i < n; i++) {
    const text = i === 7 || i === 8 ? "Approve, next section" : i === 3 ? "please explain new names in plain words" : i === 12 ? "again, say what that word means in plain words" : i === 21 ? "the build fails until you run pnpm gen first" : `do step ${i}`;
    events.push({ k: "typed", text, ts: at(i) });
    if (i === 20) events.push({ k: "cmd", cmd: "pnpm build", failed: true, output: "error TS2304: Cannot find name 'Api'", ts: at(i) });
    events.push({ k: "agent", text: i === 5 ? "I think the cache folder is stale" : `Done step ${i}.`, ts: at(i) });
  }
  return { id, tool: "claude-code", cwd: "/x", clientVersion: "1", unknown: 0, events };
}
/** The line number the prompt gives a line containing this text. */
const lineOf = (prompt: string, text: string) => Number(prompt.split("\n").find((l) => l.includes(text))?.match(/^\[(\d+)\]/)?.[1] ?? -1);

/** Your Claude, faked: for the chunk with the plain-words messages, two real items and two that shouldn't pass. */
function fakeRunner(): Runner & { prompts: string[] } {
  const prompts: string[] = [];
  const run = (p: string) => {
    prompts.push(p);
    if (!p.includes("plain words")) return "[]";
    return JSON.stringify([
      { kind: "steer", lesson: "Say what a new name means in plain words when you first use it.", why: "The engineer asked twice.", scope: "global",
        evidence: [{ line: lineOf(p, "please explain new names"), quote: "explain new names in plain words" }, { line: lineOf(p, "again, say what"), quote: "say what that word means" }] },
      { kind: "insight", lesson: "Run pnpm gen before pnpm build: the build needs the generated API types.", why: "The build failed on a missing type.", scope: "repo", keywords: ["pnpm build"],
        evidence: [{ line: lineOf(p, "FAILED COMMAND"), quote: "Cannot find name 'Api'" }, { line: lineOf(p, "pnpm gen first"), quote: "fails until you run pnpm gen" }] },
      // Only the agent's own guess, once: not enough for an insight.
      { kind: "insight", lesson: "Clear the cache folder when things look stale.", scope: "repo", evidence: [{ line: lineOf(p, "cache folder"), quote: "the cache folder is stale" }] },
      // The same approval twice isn't two messages pointing the same way.
      { kind: "steer", lesson: "Write documents one section at a time.", scope: "repo", evidence: [{ line: p.split("\n").filter((l) => /^\[\d+\]/.test(l)).findIndex((l) => l.includes("Approve, next")), quote: "Approve, next section" }, { line: p.split("\n").filter((l) => /^\[\d+\]/.test(l)).findLastIndex((l) => l.includes("Approve, next")), quote: "Approve, next section" }] },
      // A quote that isn't in the log.
      { kind: "steer", lesson: "Always deploy on Fridays.", scope: "repo", evidence: [{ line: 0, quote: "always deploy on fridays please" }, { line: 1, quote: "fridays are for deploys" }] },
    ]);
  };
  return { name: "claude", prompts, run };
}

beforeEach(() => { useHome(); });

describe("reading long sessions in chunks", () => {
  it("leaves short sessions to the other signals, and waits for a last short chunk until the session goes quiet", () => {
    expect(chunksToReview(longSession("short", REVIEW.minTyped - 1), 0)).toEqual([]);
    const s = longSession("long", 45);
    const busy = Date.parse(at(44)) + 60_000; const quiet = Date.parse(at(44)) + REVIEW.quietHours * 3_600_000;
    expect(chunksToReview(s, 0, busy).map((c) => [c.from, c.to])).toEqual([[0, 30]]);
    expect(chunksToReview(s, 0, quiet).map((c) => [c.from, c.to])).toEqual([[0, 30], [30, 45]]);
    expect(chunksToReview(s, 30, quiet).map((c) => [c.from, c.to])).toEqual([[30, 45]]);
    expect(chunksToReview(s, 45, quiet)).toEqual([]);
  });

  it("suggests what checks out, with your words for a steer and who said what for an insight, and reads each part once", async () => {
    const db = await openDb(); await ensureRepo(db, repo, "/x");
    const runner = fakeRunner();
    const r = await reviewSessions(db, repo, [longSession("s1", 45)], runner, fakeEmbed, { cutoff: 0.85, now: Date.parse(at(44)) + 7 * 3_600_000 });
    expect(r).toMatchObject({ sessions: 1, calls: 2, added: 2 });
    const rows = (await db.execute({ sql: "SELECT id, text, signal, kind, status, suggested_scope, why FROM lessons ORDER BY signal", args: [] })).rows;
    expect(rows.map((x) => [x.signal, x.kind, x.status, x.suggested_scope])).toEqual([["noticed", "note", "proposed", "repo"], ["steered", "rule", "proposed", "global"]]);
    const ev = async (signal: string) => (await db.execute({ sql: "SELECT quote FROM evidence WHERE lesson_id=(SELECT id FROM lessons WHERE signal=?) ORDER BY quote", args: [signal] })).rows.map((x) => String(x.quote));
    expect(await ev("steered")).toEqual(["explain new names in plain words", "say what that word means"]);
    expect(await ev("noticed")).toEqual(["Failed: Cannot find name 'Api'", "You: fails until you run pnpm gen"]);
    expect(runner.prompts[0]).toContain("FAILED COMMAND: pnpm build → error TS2304");

    // Read again: nothing new to read, so no calls.
    const again = await reviewSessions(db, repo, [longSession("s1", 45)], runner, fakeEmbed, { cutoff: 0.85, now: Date.parse(at(44)) + 7 * 3_600_000 });
    expect(again.calls).toBe(0);

    // The same thing in another long session adds evidence to the suggestion instead of a second one.
    const third = await reviewSessions(db, repo, [longSession("s2", 30)], runner, fakeEmbed, { cutoff: 0.85 });
    expect(third).toMatchObject({ calls: 1, added: 0, known: 2 });
    expect(Number((await db.execute("SELECT count(*) n FROM lessons")).rows[0]!.n)).toBe(2);
  });

  it("leaves the bookmark where it was when your Claude can't be reached, so the part is read next time", async () => {
    const db = await openDb(); await ensureRepo(db, repo, "/x");
    const down: Runner = { name: "claude", run: () => { throw new Error("offline"); } };
    expect((await reviewSessions(db, repo, [longSession("s1", 30)], down, fakeEmbed, { cutoff: 0.85 })).added).toBe(0);
    const r = await reviewSessions(db, repo, [longSession("s1", 30)], fakeRunner(), fakeEmbed, { cutoff: 0.85 });
    expect(r).toMatchObject({ calls: 1, added: 2 });
  });
});
