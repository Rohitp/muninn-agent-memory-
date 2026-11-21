import { describe, expect, it, beforeEach } from "vitest";
import { askData, stem } from "../src/commands/ask.js";
import { openDb } from "../src/store/db.js";
import { createLesson } from "../src/store/lessons.js";
import { useHome } from "./helpers.js";

beforeEach(() => useHome());

describe("muninn ask only returns lessons that match", () => {
  it("needs most of the question's words, and its most distinctive one", async () => {
    const db = await openDb();
    await createLesson(db, { repo_id: null, scope: "global", text: "When ruff check reports errors, fix them before re-running; the chain fails the same way otherwise.", source: "manual", status: "live", by: "t" });
    await createLesson(db, { repo_id: null, scope: "global", text: "Keep deletions out of inline scripts: the safety check blocks the whole script, so nothing runs and it keeps failing.", source: "manual", status: "live", by: "t" });
    await createLesson(db, { repo_id: null, scope: "global", text: "Check new code for edge cases before a milestone is done, so problems don't show up after release.", source: "manual", status: "live", by: "t" });
    const texts = async (q: string) => (await askData(db, q, null, { embed: undefined })).map((h) => h.text.slice(0, 20));
    expect(await texts("ruff check keeps failing")).toEqual(["When ruff check repo"]);
    expect(await texts("how do we release a new version to npm")).toEqual([]);
    expect(stem("failing")).toBe("fail"); expect(stem("keeps")).toBe("keep"); expect(stem("npm")).toBe("npm");
  });
});
