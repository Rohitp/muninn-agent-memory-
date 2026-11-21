import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { antigravityHook, antigravityHooksFile, setAntigravityHooks } from "../src/deliver/antigravity-hook.js";
import { repoIdentity } from "../src/repo/identity.js";
import { openDb } from "../src/store/db.js";
import { createLesson, decide, ensureRepo } from "../src/store/lessons.js";
import { tmp, useHome } from "./helpers.js";

let root = ""; let repo = "";
beforeEach(async () => { useHome(); root = join(tmp(), "dart"); mkdirSync(root); execFileSync("git", ["init", "-q", root]); repo = repoIdentity(root)!; await ensureRepo(await openDb(), repo, root); });

describe("Antigravity hooks", () => {
  it("are added to Antigravity's global hooks file beside the engineer's own, and removed cleanly", () => {
    mkdirSync(dirname(antigravityHooksFile()), { recursive: true });
    writeFileSync(antigravityHooksFile(), JSON.stringify({ mine: { Stop: [{ type: "command", command: "./x.sh" }] } }));
    expect(setAntigravityHooks((ev) => `muninn hook --client antigravity --event ${ev}`, true)).toBe(true);
    const cfg = JSON.parse(readFileSync(antigravityHooksFile(), "utf8"));
    expect(cfg.mine).toBeDefined();
    expect(cfg.muninn.PostToolUse[0]).toMatchObject({ matcher: "run_command", hooks: [{ command: "muninn hook --client antigravity --event PostToolUse" }] });
    expect(cfg.muninn.PreInvocation[0].command).toContain("--event PreInvocation");
    setAntigravityHooks(() => "", false);
    expect(JSON.parse(readFileSync(antigravityHooksFile(), "utf8"))).toEqual({ mine: { Stop: [{ type: "command", command: "./x.sh" }] } });
  });
  it("warn an agent at its next turn when a command keeps failing the same way", async () => {
    const db = await openDb();
    const fail = { conversationId: "c1", workspacePaths: [root], toolCall: { name: "run_command", args: { CommandLine: '"uv run pytest"' } }, error: "exit status 1: ImportError: no module named ledger" };
    for (let i = 0; i < 3; i++) expect(await antigravityHook(db, "PostToolUse", fail)).toBe("{}");
    const out = JSON.parse((await antigravityHook(db, "PreInvocation", { conversationId: "c1", workspacePaths: [root] }))!);
    expect(out.injectSteps[0].systemMessage.systemMessage).toMatch(/pytest. has failed 3 times/);
    expect(await antigravityHook(db, "PreInvocation", { conversationId: "c1", workspacePaths: [root] })).toBeNull();
  });
  it("pass on keyword lessons that match what the engineer typed, once", async () => {
    const db = await openDb();
    const id = await createLesson(db, { repo_id: repo, text: "Run migrations against the test database first", source: "manual", status: "live", by: "person" });
    await decide(db, id, { triggers: ["migration"] });
    const turn = () => antigravityHook(db, "PreInvocation", { conversationId: "c2", workspacePaths: [root], lastUserInput: "write the migration for bets" });
    expect(await turn()).toContain("Run migrations against the test database first");
    expect(await turn()).toBeNull();
  });
});
