import { beforeEach, describe, expect, it } from "vitest";
import { suggestKeyword } from "../src/commands/review.js";
import { openDb } from "../src/store/db.js";
import { combine, createLesson, decide, getLesson, keywordsInUse, lessonsForKeyword } from "../src/store/lessons.js";
import { useHome } from "./helpers.js";

beforeEach(useHome);
describe("suggestKeyword", () => {
  it("prefers a command or path, then the most specific word", () => {
    expect(suggestKeyword("Run `pnpm test:estimate` before pushing")).toBe("pnpm");
    expect(suggestKeyword("Use ../../benchmarks from `apps/api`")).toBe("apps");
    expect(suggestKeyword("Set the API key before estimate tests")).toBe("estimate");
  });
});
describe("keywords and combining", () => {
  it("lists keywords in use and orders shared ones as delivery would", async () => {
    const db = await openDb();
    const a = await createLesson(db, { repo_id: null, text: "a", source: "manual", status: "live", by: "person" });
    const b = await createLesson(db, { repo_id: null, text: "b", source: "manual", status: "live", by: "person" });
    await decide(db, a, { triggers: ["deploy"] });
    await decide(db, b, { triggers: ["Deploy"], alwaysOn: true });
    expect(await keywordsInUse(db, null)).toEqual([{ pattern: "deploy", lessons: 2 }]);
    expect((await lessonsForKeyword(db, null, "deploy")).map((l) => l.text)).toEqual(["b", "a"]);
  });
  it("combining retires the other and moves its evidence and keywords", async () => {
    const db = await openDb();
    const keep = await createLesson(db, { repo_id: null, text: "keep", source: "manual", status: "proposed", by: "learn" });
    const other = await createLesson(db, { repo_id: null, text: "other", source: "manual", status: "live", by: "learn" });
    await decide(db, other, { triggers: ["simplify"] });
    await db.execute({ sql: "INSERT INTO evidence VALUES (?,?,?,?,?)", args: [other, "codex", "s", "t", "explain simply"] });
    await combine(db, keep, other, "Keep answers short and plain.");
    expect((await getLesson(db, other))!.status).toBe("retired");
    expect((await getLesson(db, keep))!.text).toBe("Keep answers short and plain.");
    expect((await db.execute({ sql: "SELECT count(*) n FROM evidence WHERE lesson_id=?", args: [keep] })).rows[0]!.n).toBe(1);
    expect((await db.execute({ sql: "SELECT pattern FROM triggers WHERE lesson_id=?", args: [keep] })).rows[0]!.pattern).toBe("simplify");
  });
});
