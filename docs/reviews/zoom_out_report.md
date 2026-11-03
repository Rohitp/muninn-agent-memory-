# Zoom-Out Review: `/Users/rohit/projects/muninn/docs/designs/muninn.md`

**Verdict: revise before implementation.** There are 2 Blockers, 12 Majors and 3 Nits.

The objective and root problem are clear, so the context check passes. The main fault is the order of work. The cheapest tests of the riskiest assumptions run last, or not at all.

**Review limits**
- The repo has no source code, so there is nothing in it to reuse.
- There is no `README.md` or `context.md`, so I could not check alignment against root documentation.
- I did not read `agents.md` or `concepts_brief.md`, so "Author" attributions are unverified.
- Client and Memryzed claims rest only on `docs/checks/`, which reports no live client tests and no Memryzed run. Client behaviour below is documented or read from code, not seen working. The same applies to Memryzed behaviour.

## Blockers

### 1. The designed triggers cannot deliver the main lesson before the run
- **Severity:** Blocker
- **Affected Scope:** L92-93, L97, L182, L279-281, L298-308
- **Simplicity Rationale:**
  - The example trigger for the token lesson is the script's command. A command trigger can only match in two places.
  - At `UserPromptSubmit`, it matches only if the prompt contains the command, and "run the script" may not.
  - At `PostToolUse`, it fires after the run has started. For a foreground script, that may be hours later (my inference, untested).
  - `PreToolUse` is explicitly not used (L305-308), so L182's "before the run" has no general path.
  - The only delivery that clearly works is always-on at session start. That is close to what an instruction file already does (L63-65).
  - The document therefore has no example that needs a generated trigger.
  - Before building a trigger engine, classify the spike's 20 real instructions as "always-on is enough" or "needs a specific moment". If few need a moment, cut triggers from the first version.

### 2. The test that could end the project comes after everything is built, with no decision rule
- **Severity:** Blocker
- **Affected Scope:** L63-65, L111-113, L394-398, L775-777
- **Simplicity Rationale:**
  - The document says muninn "has to do better" than instruction files, but sets no margin and no consequence.
  - The comparison appears only in the final verification, after about 36 work items.
  - I am not reopening the author's rejection of instruction files as the product, only the timing.
  - Adding the two lines to the instruction files costs minutes. A small throwaway repeat counter could run in Step 0, reusing the spike's matching work.
  - Claude Code's auto memory is on by default, saves corrections and loads them each session (client-capabilities L37, L68). It is a third arm of the comparison, and the plan doesn't control for it.
  - The check that would settle this has not been done: memryzed-read L295 and L297 say native memory was not assessed.

## Major: generated triggers

### 3. No step evaluates trigger quality
- **Severity:** Major
- **Affected Scope:** L154-155, L277-281, L376-386, L649-653, L680-682, L773-774, L775
- **Simplicity Rationale:**
  - The spike compares keyword search and embeddings, but never tests suggested triggers.
  - The Stage 1 gate measures whether lessons are kept, not whether their triggers work.
  - The end-to-end test only covers a new session and compaction, so it can pass on session-start delivery alone. Item 33 tests matching, but not delivery to a model.
  - The 90% relevance check samples deliveries, so it cannot see misses. Open Question L155 therefore has no answer path.
  - The heuristic also looks wrong for its own example. After "refresh the token first", the next command is probably the refresh, not the script (my inference).
  - Calling this "the intelligence" (L277) overstates what is a proximity rule with no LLM.
  - Move trigger generation out of Stage 1. It has no consumer there, and its design depends on Stage 2 client tests.

### 4. Inferred triggers bypass approval and have no correction path
- **Severity:** Major
- **Affected Scope:** L94-96, L270, L283, L319, L344, L360, L373, L197
- **Simplicity Rationale:**
  - An `own_words` lesson can go live unreviewed while firing on machine-inferred triggers, so the "inferred waits" rule covers only the text.
  - The review, UI and CUJ 4 descriptions never mention viewing or editing triggers. If a trigger is wrong, retiring the lesson is the only described remedy.
  - A kept lesson with no trigger and no always-on mark is never delivered automatically, with no warning. That conflicts with the "Failures are visible" goal (L87). `muninn learn` should say so at the moment of keeping.

### 5. Automatic go-live has weak foundations
- **Severity:** Major
- **Affected Scope:** L94-96, L259-261, L284, L319, L441, L504, L623-624
- **Simplicity Rationale:**
  - Repeated sentences such as "run the tests" or "commit this" satisfy the rule as written, and would go live.
  - Output is limited to the "strongest few" (L284), and nothing says whether unshown `own_words` candidates still go live.
  - The safety claim depends on separating typed text from pasted text. The structure scan in client-capabilities row 4c does not cover this, so that distinction is unverified.
  - If it fails, repeated pasted text could reach agents as guidance, the outcome L441 warns about.
  - The simplest first version is that nothing goes live until it has been kept. Stage 1's review flow already exists to do this.

## Major: proposed gate numbers

### 6. The Stage 1 gate cannot be run or interpreted as written
- **Severity:** Major
- **Affected Scope:** L148-150, L284, L680-682, L751-755, L163-165
- **Simplicity Rationale:**
  - **Undefined middle:** keep rates from 25% to 50% neither pass nor stop, and "after tuning" has no limit.
  - **Weak denominator:** "lessons shown" is capped at an undefined "strongest few". Showing fewer lessons raises the score.
  - **Same data:** tuning and measurement can use the same repos, and the token lesson is already known. Hold out at least one repo.
  - **Movable bar:** L150 revises the numbers after the first real runs, which are the runs being judged. Fix the numbers before measuring, and log any change.
  - **Weak proxy:** "kept" shows approval, not usefulness.
  - **Sequencing:** two outside engineers must run it, yet the README is item 34 in Step 2 and the package name is open.
  - **False signal:** in Stage 1 a kept lesson does nothing, so "runs it again" has little reason to happen. A failure may be a false negative, and a pass from two friends proves little.
  - Treat outside runs in Stage 1 as qualitative feedback, and move the return-use test to after delivery exists.

### 7. The Stage 2 numbers are not a gate
- **Severity:** Major
- **Affected Scope:** L110-118, L536, L775-777
- **Simplicity Rationale:**
  - L536 says each step ends at a gate, but missing 70% or 90% has no stated consequence.
  - Baseline window, rate unit, sample size and judge are all undefined. "Per session" should replace raw counts, because Claude Code's 30-day retention shapes the baseline.
  - The author knows the tool exists and may stop repeating anyway, so "repeats dropped" can improve with delivery broken.
  - For the main case, a direct check is better: did the agent refresh the token before the run without being told?
  - The heading "Wrong or irrelevant" promises wrong lessons are measured, but only relevance is. The harm named at L67 has no measure.

### 8. The Step 0 gate misses decisions the spike exists to make
- **Severity:** Major
- **Affected Scope:** L212, L378-384, L572-573, L586-587
- **Simplicity Rationale:**
  - "Embeddings catch no more than keyword search" is passed by one extra catch in 20, which is noise. Embeddings justify the model download and the vector store, so set a margin in advance.
  - The vague-question test (L384), the 500 ms test (L381) and first-run time (L382) have no pass bar or failure branch.
  - A vector column failure is missing from the switch condition, and the plain SQLite fallback has no stated vector approach.
  - Memryzed stores vectors as blobs and scans them in full (memryzed-read L186, L193). For one engineer's lessons, that may be enough without libSQL.
  - Make that the expected fallback, and have the spike ask whether vector columns earn their place at all.

## Major: Stage 2 detail resting on untested checks

### 9. The planned tests do not cover core delivery, and they run too late
- **Severity:** Major
- **Affected Scope:** L92-93, L298-303, L386, L686-690
- **Simplicity Rationale:** The table reads as settled, but the evidence is uneven:

| Design claim | Evidence | Planned test |
|---|---|---|
| Codex `UserPromptSubmit` and `PostToolUse` context reaches the model | Documented. Code evidence covers only the `PostToolUse` field being parsed. | None directly |
| Claude Code `UserPromptSubmit` and `PostToolUse` context reaches the model | Documented only | None directly |
| Codex `SessionStart` at session start | Documented, plus one third-party report on `codex exec` 0.154.0 (client-capabilities L74) | None directly (test 6 covers only `compact`) |
| Codex restore after compaction | Queued, runs on a later turn, never seen delivering | Test 6 |
| Untrusted Codex hook behaviour | Unknown | Test 15 |

  - 180 of 185 recorded Codex threads match the desktop app's version, while the documented checks centre on the CLI. Test 6 names the 0.155 build, and test 9 names the desktop app. No test checks ordinary hook delivery there.
  - Add a small matrix: each planned hook, each client build, and whether the model repeats a made-up fact.
  - Drop tests that don't apply to this plan. Cursor tests can wait, and size tests matter little with a 300-token cap, leaving perhaps 8 or 9 of the 19.
  - Run the matrix in Step 0. It is cheap, it could change the trigger design, and migration 001 otherwise fixes that design first.
  - L92-93 sets a firm goal for both tools while L97-99 hedges. State what happens to the goal if Codex fails.

### 10. MCP process lifetime is stated as fact but recorded as unknown
- **Severity:** Major
- **Affected Scope:** L224-225, L325-326, L330-333, L339-341
- **Simplicity Rationale:**
  - The design says the server lives as long as its agent session, and that only the first search pays the load cost.
  - Client-capabilities row 5c lists process lifetime as unknown for all three clients, including whether the desktop app shares a server across projects.
  - A shared server would break current-repo scoping, not just the load-cost claim.
  - L341 limits the doubt to the desktop app, but no live Codex server has been seen anywhere (row 5a, L99).

### 11. Hooks will probably also run in the "unsupported" Cursor
- **Severity:** Major
- **Affected Scope:** L137, L158, L294-296, L315, L754
- **Simplicity Rationale:**
  - Cursor reads `~/.claude/settings.json` by default and maps the events muninn uses (client-capabilities L84).
  - A Claude Code install could therefore fire inside Cursor, for example with wrong tool attribution in the log. Whether its output is honoured is test 16.
  - The design never mentions this, and the README would call Cursor unsupported.
  - The hook should detect the calling client and do nothing for Cursor, unless that is decided otherwise.

### 12. Compaction restore conflicts with the limits
- **Severity:** Major
- **Affected Scope:** L98, L301, L310-311
- **Simplicity Rationale:**
  - Hook text is summarised away by compaction (client-capabilities L28, L63).
  - "Once after compaction" leaves no allowance for a second compaction, which long sessions may reach.
  - Re-delivery also draws on the 1,000-token session cap.
  - Restore should be limited per compaction, not per session.

## Major: scope and reuse

### 13. Stage 2 bundles separate bets, and several pieces have no user need
- **Severity:** Major
- **Affected Scope:** L267, L339, L358, L335-337, L374, L606, L661-665, L692-742
- **Simplicity Rationale:**
  - The only numeric success measures cover delivery, yet Stage 2 also ships the command index, search, MCP and UI. Sequence them as delivery, measure, then the rest.
  - **`save_lesson`:** no CUJ needs it, and it adds an agent write path.
  - **`import`:** no CUJ or goal needs it.
  - **`blocking` flag:** it is stored for behaviour the plan does not build (L305-308, L358).
  - **Corrections and failure-then-fix signals:** by the document's own account, repeats are the main signal (L267). Start with repeats and add others if the gate shows a gap.
  - **Five command-index sources:** start with manifests, Makefiles and commands seen to succeed.
  - **Migration 001:** it creates Stage 2 tables during Stage 1, although numbered migrations exist to add them later.

### 14. Existing work is checked too late or ignored in the plan
- **Severity:** Major
- **Affected Scope:** L55-56, L287, L485-490, L530, L632-636
- **Simplicity Rationale:**
  - OpenMemory and agentmemory are assessed "before public release", after the build. This should be a short Step 0 read.
  - The Memryzed read recommends using it as a reference for redaction rules, transcript formats, rank fusion and installer config handling (memryzed-read L283). Items 13, 15, 27 and 29 don't pick this up.
  - The design adds high-entropy checks, while Memryzed's well-regarded redactor deliberately avoids guessing from entropy (memryzed-read L164). This choice needs a reason, since it can damage evidence quotes.
  - L485 states Apache-2.0 flatly, while the read says to check this before reusing code (memryzed-read L212).

## Nits

### 15. Capture cadence is undefined
- **Severity:** Nit
- **Affected Scope:** L187, L204, L285, L289, L335, L373
- **Simplicity Rationale:** With no background program, nothing says when logs are rescanned or when the command index is built. A missed 30-day window loses Claude Code evidence for good. State that it's manual, or have `status` warn. This may rise to Major if `muninn learn` turns out to be run rarely.

### 16. "Nothing leaves the machine" is misleading
- **Severity:** Nit
- **Affected Scope:** L17-18, L290, L330, L502
- **Simplicity Rationale:** muninn sends nothing itself, but its purpose is to put text into agent context, which hosted models may receive. With cross-repo search on by default, one employer's lessons could reach an agent working for another. Reword the claim, and weigh this in Open Question L151-153 before public release.

### 17. Hook timing and housekeeping gaps
- **Severity:** Nit
- **Affected Scope:** L352, L381, L505, L572, L757-765
- **Simplicity Rationale:**
  - The latency spike omits the log write and contention from a long `muninn learn`, which could turn into silent non-delivery.
  - Launching hooks through `npx` could exceed the limit, and a pinned version in the hook command could trigger Codex re-trust on each upgrade (my inference; test 15).
  - An untrusted hook never runs, so it logs nothing, and `status` must treat silence as a possible fault (L204, L315).
  - Items 35 and 36 sit at the end of Step 2, though gate logging starts at Step 0 and the design is already saved at `docs/designs/muninn.md`.

## Recommended order
1. **Run the cheap tests first.** In Step 0, run the instruction-file and auto-memory baseline, the reduced client matrix, the always-on versus specific-moment classification, and the short competitor read.
2. **Fix the gates.** Set every pass, stop and middle outcome before measuring.
3. **Build the learner.** Use repeats only, with no triggers, and require a kept decision before anything goes live.
4. **Build delivery and measure it.** Add triggers only if the classification justifies them.
5. **Build the rest.** Add search, the command index, MCP and the UI after that measurement.
