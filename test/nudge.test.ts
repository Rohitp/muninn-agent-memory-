import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { deliver } from "../src/deliver/hook.js";
import { repoIdentity } from "../src/repo/identity.js";
import { openDb } from "../src/store/db.js";
import { ensureRepo } from "../src/store/lessons.js";
import { indexSessions } from "../src/store/sessions.js";
import { fakeEmbed, tmp, useHome } from "./helpers.js";

let root = ""; let repo = "";
beforeEach(async () => { useHome(); root = join(tmp(), "shop"); mkdirSync(root); execFileSync("git", ["init", "-q", root]); repo = repoIdentity(root)!; await ensureRepo(await openDb(), repo, root); });

describe("telling agents to look things up", () => {
  it("says when at the start, and again right after the conversation is compressed", async () => {
    const db = await openDb();
    const file = join(tmp(), "log.jsonl"); writeFileSync(file, "x");
    await indexSessions(db, [{ id: "s1", tool: "claude-code", cwd: root, clientVersion: "1", unknown: 0, file, events: [
      { k: "typed", text: "rename the package to secondnature", ts: "2026-11-20T13:55:00.000Z" },
      { k: "agent", text: "Renamed, because muninn was taken on npm.", ts: "2026-11-20T13:55:10.000Z" },
    ] }], fakeEmbed);
    const start = await deliver(db, "claude-code", { hook_event_name: "SessionStart", source: "startup", session_id: "a", cwd: root });
    expect(start).toContain('muninn related "that decision or fix"');
    const after = await deliver(db, "claude-code", { hook_event_name: "SessionStart", source: "compact", session_id: "a", cwd: root });
    expect(after).toContain("This conversation was just compressed");
    expect(after).toContain('muninn recall "what you\'re looking for": this repo\'s stored sessions (1)');
    expect(await deliver(db, "claude-code", { hook_event_name: "SessionStart", source: "resume", session_id: "a", cwd: root })).toBeNull();
  });
});
