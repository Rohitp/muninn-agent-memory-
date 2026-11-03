# muninn — Devlog

Chronological journal of the build. One dated entry per working session.
Each entry records **decisions**, **gotchas**, **failed attempts**, and **timings** —
the same categories muninn may later hold as lessons. Whether and how the durable
items move into muninn is decided once Stage 2 delivery passes its gate. Gate results
are logged here.

Entry template:
```
## YYYY-MM-DD — <short title>
**Did:** …
**Decided:** … (why)
**Gotcha:** … (what bit us, how we found it)
**Failed attempt:** … (what we tried, why it didn't work — so we don't repeat it)
**Next:** …
```

---

## 2026-11-03 — Project kickoff: EGM setup

**Did:**
- Read the build spec (`agents.md`): muninn is a local, shared memory daemon for
  coding agents, exposed over MCP. libSQL (vectors + FTS5) + local ONNX
  embeddings, long-lived daemon owning the DB, stdio shim injecting `cwd`.
- Decided to drive the build with the Elephant-Goldfish Model (EGM) plugin:
  draft a formal design doc from `agents.md`, harden it with fresh-context
  Goldfish review, then implement phase-by-phase. (Dogfoods the exact workflow
  muninn is built to support.)
- Upgraded Claude Code and installed the EGM plugin.

**Decided:**
- Maintain this devlog + `implementation-plan.md` in markdown now; migrate
  durable findings into muninn once Phase 1 (`recall`/`remember`) is functional,
  then register muninn's MCP server with Claude Code to dogfood it. Markdown
  first because the data model/API is still moving through Phases 1–2.

**Gotcha (Claude Code version / Goldfish isolation):**
- EGM `docs/claude.md` requires Claude Code **≥ 2.1.271** for `omitClaudeMd`
  support; below that, Goldfish reviewers are *not* a verified isolation
  environment (they'd inherit `CLAUDE.md`/project instructions, defeating the
  fresh-context premise).
- Found **three** parallel Claude Code installs, with the one `which claude`
  resolved to being the stale one:
  - `/opt/homebrew/bin/claude` → **2.1.169** (too old; this is what launched the session)
  - fnm node global → 2.1.296 (ok)
  - `~/.claude/local/claude` → 2.1.282 (ok)
- Fix: `npm install -g @anthropic-ai/claude-code@latest` against Homebrew's npm
  → upgraded the stale install to **2.1.317**. All three paths now ≥ 2.1.271.
- Caveat: a running session can't hot-swap its binary — must fully quit and
  relaunch to actually run the new version.

**Did (EGM install):**
- `claude plugin marketplace add ~/github/elephant-goldfish-model` (local clone;
  marketplace name `egm`)
- `claude plugin install egm@egm` → installed, scope user, enabled.
- The `Default agents/ folder is ignored because the manifest sets "agents"`
  notice is expected per EGM's docs (adapters are listed explicitly).

**Next:**
- Relaunch Claude Code on 2.1.317; confirm `/egm:` commands appear.
- Run `/egm:egm-draft` with `agents.md` as the Context File → produce
  `docs/designs/muninn.md` section-by-section.
- Then `/egm:egm-review` on it.

---

## 2026-11-03 — Restarted from brainstorm; first build narrowed

**Did:**
- Started `/egm:egm-draft` from `agents.md`, then stopped: the spec says how to build but not why. `design_draft.md` is parked and out of date.
- Ran `/egm:egm-brainstorm`: six Goldfish reviewers, then read Memryzed's source and checked client capabilities. Results are in `concepts_brief.md` and `docs/checks/`. All of it is static; nothing ran live.

**Decided:**
- The name is muninn. It's for individual engineers: the author first, then a public release.
- First build is a small local learner that reads past logs and proposes lessons with evidence. No delivery, UI, daemon or database yet. Reads the current repo only by default. Supports Claude Code and Codex.
- `claude-mods` stays a separate side project. Its ideas can be reused.
- Benchmark is what an engineer's agent already does, not Memryzed alone.

**Gotcha:**
- Memryzed's README overstates what its code does (no edit, most content unreviewed, capture for three clients only).
- Claude Code and Codex log formats are not stable, and Claude Code logs last 30 days by default. Cursor logs have no tool output or repo data.
- Goldfish reviewers can read anything local unless told otherwise. They scanned session logs outside this repo, and one search found 20 secret-shaped strings in Codex logs (not checked for validity). Limit local access explicitly in future reviewer prompts.

**Next:**
- Draft saved to `docs/designs/muninn.md`. Decisions: libSQL with vectors, local embedding model, no background program, approve risky lessons only, labelled agent search across repos (provisional).
- npm names `muninn` and `muninn-cli` are taken, so the package needs a scoped or different name.
- Run `/egm:egm-review docs/designs/muninn.md`, then the Step 0 spike.

---

## 2026-11-03 — EGM review of the design; plan rewritten

**Did:**
- Ran all five `/egm:egm-review` stages on `docs/designs/muninn.md`. Reports are in `docs/reviews/`. Accepted every Stage 9 fix: lines 534-782 replaced, with matching edits to lines 1-533.

**Decided:**
- A database (libSQL, with the plain SQLite fallback) is in the first build. This replaces "no database yet" in the earlier 2026-11-03 entry.
- Generated triggers and `PostToolUse` delivery are cut from the first version. Lessons are always-on or use a literal keyword. Cost: the token lesson is delivered much as an instruction line would be, so muninn's edge there is learning and sharing it.
- Lessons go live only when kept, edited or added by hand. This reverses the earlier risk-based approval, because without generated triggers an unreviewed lesson has no route to an agent. The cost is that review can become a chore.
- Token gates are judgement calls with fixed conditions and a no-line control. Five runs are not a statistical test, and a one-run difference counts as no difference.
- Hook speed gate is p95 under 400 ms, tightened from 500 ms.
- A re-audit found the plan still not ready. Step 0 and the gates were rewritten. Steps 1-3 stay provisional until the Settle After Step 0 list clears and gets reviewed again.
- Three decision gates with an outcome for every result, with Step 0's covering both the trial and the stack. The 70% and 90% figures are reported, not gates. The author accepted the proposed numbers before Step 0. They still have no evidence behind them.
- The client matrix moves to Step 0. The MCP server is deferred in favour of `muninn ask`, pending check M4.
- Each `learn` re-reads all available logs, because incremental scans can't count a repeat across runs.
- Stage 1 uses four signals, plus `muninn add`. CI and README commands are deferred.

**Gotcha:**
- Reviewer summary counts were wrong in three reports. Count severity labels instead.
- Later fixes to the feature section corrected the instruction-file, built-in memory and privacy claims, and added a short risk section. Other Stage 7 and 8 findings there stay open, including the Alternatives Rule wording and style. Growth limits were skipped on purpose.

**Next:**
- Human review of the changed design, then Step 0.

## 2026-11-03 — Thesis: find what nobody stated

**Did:**
- Searched typed text in three of the author's repos for repeated instructions, using a throwaway word-matching script. Nothing from the logs went into the repo.
- Rewrote the design around the result, after the author rejected a hand audit of repeats as "faster horses".

**Decided:**
- muninn is judged by what it finds that the engineer did not already know. Repeats alone would hand back things a line in `CLAUDE.md` could hold, so corrections, failure-then-fix and mistakes that came back are in Stage 1. This reverses the earlier cut.
- The keep rate counts only lessons that were news to the engineer. The proposed bars change to 1 in 3 to continue and 1 in 10 to stop.
- The token lesson is an illustration only. No gate depends on a named example. The delivery gate uses 2 lessons the author picks, with a control, a line and a muninn arm.
- The instruction-line trial moved from Step 0 to the delivery gate. The cost is losing an early stop.
- The gates use 2 author repos, one for tuning and one held out, because a third had too little history. That leaves 20 lessons per judged run.
- The first Step 0 check is now running the rules on real logs, because rules with no LLM may not produce readable lessons.

**Gotcha:**
- 59 of 79 repeated groups had identical wording, which suggests resumed sessions or pasted text. Agent answers also appear as typed text, likely from pasting between tools. `caffeinate` appeared in no session in those three repos, and refreshing a token in only 4.

**Next:**
- Author reviews the changed design, then Step 0.

## 2026-11-03 — Step 0 cleanup and project setup

**Did:**
- Moved `agents.md` to `docs/archive/original-build-spec.md`, replaced the tracker's old phases, deleted `design_draft.md` (still in git at `a7912f5`), and created the package and build config.

**Next:**
- Item 5, saving logs, once the author has raised `cleanupPeriodDays`.

