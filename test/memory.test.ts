import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { checkRepo, keepLine, openFlags, refsOf, removeLine, restoreLine, saveFlags } from "../src/memory/stale.js";
import { openDb } from "../src/store/db.js";
import { session, tmp, useHome } from "./helpers.js";

let root = "";
beforeEach(() => {
  useHome();
  root = join(tmp(), "repo"); mkdirSync(join(root, "core/tests"), { recursive: true });
  execFileSync("git", ["init", "-q", root]);
  writeFileSync(join(root, "core/tests/test_a.py"), "");
  writeFileSync(join(root, "Makefile"), "check:\n\techo ok\ntry-sample:\n\techo ok\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
  execFileSync("git", ["-C", root, "add", "."]);
  writeFileSync(join(root, "CLAUDE.md"), [
    "# Notes",
    "- Read `BRIEF.md` first.",
    "- Run `make check` before committing.",
    "- Run `make lint` for style.",
    "- Start with `pnpm dev`, not `pnpm serve`.",
    "- Tests sit in `tests/` next to each package.",
    "- Every chunk has a `make try-…` command.",
    "- Money is `Decimal`, dates are `datetime.date`.",
    "```",
    "- `old/path.md` inside a code block is ignored",
    "```",
  ].join("\n"));
});

describe("stale CLAUDE.md lines", () => {
  it("reads paths and commands from backticks, not code names or placeholders", () => {
    expect(refsOf("Read `BRIEF.md` and `src/a/` then run `make check`; `Decimal`, `datetime.date`, `m<n>/<name>`")).toEqual({ paths: ["BRIEF.md", "src/a/"], commands: ["make check"] });
  });
  it("flags a missing file, a missing make target and a missing script, and nothing else", () => {
    const flags = checkRepo(root, []);
    expect(flags.map((f) => [f.line, f.reason, f.detail])).toEqual([
      [2, "missing_path", "`BRIEF.md` isn't in the repo"],
      [4, "missing_command", "`make lint` isn't a target in the Makefile"],
      [5, "missing_command", "`serve` isn't a script in package.json"],
    ]);
  });
  it("flags a line nothing in 5 sessions touched", () => {
    writeFileSync(join(root, "BRIEF.md"), "");
    writeFileSync(join(root, "CLAUDE.md"), "- Run `make check` before committing.\n- Read `BRIEF.md` first.\n");
    const s = Array.from({ length: 5 }, (_, i) => ({ ...session(`s${i}`, i + 1, ["hi"]), events: [{ k: "cmd" as const, cmd: "make check", failed: false, output: "", ts: "" }] }));
    expect(checkRepo(root, s).map((f) => [f.line, f.reason])).toEqual([[2, "unused"]]);
    expect(checkRepo(root, s.slice(0, 4))).toEqual([]);
  });
  it("removes a line, puts it back, and remembers a line you kept", async () => {
    const db = await openDb();
    await db.execute({ sql: "INSERT INTO repos (id,paths) VALUES (?,?)", args: ["r", JSON.stringify([root])] });
    await saveFlags(db, "r", checkRepo(root, []));
    const [brief, lint] = await openFlags(db, "r");
    expect(await removeLine(db, brief!.id, root)).toBe(true);
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8")).not.toContain("BRIEF.md");
    expect(await restoreLine(db, brief!.id, root)).toBe(true);
    expect(readFileSync(join(root, "CLAUDE.md"), "utf8").split("\n")[1]).toBe("- Read `BRIEF.md` first.");
    await keepLine(db, lint!.id);
    await saveFlags(db, "r", checkRepo(root, []));
    expect((await openFlags(db, "r")).map((f) => f.id)).not.toContain(lint!.id);
  });
});
