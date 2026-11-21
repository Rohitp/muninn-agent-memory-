import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { originOf } from "../src/commands/ask.js";
import { learnRepo } from "../src/learn/pipeline.js";
import { findMoments, promisesIn } from "../src/learn/signals.js";
import { explainWhy } from "../src/learn/why.js";
import { buildPrompt, parseReply, type Runner } from "../src/learn/writer.js";
import { repoIdentity } from "../src/repo/identity.js";
import { openDb } from "../src/store/db.js";
import { addEvidence, createLesson, ensureRepo, getLesson, listLessons } from "../src/store/lessons.js";
import { fakeEmbed, tmp, useHome } from "./helpers.js";

let cwd = ""; let repo = "";
beforeEach(async () => { useHome(); cwd = join(tmp(), "shop"); mkdirSync(cwd); execFileSync("git", ["init", "-q", cwd]); repo = repoIdentity(cwd)!; await ensureRepo(await openDb(), repo, cwd); });

const SAID = "x".repeat(2500) + "\n\n**My mistake.** I chained the clean-up after the merge command, so when the merge failed, the clean-up still deleted the branch. From now on I delete a branch only after checking the merge actually happened.";
const session = () => ({ id: "s1", tool: "claude-code" as const, cwd, clientVersion: "1", unknown: 0, events: [
  { k: "typed" as const, text: "merge it", ts: "2026-11-21T10:00:00.000Z" },
  { k: "agent" as const, text: SAID, ts: "2026-11-21T10:01:00.000Z" },
] });

describe("the agent's own promises and owned-up mistakes", () => {
  it("are found in what the agent said, not in ordinary plans", () => {
    expect(promisesIn(SAID)).toEqual(["My mistake.", "From now on I delete a branch only after checking the merge actually happened."].filter((x) => x.length >= 15));
    expect(promisesIn("I'll run the tests next. Then I'll open the PR.")).toEqual([]);
    expect(promisesIn("I should have checked the merge state before deleting the branch.")).toHaveLength(1);
  });
  it("become a moment that carries the engineer's request and the agent's whole message", async () => {
    const m = (await findMoments([session()], fakeEmbed, { cutoff: 0.9, minSessions: 2 })).filter((x) => x.signal === "promised");
    expect(m.map((x) => x.text)).toEqual(["From now on I delete a branch only after checking the merge actually happened."]);
    expect(m[0]!.context).toContain("ENGINEER ASKED: merge it");
    expect(m[0]!.context).toContain("I chained the clean-up");
    expect(buildPrompt(m)).toContain('Items of kind "promised"');
  });
  it("are proposed with a why, never kept on their own", async () => {
    const db = await openDb();
    const writer = { name: "fake", write: async (ms: unknown[]) => ms.map(() => ({ text: "Merge with gh pr merge --delete-branch, so the branch is deleted only if the merge succeeds.", scope: "global" as const, why: "A merge failed, but the next command deleted the branch anyway, which closed the pull request." })) };
    await learnRepo(db, repo, [session()], { embed: fakeEmbed, writer, cutoff: 0.9, minSessions: 2 });
    const [l] = await listLessons(db, { repo, status: "proposed" });
    expect(l?.signal).toBe("promised");
    expect(l?.why).toMatch(/closed the pull request/);
    expect(await originOf(db, l!)).toMatch(/^An agent promised this after a mistake/);
    expect(await listLessons(db, { repo, status: "live" })).toEqual([]);
  });
});

describe("a why for every lesson", () => {
  it("is read from the writer's reply", () => {
    expect(parseReply('[{"i":0,"lesson":"Use pnpm","scope":"repo","why":"npm install failed twice."}]', 1)).toEqual([{ text: "Use pnpm", scope: "repo", why: "npm install failed twice." }]);
  });
  it("is filled in for lessons kept before, once each", async () => {
    const db = await openDb();
    const a = await createLesson(db, { repo_id: repo, text: "Use pnpm", source: "inferred", signal: "loop", status: "live", by: "t" });
    const b = await createLesson(db, { repo_id: repo, text: "Something vague", source: "inferred", status: "proposed", by: "t" });
    const mine = await createLesson(db, { repo_id: repo, text: "Added by hand", source: "manual", status: "live", by: "person" });
    await addEvidence(db, a, [{ tool: "claude-code", session: "s", ts: "t", quote: "$ npm install  →  ERR" }]);
    let asked = 0;
    // Answers by lesson, whatever order they were asked in.
    const runner: Runner = { name: "fake", run: (p) => { asked++; const items = JSON.parse(p.slice(p.indexOf("ITEMS: ") + 7)) as { i: number; lesson: string }[]; return JSON.stringify(items.map((x) => ({ i: x.i, why: x.lesson === "Use pnpm" ? "npm install failed." : null }))); } };
    expect(await explainWhy(db, runner)).toBe(2);
    expect((await getLesson(db, a))?.why).toBe("npm install failed.");
    expect((await getLesson(db, b))?.why).toBe("");
    expect((await getLesson(db, mine))?.why).toBeNull();
    expect(await explainWhy(db, runner)).toBe(0);
    expect(asked).toBe(1);
  });
});
