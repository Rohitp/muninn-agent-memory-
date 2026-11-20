import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { insightsData, insightsText } from "../src/commands/insights.js";
import { withWhy, START, END } from "../src/commands/pr.js";
import type { Runner } from "../src/learn/writer.js";
import type { LogEvent, Session } from "../src/logs/types.js";
import { apply, dismiss, guardProposals, listProposals, propose, proposeInstructions, proposeSkills, undo } from "../src/propose/index.js";
import { guardPrefix, LOCAL_SETTINGS } from "../src/propose/guards.js";
import { applyEdit, editFits } from "../src/propose/instructions.js";
import { findWorkflows } from "../src/propose/skills.js";
import { repoIdentity } from "../src/repo/identity.js";
import { openDb } from "../src/store/db.js";
import { ensureRepo } from "../src/store/lessons.js";
import { tmp, useHome } from "./helpers.js";

let root = ""; let repo = "";
beforeEach(async () => {
  useHome(); root = join(tmp(), "repo"); mkdirSync(root); execFileSync("git", ["init", "-q", root]);
  repo = repoIdentity(root)!; await ensureRepo(await openDb(), repo, root);
});
const at = (d: number, m = 0) => new Date(Date.UTC(2026, 10, d, 10, m)).toISOString();
const sess = (id: string, events: LogEvent[]): Session => ({ id, tool: "claude-code", cwd: root, clientVersion: "1", unknown: 0, events });
const ran = (cmd: string, ts = at(1), extra: Partial<LogEvent> = {}): LogEvent => ({ k: "cmd", cmd, failed: false, output: "ok", ts, ...extra } as LogEvent);
const fake = (reply: string): Runner => ({ name: "fake", run: () => reply });
const git = (...a: string[]) => execFileSync("git", ["-C", root, ...a], { encoding: "utf8" });

describe("ask-first rules from commands you stop", () => {
  it("keeps the program, subcommand and flags, and drops arguments", () => {
    expect(guardPrefix("git push --force origin main")).toBe("git push --force");
    expect(guardPrefix("cd /x && rm -rf build")).toBe("rm -rf");
    expect(guardPrefix("FOO=1 npm publish --access public")).toBe("npm publish --access");
    expect(guardPrefix("python3 script.py")).toBeNull();
  });
  it("proposes a rule for a command stopped in two sessions, says how often you let it run, and skips rules you have", () => {
    const stop = (id: string, d: number) => sess(id, [ran("git push --force origin x", at(d), { stopped: true })]);
    const p = guardProposals(repo, [stop("a", 1), stop("b", 2), sess("c", [ran("git push --force-with-lease", at(3)), ran("git push --force origin y", at(3))])], root);
    expect(p).toHaveLength(1);
    expect(p[0]!.payload).toMatchObject({ rule: "Bash(git push --force:*)", stopped: 2, allowed: 1 });
    expect(p[0]!.why).toContain("let it run 1 time(s)");
    expect(guardProposals(repo, [stop("a", 1)], root)).toHaveLength(0);
    mkdirSync(join(root, ".claude"));
    writeFileSync(join(root, ".claude", "settings.json"), JSON.stringify({ permissions: { ask: ["Bash(git push:*)"] } }));
    expect(guardProposals(repo, [stop("a", 1), stop("b", 2)], root)).toHaveLength(0);
  });
  it("applies into settings.local.json, keeps it out of git, and undoes", async () => {
    const db = await openDb();
    const [g] = guardProposals(repo, [sess("a", [ran("rm -rf dist", at(1), { stopped: true })]), sess("b", [ran("rm -rf out", at(2), { stopped: true })])], root);
    await propose(db, g!);
    const [p] = await listProposals(db, repo);
    await apply(db, p!.id);
    const file = join(root, LOCAL_SETTINGS);
    expect(JSON.parse(readFileSync(file, "utf8")).permissions.ask).toEqual(["Bash(rm -rf:*)"]);
    expect(git("status", "--porcelain")).toBe("");
    await undo(db, p!.id);
    expect(existsSync(file)).toBe(false);
    expect((await listProposals(db, repo))[0]!.status).toBe("proposed");
  });
  it("doesn't bring back a change you dismissed", async () => {
    const db = await openDb();
    const [g] = guardProposals(repo, [sess("a", [ran("rm -rf dist", at(1), { stopped: true })]), sess("b", [ran("rm -rf out", at(2), { stopped: true })])], root);
    await propose(db, g!);
    await dismiss(db, (await listProposals(db, repo))[0]!.id);
    expect(await propose(db, g!)).toBe(false);
    expect(await listProposals(db, repo)).toHaveLength(0);
  });
});

describe("skills from steps that repeat", () => {
  const flow = (id: string, d: number, file: string): Session => sess(id, [
    { k: "typed", text: "reset the db and test", ts: at(d) },
    ran(`pnpm db:reset ./data/${file}`, at(d, 1)), ran("ls", at(d, 2)), ran("pnpm db:seed", at(d, 3)), ran("pnpm test", at(d, 4)),
  ]);
  it("finds the same steps in three sessions, ignoring looking-around commands and different files", () => {
    const w = findWorkflows([flow("a", 1, "x.db"), flow("b", 2, "y.db"), flow("c", 3, "z.db")]);
    expect(w).toHaveLength(1);
    expect(w[0]!.steps).toEqual(["pnpm db:reset .<path>", "pnpm db:seed", "pnpm test"]);
    expect(findWorkflows([flow("a", 1, "x.db"), flow("b", 2, "y.db")])).toHaveLength(0);
  });
  it("drafts with your Claude, applies as a skill kept out of git, and remembers what it judged noise", async () => {
    const db = await openDb();
    const sessions = [flow("a", 1, "x.db"), flow("b", 2, "y.db"), flow("c", 3, "z.db")];
    const draft = JSON.stringify([{ i: 0, name: "reset-and-test", description: "Use when the dev database needs a clean slate.", steps: "1. Reset: `pnpm db:reset ./data/<file>`" }]);
    expect(await proposeSkills(db, repo, sessions, fake(draft))).toBe(1);
    expect(await proposeSkills(db, repo, sessions, fake(draft))).toBe(0);
    const [p] = await listProposals(db, repo);
    expect(p!.title).toBe("Make a skill: reset-and-test");
    await apply(db, p!.id);
    const skill = readFileSync(join(root, ".claude", "skills", "reset-and-test", "SKILL.md"), "utf8");
    expect(skill).toMatch(/^---\nname: reset-and-test\ndescription: "Use when/);
    expect(git("status", "--porcelain")).toBe("");
  });
  it("stores a candidate your Claude calls noise as dismissed, so it isn't asked again", async () => {
    const db = await openDb();
    const sessions = [flow("a", 1, "x.db"), flow("b", 2, "y.db"), flow("c", 3, "z.db")];
    expect(await proposeSkills(db, repo, sessions, fake('[{"i":0,"name":null,"description":null,"steps":null}]'))).toBe(0);
    expect(await listProposals(db, repo)).toHaveLength(0);
    expect(await listProposals(db, repo, "dismissed")).toHaveLength(1);
  });
});

describe("edits to instruction files", () => {
  it("fits an edit only where the text it changes appears exactly once", () => {
    expect(editFits({ action: "replace", find: "use npm", text: "use pnpm", why: "" }, "Always use npm.\n")).toBe(true);
    expect(editFits({ action: "replace", find: "use npm", text: "x", why: "" }, "use npm, use npm")).toBe(false);
    expect(applyEdit({ action: "add", text: "- New line", why: "" }, "# Notes\n")).toBe("# Notes\n\n- New line\n");
  });
  it("proposes the edits that fit, applies one, and won't undo over your own later changes", async () => {
    const db = await openDb();
    writeFileSync(join(root, "CLAUDE.md"), "# Repo\n\nRun tests with npm test.\n");
    const reply = JSON.stringify([
      { file: "CLAUDE.md", action: "replace", find: "npm test", text: "pnpm test", why: "Sessions show npm test fails here." },
      { file: "CLAUDE.md", action: "remove", find: "not in the file", text: null, why: "x" },
      { file: "../outside.md", action: "add", find: null, text: "x", why: "x" },
    ]);
    expect(await proposeInstructions(db, repo, fake(reply))).toEqual({ proposed: 1, checked: 3 });
    const [p] = await listProposals(db, repo);
    await apply(db, p!.id);
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).toContain("Run tests with pnpm test.");
    writeFileSync(join(root, "CLAUDE.md"), "# Repo\n\nchanged by hand\n");
    await expect(undo(db, p!.id)).rejects.toThrow(/changed after muninn applied/);
  });
});

describe("the why for a pull request", () => {
  it("adds its block at the end, and replaces only that block next time", () => {
    const once = withWhy("My summary.", "## Why\nBecause.");
    expect(once.startsWith("My summary.\n\n" + START)).toBe(true);
    const twice = withWhy(once + "\nFooter", "## Why\nNew reason.");
    expect(twice).toContain("New reason.");
    expect(twice).not.toContain("Because.");
    expect(twice).toContain("Footer");
    expect(twice.split(END)).toHaveLength(2);
  });
});

describe("insights", () => {
  it("counts the week's sessions and the effort that went to waste", async () => {
    const now = new Date().toISOString();
    const loop = Array.from({ length: 3 }, () => ({ k: "cmd" as const, cmd: "make lint", failed: true, output: "error: boom ".repeat(20), ts: now }));
    const old = sess("old", [ran("make", "2020-01-01T00:00:00.000Z")]);
    const i = await insightsData(await openDb(), repo, 7, [sess("a", [...loop, { k: "interrupt", ts: now }]), old]);
    expect(i.sessions.total).toBe(1);
    expect(i.effort.byKind.map((b) => b.kind)).toContain("loop");
    expect(i.effort.interrupted).toBe(1);
    const text = insightsText(i);
    expect(text).toContain("Sessions: 1 (Claude Code 1)");
    expect(text).toContain("the same command failing again and again");
  });
});

describe("ignoring a repo", () => {
  it("removes what muninn kept for it, keeps it off the list, and tells agents nothing there", async () => {
    const { ignoreRepo, unignoreRepo } = await import("../src/store/ignore.js");
    const { createLesson, decide } = await import("../src/store/lessons.js");
    const { deliver } = await import("../src/deliver/hook.js");
    const db = await openDb();
    const id = await createLesson(db, { repo_id: repo, text: "Quote === in zsh", source: "manual", status: "live", by: "person" });
    await decide(db, id, { alwaysOn: true });
    expect(await ignoreRepo(db, repo)).toBe(1);
    expect((await db.execute({ sql: "SELECT 1 FROM repos WHERE id=?", args: [repo] })).rows).toHaveLength(0);
    await ensureRepo(db, repo, root);
    expect((await db.execute({ sql: "SELECT 1 FROM repos WHERE id=?", args: [repo] })).rows).toHaveLength(0);
    expect(await deliver(db, "claude-code", { hook_event_name: "SessionStart", source: "startup", session_id: "s", cwd: root })).toBeNull();
    await unignoreRepo(db, repo);
    await ensureRepo(db, repo, root);
    expect((await db.execute({ sql: "SELECT 1 FROM repos WHERE id=?", args: [repo] })).rows).toHaveLength(1);
  });
});
