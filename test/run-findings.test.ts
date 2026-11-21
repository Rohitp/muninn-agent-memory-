import { beforeEach, describe, expect, it } from "vitest";
import { insightsData, insightsText } from "../src/commands/insights.js";
import { findRunFindings, findingsPrompt, parseFindings, runNumbers, savedFindings } from "../src/commands/run-findings.js";
import type { Runner } from "../src/learn/writer.js";
import { openDb } from "../src/store/db.js";
import { standInRuns } from "./fixtures/runs.js";
import { useHome } from "./helpers.js";

const [factory, small] = standInRuns as [typeof standInRuns[0], typeof standInRuns[0]];
beforeEach(() => { useHome(); });

describe("a run's numbers", () => {
  it("adds up time, tokens and commands per role, approvals, work sent back and what the redo took", () => {
    const n = runNumbers(factory);
    expect(n.minutes).toBe(157);
    expect(n.tokens).toBe(1_882_000);
    expect(n.roles[0]).toMatchObject({ role: "builder", sessions: 2, tokens: 1_022_000, commands: 87, failed: 3, sentBack: 2, reworkTokens: 360_000, models: ["gemini-4-argon-high"] });
    expect(n.roles[0]!.share).toBeCloseTo(1022 / 1882, 3);
    expect(n.roles.find((r) => r.role === "checker")).toMatchObject({ approvals: 1 });
    // A follow-up posted to two roles counts for each.
    expect(n.roles.find((r) => r.role === "reviewer")).toMatchObject({ sentBack: 1, reworkTokens: 0 });
    expect(n).toMatchObject({ approvals: 1, sentBack: 1, rework: 1, reworkTokens: 360_000 });
  });
  it("finds gaps when no agent but the main session was working", () => {
    expect(runNumbers(factory).stalls).toEqual([{ from: "2026-11-21T16:18:00.000Z", to: "2026-11-21T16:26:00.000Z", minutes: 8, after: "builder", before: "qa" }]);
    expect(runNumbers(small).stalls).toEqual([]);
  });
});

describe("what a run shows", () => {
  it("sends tokens, tasks and what was said at each handoff, approvals only as a count, and keeps well-formed findings", () => {
    const p = findingsPrompt(factory, runNumbers(factory), ["Run the engine tests with --isolated"]);
    expect(p).toContain('"times_sent_back": 2');
    expect(p).toContain('"approvals": 1');
    expect(p).toContain("Agents share one portfolio object");
    expect(p).toContain("builder work for milestone 1");
    expect(p).not.toContain("CHECK PASS on PR #4");
    expect(p).toContain("Run the engine tests with --isolated");
    expect(parseFindings(`Here: [{"kind":"bounce","role":"builder","text":"Sent back once."},{"kind":"made-up","role":null,"text":"x"},{"kind":"cost","role":"astronaut","text":"Most went to building."},{"kind":"stall","text":""}]`, factory.roles))
      .toEqual([{ kind: "bounce", role: "builder", text: "Sent back once." }, { kind: "cost", role: null, text: "Most went to building." }]);
    expect(parseFindings("no JSON here", factory.roles)).toEqual([]);
  });
  it("keeps findings until the run grows, then looks again", async () => {
    const db = await openDb();
    const runner: Runner = { name: "claude", run: () => JSON.stringify([{ kind: "bounce", role: "builder", text: "The reviewer sent the builder's work back once." }]) };
    const f = await findRunFindings(db, factory, runner);
    expect(f.items).toHaveLength(1);
    expect(Object.keys(await savedFindings(db, [factory]))).toEqual(["run-dart-1"]);
    expect(await savedFindings(db, [{ ...factory, ended_at: "2026-11-21T18:00:00.000Z" }])).toEqual({});
  });
});

describe("runs in your week", () => {
  it("says how many runs, tokens by role, work sent back and time waiting, with a finding each", async () => {
    const db = await openDb();
    const recent = standInRuns.map((r) => ({ ...r, ended_at: new Date().toISOString() }));
    await findRunFindings(db, recent[0]!, { name: "claude", run: () => '[{"kind":"bounce","role":"builder","text":"Spell out isolation in the spec."}]' });
    const text = insightsText(await insightsData(db, "github.com/rohitp/dartboard", 7, [], recent));
    expect(text).toContain("Autonomous runs");
    expect(text).toContain("2 run(s) with more than one agent");
    expect(text).toMatch(/Tokens by role: builder \d+%/);
    expect(text).toContain("Work sent back 1 time(s), 1 follow-up fix(es) asked for; the redo took about 360k tokens.");
    expect(text).toContain("No agent was working for 8m");
    expect(text).toContain("Spell out isolation in the spec.");
  });
  it("says nothing about runs when there are none", async () => {
    expect(insightsText(await insightsData(await openDb(), "github.com/rohitp/dartboard", 7, [], []))).not.toContain("Autonomous runs");
  });
});
