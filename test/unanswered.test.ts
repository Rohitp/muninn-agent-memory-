import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { unansweredMoments } from "../src/learn/unanswered.js";
import { learnRepo } from "../src/learn/pipeline.js";
import { repoIdentity } from "../src/repo/identity.js";
import { openDb } from "../src/store/db.js";
import { ensureRepo, listLessons } from "../src/store/lessons.js";
import { recordQuery } from "../src/store/queries.js";
import { fakeEmbed, tmp, useHome } from "./helpers.js";

let root = ""; let repo = "";
beforeEach(async () => { useHome(); root = join(tmp(), "shop"); mkdirSync(root); execFileSync("git", ["init", "-q", root]); repo = repoIdentity(root)!; await ensureRepo(await openDb(), repo, root); });

const ask = (db: Awaited<ReturnType<typeof openDb>>, query: string, tool = "claude-code", results = 0) =>
  recordQuery(db, { repo, branch: "main", session: `s-${Math.random()}`, tool, surface: "search_history", query, results, result_ids: [], ms: 5 });

describe("questions agents asked that found nothing", () => {
  it("become one moment when agents ask the same thing twice; yours and answered ones don't count", async () => {
    const db = await openDb();
    await ask(db, "How do I run the integration tests?");
    expect(await unansweredMoments(db, repo, fakeEmbed)).toEqual([]);
    await ask(db, "how do I run the integration tests");
    await ask(db, "How do I run the integration tests?", "terminal");
    await ask(db, "where is the deploy script", "claude-code", 3);
    const ms = await unansweredMoments(db, repo, fakeEmbed);
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ signal: "unanswered" }); expect(ms[0]!.text).toMatch(/^Agents asked muninn 2 times and it found nothing: "how do I run the integration tests\??"$/i);
    expect(ms[0]!.quotes.map((q) => q.tool)).toEqual(["claude-code", "claude-code"]);
  });
  it("are suggested as a note when your Claude can answer them from history, never kept on their own", async () => {
    const db = await openDb();
    await ask(db, "How do I run the integration tests?"); await ask(db, "how do I run the integration tests");
    const writer = { name: "fake", write: async (ms: { signal: string }[]) => ms.map((m) => (m.signal === "unanswered" ? { text: "Run integration tests with `make test-int`; it needs Docker running.", scope: "repo" as const, keywords: ["integration tests"], why: "Agents asked twice and found nothing." } : null)) };
    await learnRepo(db, repo, [], { embed: fakeEmbed, writer: writer as never, cutoff: 0.9, minSessions: 2, extra: await unansweredMoments(db, repo, fakeEmbed) });
    const [l] = await listLessons(db, { repo, status: "proposed" });
    expect(l).toMatchObject({ signal: "unanswered", kind: "note", text: "Run integration tests with `make test-int`; it needs Docker running." });
    expect(await listLessons(db, { repo, status: "live" })).toEqual([]);
  });
});
