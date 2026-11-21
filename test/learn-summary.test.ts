import { describe, expect, it } from "vitest";
import { repoBlock, scanSummary } from "../src/commands/learn-summary.js";
import type { Scan } from "../src/logs/discover.js";
import type { Session } from "../src/logs/types.js";

const s = (tool: Session["tool"]): Session => ({ id: Math.random().toString(), tool, cwd: "/x", clientVersion: "1", events: [], unknown: 0 });
const scan = (byRepo: Record<string, Session[]>, missingFolder = 0): Scan => ({
  sessions: Object.values(byRepo).flat(), byRepo: new Map(Object.entries(byRepo)), missingFolder, ownRuns: 0,
  files: { claude: 46, codex: 0, cursor: 0, antigravity: 7 },
});
const dart = "github.com/rohitp/dartboard"; const mun = "github.com/rohitp/muninn";

describe("what muninn learn says first", () => {
  it("leads with this repo and its sessions by tool, then one line about the rest", () => {
    expect(scanSummary(scan({ [dart]: [s("antigravity")], [mun]: [s("claude-code"), s("claude-code")] }, 7), dart, new Set())).toEqual([
      "This repo, rohitp/dartboard: reading 1 session (1 Antigravity).",
      `Elsewhere on this machine: 2 sessions in 1 other repo, learned from on their own as you work there or with "muninn learn --all-repos". 7 sessions you typed in ran outside a git repo, such as a question asked with no project open, so there's no repo to learn them for.`,
    ]);
  });
  it("says plainly when nothing ran in this repo, and what it looked through", () => {
    expect(scanSummary(scan({ [mun]: [s("claude-code")] }), dart, new Set())[0]).toBe("This repo, rohitp/dartboard: no sessions yet. muninn looked through 46 Claude Code and 7 Antigravity conversation logs on this machine and none of them ran here.");
  });
  it("says when this repo is ignored", () => {
    expect(scanSummary(scan({ [dart]: [s("cursor")] }), dart, new Set([dart]))[0]).toMatch(/you told muninn to ignore it/);
  });
  it("lists every repo for --all-repos, busiest first, leaving out ignored ones", () => {
    expect(scanSummary(scan({ [dart]: [s("antigravity")], [mun]: [s("claude-code"), s("antigravity")], "github.com/a/b": [s("codex")] }), null, new Set(["github.com/a/b"]))).toEqual([
      "Looked through 46 Claude Code and 7 Antigravity conversation logs. Reading 3 sessions in 2 repos:",
      "  rohitp/muninn: 1 Claude Code and 1 Antigravity",
      "  rohitp/dartboard: 1 Antigravity",
    ]);
  });
});

describe("each repo's block after the scan", () => {
  const base = { repo: "github.com/rohitp/servanda", sessions: 9, minSessions: 3, moments: 5, known: 2, newLessons: 0, noise: 3, review: null, notes: [] };
  it("leads with what's new, counting the long-session reading too, then how it was found", () => {
    expect(repoBlock({ ...base, review: { calls: 2, sessions: 1, added: 5, known: 0 }, notes: ['Two kept lessons come from the same quotes: "A" and "B".'] })).toEqual([
      "rohitp/servanda (9 sessions): 5 new suggestions, waiting in muninn ui.",
      "  Spotted 5 moments: 2 matched lessons you already have, 0 new and 3 judged noise by your Claude.",
      "  Read 2 parts of 1 long session: 5 new suggestions.",
      '  Two kept lessons come from the same quotes: "A" and "B".',
    ]);
  });
  it("says plainly when nothing is new, and why repeats need more sessions", () => {
    expect(repoBlock({ ...base, repo: "github.com/rohitp/dartboard", sessions: 1, moments: 0, known: 0, noise: 0 })).toEqual([
      "rohitp/dartboard (1 session): nothing new.",
      "  Only 1 session so far. Something you say again counts once it's in 3 sessions.",
    ]);
  });
});

describe("counts in a repo's block", () => {
  it("says one match in the singular, and leaves out noise nobody judged", () => {
    expect(repoBlock({ repo: "github.com/rohitp/claude-mods", sessions: 4, minSessions: 3, moments: 1, known: 1, newLessons: 0, noise: 0, review: null, notes: [] })[1])
      .toBe("  Spotted 1 moment: 1 matched a lesson you already have and 0 new.");
  });
});
