import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { buildLinks, related, relatedText } from "../src/links/links.js";
import { getHistory, groupHistory } from "../src/plan/history.js";
import { addItem } from "../src/plan/plan.js";
import { repoIdentity } from "../src/repo/identity.js";
import { openDb } from "../src/store/db.js";
import { ensureRepo } from "../src/store/lessons.js";
import { indexPlan } from "../src/store/sessions.js";
import { fakeEmbed, tmp, useHome } from "./helpers.js";

let root = ""; let repo = "";
beforeEach(async () => {
  useHome(); root = join(tmp(), "shop"); mkdirSync(root); execFileSync("git", ["init", "-q", root]);
  repo = repoIdentity(root)!; await ensureRepo(await openDb(), repo, root);
});

async function seed() {
  const db = await openDb();
  const h = { id: "h1", repo_id: repo, branch: "main", session: "s1", tool: "claude-code", text: "", created_at: "2026-11-20T10:00:00.000Z" };
  const d = (await addItem(db, repo, "main", "decision", "Keep every session searchable with a vector index", { handoff: h }))!;
  const a = (await addItem(db, repo, "main", "done", "Stored every session with a vector index for search", { handoff: { ...h, created_at: "2026-11-21T10:00:00.000Z" } }))!;
  const b = (await addItem(db, repo, "main", "done", "Fixed the panel colours", { handoff: { ...h, session: "s2", created_at: "2026-11-21T11:00:00.000Z" } }))!;
  await groupHistory(db, repo, "main", { name: "fake", run: () => JSON.stringify({ outcomes: [
    { title: "Every session is searchable", result: "Search works.", kind: "shipped", area: "Searching past sessions", ref: "5933552", steps: [a.slice(0, 8)] },
    { title: "Panel colours fixed", result: "Colours work.", kind: "fixed", area: "Claude Code panel", steps: [b.slice(0, 8)] },
  ], decisions: [] }) });
  await indexPlan(db, fakeEmbed);
  const sessions = [{ id: "s1", tool: "claude-code" as const, cwd: root, clientVersion: "1", unknown: 0, events: [{ k: "file" as const, tool: "edit", path: join(root, "src", "store.ts"), failed: false, output: "", ts: "t" }] }];
  return { db, d, counts: await buildLinks(db, sessions) };
}

describe("links between things muninn keeps", () => {
  it("links steps, sessions, commits and files from recorded facts, and a decision to the work it led to by meaning", async () => {
    const { db, d, counts } = await seed();
    expect(counts).toMatchObject({ part_of: 2, built_in: 2, ships_in: 1, made_in: 1, motivates: 1, touches: 1 });
    const r = await related(db, "decision", d);
    expect(r.find((g) => g.rel === "motivates")!.items.map((i) => i.title)).toEqual(["Every session is searchable"]);
    expect(r.find((g) => g.rel === "made_in")!.label).toBe("Decided in");
  });
  it("shows them in the history and answers what a decision affected", async () => {
    const { db } = await seed();
    const h = await getHistory(db, repo, "main");
    const o = h.outcomes.find((x) => x.title === "Every session is searchable")!;
    expect(o.links).toMatchObject({ because: [expect.objectContaining({ title: "Keep every session searchable with a vector index" })], sessions: 1, files: ["src/store.ts"] });
    expect(h.decisions[0]!.links!.ledTo!.map((x) => x.title)).toEqual(["Every session is searchable"]);
    const text = await relatedText(db, "vector index for every session", repo, fakeEmbed);
    expect(text).toContain("Led to:");
    expect(text).toContain("src/store.ts");
    expect(text).toContain("Check the code itself");
  });
  it("keeps the links it can't work out again when rebuilt, and drops ones that no longer hold", async () => {
    const { db } = await seed();
    await db.execute("UPDATE plan_items SET outcome_id=NULL");
    const counts = await buildLinks(db);
    expect(counts.part_of).toBe(0);
    expect(Number((await db.execute("SELECT count(*) n FROM links WHERE rel='touches'")).rows[0]!.n)).toBe(1);
  });
});

describe("files from commits", () => {
  it("links an outcome to the files its commit changed, and prefers those over a session's files", async () => {
    const { filesFor } = await import("../src/links/links.js");
    const g = (...a: string[]) => execFileSync("git", ["-C", root, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { encoding: "utf8" }).trim();
    mkdirSync(join(root, "src"), { recursive: true }); writeFileSync(join(root, "src", "search.ts"), "x");
    g("add", "."); g("commit", "-q", "-m", "search");
    const hash = g("rev-parse", "--short", "HEAD");
    const { db } = await seed();
    await db.execute({ sql: "UPDATE plan_outcomes SET ref=? WHERE title='Every session is searchable'", args: [hash] });
    const counts = await buildLinks(db);
    expect(counts.changes).toBe(1);
    const o = String((await db.execute("SELECT id FROM plan_outcomes WHERE title='Every session is searchable'")).rows[0]!.id);
    expect(await filesFor(db, [o], 5)).toEqual({ files: ["src/search.ts"], fromGit: true });
  });
});

describe("links your Claude checks, and links you set", () => {
  const reply = (p: string) => {
    if (p.includes("directly shaped or led to")) return '[{"i":0,"led":false}]';
    if (p.includes("replaces the older")) return '[{"i":0,"replaces":true}]';
    if (p.includes("changed outside the code repository")) return JSON.stringify([...p.matchAll(/"i": (\d+)/g)].map((m) => ({ i: Number(m[1]), outside: m[1] === "0" ? ["npm package secondnature"] : [] })));
    return "[]";
  };
  it("rejects a led-to link your Claude says is only similar, and never proposes it again", async () => {
    const { confirmLinks } = await import("../src/links/confirm.js");
    const { db, d } = await seed();
    expect((await confirmLinks(db, { name: "fake", run: reply })).motivates).toBe(1);
    expect((await related(db, "decision", d)).find((g) => g.rel === "motivates")).toBeUndefined();
    await buildLinks(db);
    expect((await related(db, "decision", d)).find((g) => g.rel === "motivates")).toBeUndefined();
  });
  it("records a newer decision replacing an older one, and what work changed outside the repo", async () => {
    const { confirmLinks } = await import("../src/links/confirm.js");
    const { db, d } = await seed();
    const later = (await addItem(db, repo, "main", "decision", "Keep every session searchable, but with a vector index per repo", { handoff: { id: "h2", repo_id: repo, branch: "main", session: "s3", tool: "claude-code", text: "", created_at: "2026-11-22T10:00:00.000Z" } }))!;
    await indexPlan(db, fakeEmbed);
    const c = await confirmLinks(db, { name: "fake", run: reply });
    expect(c.supersedes).toBe(1);
    expect((await related(db, "decision", d)).find((g) => g.rel === "supersedes")).toMatchObject({ label: "Replaced by", items: [expect.objectContaining({ id: later })] });
    const h = await getHistory(db, repo, "main");
    expect(h.decisions.find((x) => x.id === d)!.links!.replacedBy).toEqual(["Keep every session searchable, but with a vector index per repo"]);
    expect(h.outcomes.flatMap((o) => o.links?.outside ?? [])).toEqual(["npm package secondnature"]);
    expect(Number((await db.execute("SELECT count(*) n FROM plan_outcomes WHERE outside_checked=0")).rows[0]!.n)).toBe(0);
  });
  it("lets you unlink and link by describing both, and keeps your choice through rebuilds", async () => {
    const { linkCmd } = await import("../src/links/links.js");
    const { db, d } = await seed();
    expect(await linkCmd(db, false, "searchable vector index", "Every session is searchable", repo, fakeEmbed)).toMatch(/^Unlinked/);
    await buildLinks(db);
    expect((await related(db, "decision", d)).find((g) => g.rel === "motivates")).toBeUndefined();
    expect(await linkCmd(db, true, "searchable vector index", "Fixed the panel colours", repo, fakeEmbed)).toMatch(/^Linked: .* led to "Panel colours fixed"/);
    await buildLinks(db);
    expect((await related(db, "decision", d)).find((g) => g.rel === "motivates")!.items.map((i) => i.title)).toEqual(["Panel colours fixed"]);
  });
});

describe("lessons and the files they name", () => {
  it("links a lesson to files it names, and flags one no longer in the repo", async () => {
    const { createLesson } = await import("../src/store/lessons.js");
    const db = await openDb();
    mkdirSync(join(root, "src")); writeFileSync(join(root, "src", "app.ts"), "x");
    const id = await createLesson(db, { repo_id: repo, text: "Edit `src/app.ts`, never src/old.ts", source: "manual", status: "live", by: "person" });
    await buildLinks(db);
    const rows = (await db.execute({ sql: "SELECT dst_id, how FROM links WHERE src_id=? AND rel='applies_to' ORDER BY dst_id", args: [id] })).rows.map((r) => [r.dst_id, r.how]);
    expect(rows).toEqual([["src/app.ts", "known"], ["src/old.ts", "missing"]]);
  });
  it("counts files opened through shell commands as touched", async () => {
    const db = await openDb();
    mkdirSync(join(root, "docs")); writeFileSync(join(root, "docs", "notes.md"), "x");
    await buildLinks(db, [{ id: "sh", tool: "claude-code", cwd: root, clientVersion: "1", unknown: 0, events: [{ k: "cmd", cmd: "sed -n 1,40p docs/notes.md", failed: false, output: "", ts: "t" }] }]);
    expect((await db.execute("SELECT dst_id FROM links WHERE src_id='sh' AND rel='touches'")).rows.map((r) => r.dst_id)).toEqual(["docs/notes.md"]);
  });
});
