import { readdirSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { openDb } from "../src/store/db.js";
import { createLesson, decide, getLesson, listLessons, routeOf } from "../src/store/lessons.js";
import { home } from "../src/config.js";
import { useHome } from "./helpers.js";

beforeEach(useHome);
describe("lessons", () => {
  it("records a version for every change, including triggers and always-on", async () => {
    const db = await openDb();
    const id = await createLesson(db, { repo_id: null, text: "a", source: "manual", status: "live", by: "person", reviewed: true });
    await decide(db, id, { alwaysOn: true, triggers: ["deploy"] });
    const v = await db.execute("SELECT snapshot FROM lesson_versions ORDER BY changed_at");
    expect(v.rows).toHaveLength(2);
    expect(String(v.rows[1]!.snapshot)).toContain("deploy");
  });
  it("knows when a lesson has no route", async () => {
    const db = await openDb();
    const id = await createLesson(db, { repo_id: null, text: "a", source: "manual", status: "live", by: "person" });
    expect(await routeOf(db, (await getLesson(db, id))!)).toBe(false);
    await decide(db, id, { triggers: ["deploy"] });
    expect(await routeOf(db, (await getLesson(db, id))!)).toBe(true);
  });
  it("keeps search in step with edits", async () => {
    const db = await openDb();
    const id = await createLesson(db, { repo_id: null, text: "alpha", source: "manual", status: "live", by: "person" });
    await decide(db, id, { text: "beta" });
    const q = async (w: string) => (await db.execute({ sql: "SELECT lesson_id FROM lessons_fts WHERE lessons_fts MATCH ?", args: [w] })).rows.length;
    expect([await q("alpha"), await q("beta")]).toEqual([0, 1]);
  });
  it("re-opening does not migrate twice, and a new migration backs up first", async () => {
    await openDb();
    await (await openDb()).execute("SELECT 1 FROM lessons");
    expect(readdirSync(home()).filter((f) => f.includes(".bak-"))).toEqual([]);
    expect(await listLessons(await openDb())).toEqual([]);
  });
});

describe("lessons kept for every repo", () => {
  it("are listed in every repo's kept lessons, not only the repo they were learned in", async () => {
    const { openDb } = await import("../src/store/db.js");
    const { createLesson, listLessons } = await import("../src/store/lessons.js");
    const db = await openDb();
    for (const r of ["github.com/x/a", "github.com/x/b"]) await db.execute({ sql: "INSERT OR IGNORE INTO repos (id,paths) VALUES (?,'[]')", args: [r] });
    await createLesson(db, { repo_id: "github.com/x/a", scope: "global", text: "Explain new terms in plain words", source: "manual", status: "live", by: "t" });
    await createLesson(db, { repo_id: "github.com/x/a", text: "Only for repo A", source: "manual", status: "live", by: "t" });
    const inB = (withAllRepos: boolean) => listLessons(db, { repo: "github.com/x/b", status: "live", withAllRepos }).then((ls) => ls.map((l) => l.text));
    expect(await inB(true)).toEqual(["Explain new terms in plain words"]);
    expect(await inB(false)).toEqual([]);
  });
});

describe("a lesson's role", () => {
  it("can be set or cleared by the person keeping it", async () => {
    const { openDb } = await import("../src/store/db.js");
    const { createLesson, decide, getLesson } = await import("../src/store/lessons.js");
    const db = await openDb();
    const id = await createLesson(db, { repo_id: null, scope: "global", text: "Check edge cases before handing off", source: "manual", status: "proposed", by: "t", role: "builder" });
    await decide(db, id, { status: "live", role: "Reviewer" });
    expect((await getLesson(db, id))?.role).toBe("reviewer");
    await decide(db, id, { role: "" });
    expect((await getLesson(db, id))?.role).toBeNull();
  });
});
