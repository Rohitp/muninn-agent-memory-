import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { repoIdentity } from "../src/repo/identity.js";
import { openDb } from "../src/store/db.js";
import { createLesson, ensureRepo } from "../src/store/lessons.js";
import { roleEffects } from "../src/workflow/effect.js";
import { saveRuns, type Handoff, type Run } from "../src/workflow/runs.js";
import { tmp, useHome } from "./helpers.js";

let root = ""; let repo = "";
beforeEach(async () => {
  useHome(); root = join(tmp(), "factory"); mkdirSync(root); execFileSync("git", ["init", "-q", root]);
  execFileSync("git", ["-C", root, "remote", "add", "origin", "https://github.com/example/factory.git"]);
  repo = repoIdentity(root)!; await ensureRepo(await openDb(), repo, root);
});
const day = (d: number) => new Date(Date.UTC(2026, 10, d, 10)).toISOString();
const run = (d: number, handoffs: Partial<Handoff>[]): Run => ({
  id: `run-${d}`, repo_id: repo, started_at: day(d), ended_at: day(d), roles: ["builder", "reviewer"], team: true, bounces: 0, wasted_tokens: 0, tokens_in: 0, tokens_out: 0,
  sessions: ["builder", "reviewer"].map((role) => ({ id: `${role}-${d}`, tool: "antigravity", role, branch: null, worktree: role, parent_session: "p", agent_type: null, started_at: day(d), ended_at: day(d), tokens_in: 0, tokens_out: 0, cache_read: 0, model: null, commands: 0, failed_commands: 0, task: null, typed: 0 })),
  handoffs: handoffs.map((h) => ({ from_role: "builder", to_role: "everyone", at: day(d), kind: "handoff", ...h })) as Handoff[],
});
const fix = { kind: "rework" as const, from_role: "builder" }, approve = { kind: "approved" as const, from_role: "reviewer" };

describe("whether a role's lesson worked", () => {
  it("compares runs before and since, per run for a builder and per approval for a reviewer, and checks it was told", async () => {
    const db = await openDb();
    await saveRuns(db, [run(1, [fix, fix, fix, approve, approve]), run(2, [fix, fix, approve]), run(10, [approve, approve]), run(11, [fix, approve, approve])]);
    const live = async (role: string) => { const id = await createLesson(db, { repo_id: repo, text: `${role}: check edge cases before you are done`, source: "inferred", status: "live", by: "t", role }); await db.execute({ sql: "UPDATE lessons SET reviewed_at=? WHERE id=?", args: [day(5), id] }); };
    await live("builder"); await live("reviewer");
    const notTold = await roleEffects(db, repo);
    expect(notTold.map((e) => e.verdict)).toEqual(["not_told", "not_told"]);
    for (const role of ["builder", "reviewer"]) { mkdirSync(join(root, ".worktrees", role, ".agents", "rules"), { recursive: true }); writeFileSync(join(root, ".worktrees", role, ".agents", "rules", "muninn.md"), `- ${role}: check edge cases before you are done`); }
    const [a, b] = (await roleEffects(db, repo)).sort((x, y) => x.role.localeCompare(y.role));
    expect(a).toMatchObject({ role: "builder", verdict: "working", before: { runs: 2, problems: 5, rate: 2.5 }, after: { runs: 2, problems: 1, rate: 0.5 }, told: { rulesFile: true } });
    expect(b).toMatchObject({ role: "reviewer", verdict: "working", before: { runs: 2, problems: 5, per: 3 }, after: { runs: 2, problems: 1, per: 4, rate: 0.25 } });
    expect(a!.summary).toBe("Working: fixes the builder made later or work sent back to it, per run went from 2.50 per run in 2 run(s) before to 0.50 in 2 run(s) since.");
  });
  it("says when there's nothing to compare yet", async () => {
    const db = await openDb();
    await saveRuns(db, [run(1, [fix, fix])]);
    await createLesson(db, { repo_id: repo, text: "builder: check", source: "inferred", status: "live", by: "t", role: "builder" });
    expect((await roleEffects(db, repo))[0]).toMatchObject({ verdict: "no_runs_yet" });
  });
});
