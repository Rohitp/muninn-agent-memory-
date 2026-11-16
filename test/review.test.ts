import { beforeEach, describe, expect, it } from "vitest";
import { suggestKeyword, worthSentence } from "../src/commands/review.js";
import { openDb } from "../src/store/db.js";
import { combine, createLesson, decide, getLesson, keywordsInUse, lessonsForKeyword } from "../src/store/lessons.js";
import { useHome } from "./helpers.js";

beforeEach(useHome);
describe("suggestKeyword", () => {
  it("prefers a command or path, then the most specific word", () => {
    expect(suggestKeyword("Run `pnpm test:estimate` before pushing")).toBe("estimate");
    // Command runners and everyday words come up in nearly every prompt, so they're never suggested.
    expect(suggestKeyword("Run inline Python with `uv run python - <<'EOF'` rather than `python3 - <<'EOF'`, and keep deletions out of heredocs")).toBe("deletions");
    expect(suggestKeyword("Use `uv run ruff format` before committing")).toBe("ruff");
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

describe("worthSentence", () => {
  it("weighs what the problem wasted against what telling it costs, in a sentence", () => {
    expect(worthSentence({ text: "x".repeat(160), wasted_tokens: 4200 }, "keyword")).toBe("The problem wasted about 4,200 tokens. Telling agents costs about 40 tokens each time it comes up.");
    expect(worthSentence({ text: "x".repeat(160), wasted_tokens: 4200 }, "always")).toContain("40 tokens each session");
    // Nothing measured, or too little to matter: no sentence.
    expect(worthSentence({ text: "Keep answers short.", wasted_tokens: null })).toBeNull();
    expect(worthSentence({ text: "Keep answers short.", wasted_tokens: 10 })).toBeNull();
  });
});

describe("when a lesson would have been told", () => {
  it("tries the words on past prompts and failed commands, and says when a word is too common or never comes up", async () => {
    const { replay } = await import("../src/learn/replay.js");
    const s = (id: string, events: any[]) => ({ id, tool: "claude-code" as const, cwd: "/x", clientVersion: "1", unknown: 0, events });
    const sessions = [
      s("a", [{ k: "typed", text: "run the ruff checks please", ts: "2026-11-01T10:00:00Z" }]),
      s("b", [{ k: "cmd", cmd: "uv run ruff check .", failed: true, output: "Found 1 error", ts: "2026-11-02T10:00:00Z" }]),
      s("c", [{ k: "cmd", cmd: "uv run ruff check .", failed: false, output: "ok", ts: "2026-11-03T10:00:00Z" }, { k: "typed", text: "ship it", ts: "2026-11-03T10:01:00Z" }]),
    ];
    const r = replay("repo", "keyword", ["ruff"], sessions);
    // A successful command isn't something the hooks see, so session c doesn't count.
    expect(r).toMatchObject({ sessions: 3, told: 2 });
    expect(r.examples.map((e) => e.where)).toEqual(["your prompt", "a failed command"]);
    expect(replay("repo", "keyword", ["heredoc"], sessions).sentence).toContain("never came up");
    expect(replay("repo", "keyword", ["ruff", "ship"], sessions).sentence).toContain("most of them");
    expect(replay("repo", "always", [], sessions).sentence).toBe("It would have been told at the start of all 3 of your sessions here.");
  });
});
