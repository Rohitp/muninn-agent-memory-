Status: resolved

# Goldfish Annotated Review Report

**Target:** `docs/designs/muninn.md` (lines 553-875)

**Findings source:** `implementation_readiness_report_round2.md`: 8 Blockers, 22 Majors, 10 Nits.

**Result:** 38 PROPOSE FIX, 0 CONTEST, 0 ESCALATE, 2 DECLINE. Nothing in the design has changed yet.

**Approach:** Step 0 and the gates get complete fixes, because they run next. Steps 1-3 get fixes for real defects only. Their remaining detail goes into a list the design must settle after Step 0 reports, because it depends on those results. That list is itself the proposed fix for those findings: **the plan stays below the Zero-Decision bar for Steps 1-3 until then, and those steps must not be built before it's cleared.**

## Decisions built into the fixes

"Auto accept" adopts these. All numbers are proposed.

| # | Decision | Built-in choice | Cost | Alternative |
|---|---|---|---|---|
| D9 | **What "later" does at review (A1).** Without generated triggers, a lesson nobody reviewed has no route to an agent | "Later" keeps a lesson `proposed`, and it's shown again next run. Lessons go live only by keep, edit or `muninn add`. `autoLiveOwnWords` is removed for the first version | **Reverses your decision at L215 and the rejection at L442.** Every lesson needs a decision, and review can become a chore nobody does, which is what L440 warned about | "Later" makes a lesson live and always-on. Nothing goes undelivered, but situational text such as "don't push yet" reaches every session in the repo, unreviewed |
| D10 | **Token gates are judgement calls (A7)** | Fixed conditions, a no-line control and an ordered list of actions. A one-run difference is treated as no difference. The doc says these aren't statistical tests | 5 runs still can't separate similar rates, and you decide close cases | More runs. Stopping each script once it starts keeps runs short, but a token that lasts 8 hours limits how fast you can repeat them if you require an expired one |
| D11 | **Trial adds a control arm and clears auto memory between arms (A7)** | 5 runs per client with no line, then 5 with the line. The author removes token text from auto memory before each arm | 10 more runs per gate cycle in Step 0, and you edit your own auto memory | Leave memory on and record it. Cheaper, but carry-over can inflate later results |
| D12 | **Hook speed gate tightened to p95 under 400 ms (B12)** | Changes a number you accepted at 500 ms, because at 500 ms up to 1 run in 20 would lose delivery | A stricter gate | Keep 500 ms |

## Prioritized Findings & AI Suggestions

"Fix" names a part of Appendix A. "List" means the Settle After Step 0 list in Appendix A.

### [Issue 1] A1 [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Blocker
*   **Affected Scope:** [Lines 653, 695, 735, 758, 863](../designs/muninn.md#L695)
*   **Discrepancy Description:** Auto-live lessons have no route to the agent, and "shown" is undefined.
*   **Rationale:** Auto-live never leads to delivery, and Ctrl-C could put lessons live.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Confirmed: this is my error, and it follows from cutting generated triggers. See D9.
*   ***Proposed Edit:***
    *   Location: items 11, 13, 20, 23, L94-96, L215, L319-320, L433-442
    *   Change: A-6, A-7, A-9

### [Issue 2] A2 [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** [Lines 594, 775, 790, 800, 805](../designs/muninn.md#L775)
*   **Discrepancy Description:** "Not built or promised" has no mechanism.
*   **Rationale:** A hook can't tell which Codex build called it.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. A support table, plus a rule that builds sharing one config get what works on all of them. Details depend on item 7, and the matrix adds the current npm release.
*   ***Proposed Edit:***
    *   Location: Step 0 item 7, Step 2 opening
    *   Change: A-1, A-5

### [Issue 3] A3 [`egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** [Lines 710, 848, 858](../designs/muninn.md#L710)
*   **Discrepancy Description:** The command index has no data source.
*   **Rationale:** Readers return only typed text.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Confirmed: my error. Readers also return tool commands, and item 9 checks whether logs record exit status.
*   ***Proposed Edit:***
    *   Location: items 15, 34
    *   Change: A-1 (item 9), A-6

### [Issue 4] A4 [`egm-codebase-details`, `egm-implementation-readiness`] - Severity: Blocker
*   **Affected Scope:** [Lines 725, 754](../designs/muninn.md#L725)
*   **Discrepancy Description:** The filter can discard the main lessons, and the stop-list does nothing.
*   **Rationale:** "Refresh the token" has 3 words, and the gate stops if the token lesson isn't found.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Confirmed: my error. The floor drops to 2 words, the stop-list gets real entries, and item 9 replays the filters on saved logs.
*   ***Proposed Edit:***
    *   Location: items 18, 23, 9
    *   Change: A-1, A-6

### [Issue 5] A5 [`egm-codebase-details`, `egm-implementation-readiness`, `egm-style`] - Severity: Blocker
*   **Affected Scope:** [Lines 762-771](../designs/muninn.md#L762-L771)
*   **Discrepancy Description:** The held-out repo protects little, and the store isn't reset.
*   **Rationale:** 6/10, 6/10 and 3/10 passes.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Confirmed. The fix uses a fresh store per run, gives the held-out repo its own bar and defines the terms. The precision limit stays, and the gate says so.
*   ***Proposed Edit:***
    *   Location: Gate to Stage 2
    *   Change: A-2

### [Issue 6] A6 [`egm-codebase-details`, `egm-implementation-readiness`, `egm-style`] - Severity: Blocker
*   **Affected Scope:** [Lines 637, 646, 766-769, 829-831](../designs/muninn.md#L829-L831)
*   **Discrepancy Description:** Gate rows overlap or leave gaps.
*   **Rationale:** The same result matches two actions.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Every gate becomes an ordered list where the first match applies.
*   ***Proposed Edit:***
    *   Location: all gates
    *   Change: A-1, A-2, A-3

### [Issue 7] A7 [`egm-codebase-details`, `egm-implementation-readiness`, `egm-style`] - Severity: Blocker
*   **Affected Scope:** [Lines 589, 637, 825-831](../designs/muninn.md#L825-L831)
*   **Discrepancy Description:** The token gates can't show what they claim.
*   **Rationale:** Nearly identical mechanism, 5 runs, and uncontrolled conditions.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Conditions can be fixed, but precision can't, and a tie stays a real possibility given cutting generated triggers. See D10 and D11. I reject stating this as a measurement.
*   ***Proposed Edit:***
    *   Location: item 6, Step 0 gate, delivery gate
    *   Change: A-1, A-3

### [Issue 8] A8 [`egm-codebase-details`, `egm-style`, `egm-implementation-readiness`] - Severity: Blocker
*   **Affected Scope:** [Line 574](../designs/muninn.md#L574)
*   **Discrepancy Description:** Item 3's reason is false.
*   **Rationale:** The design changed, and both files are committed.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Confirmed: my text went stale.
*   ***Proposed Edit:***
    *   Location: item 3
    *   Change: A-1

### [Issue 9] B6 [all three] - Severity: Major
*   **Affected Scope:** [Lines 600, 710, 745](../designs/muninn.md#L600)
*   **Discrepancy Description:** M3 fails when there's nothing to exclude.
*   **Rationale:** Docs say no visible transcript entry.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. M3 becomes a recording, and either result is usable.
*   ***Proposed Edit:***
    *   Location: item 7, item 22
    *   Change: A-1, A-6

### [Issue 10] B7 [`egm-implementation-readiness`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 601, 775, 853-858](../designs/muninn.md#L601)
*   **Discrepancy Description:** M4 mixes two needs and doesn't reach Step 3.
*   **Rationale:** A write failure could lose a read-only `ask`.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Split into M4a and M4b, and the provisional rule now covers Step 3.
*   ***Proposed Edit:***
    *   Location: item 7, Steps 2-3 opening
    *   Change: A-1, A-5

### [Issue 11] B8 [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 594-611](../designs/muninn.md#L594-L611)
*   **Discrepancy Description:** The matrix omits behaviours later items need, and its columns and test meanings are off.
*   **Rationale:** Five rows have no pass condition, and tests changed meaning.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Pass-or-fail checks and recordings split into two tables, trust goes first, each check runs twice, and narrowed tests get their own labels.
*   ***Proposed Edit:***
    *   Location: item 7
    *   Change: A-1

### [Issue 12] B11 [`egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 605, 609](../designs/muninn.md#L609)
*   **Discrepancy Description:** The test dismissals overclaim.
*   **Rationale:** The engineer's headless runs can fire hooks.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Test 12 and part of test 13 return, narrowed to the engineer's own runs.
*   ***Proposed Edit:***
    *   Location: item 7
    *   Change: A-1

### [Issue 13] B12 [`egm-codebase-details`, `egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** [Lines 605, 616, 640](../designs/muninn.md#L640)
*   **Discrepancy Description:** The latency gate allows routine misses.
*   **Rationale:** p95 at the give-up limit.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. See D12. Test 17 gets a numeric method, and Step 2 re-measures on the built CLI.
*   ***Proposed Edit:***
    *   Location: items 7, 8, Step 0 gate
    *   Change: A-1, List

### [Issue 14] B13 [`egm-codebase-details`, `egm-implementation-readiness`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 621-644](../designs/muninn.md#L621-L644)
*   **Discrepancy Description:** Other Step 0 gates are undefined or tuned on their own test data.
*   **Rationale:** Two engineers could score them differently.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The fix gives a file schema, a 10-item tuning set, a scoring rule, a fixed model configuration and a measured size. Vector search is required to win on repeats, because the learner depends on that.
*   ***Proposed Edit:***
    *   Location: item 9, Step 0 gate
    *   Change: A-1

### [Issue 15] B14 [`egm-codebase-details`, `egm-implementation-readiness`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 584, 735, 766, 810](../designs/muninn.md#L584)
*   **Discrepancy Description:** Two baselines exist, and one can include the trial.
*   **Rationale:** Only one repo's logs are saved.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Save logs for all 3 repos, define the folder layout, run gate `learn`s on those copies, and report "no baseline" for `add` lessons.
*   ***Proposed Edit:***
    *   Location: items 5, 15, 30
    *   Change: A-1, A-2, A-6, List

### [Issue 16] B16 [`egm-codebase-details`] - Severity: Major
*   **Affected Scope:** [Lines 579, 745](../designs/muninn.md#L579)
*   **Discrepancy Description:** Package configuration gaps.
*   **Rationale:** Reviewer general knowledge, not run.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Cheap and harmless if the reviewer is wrong. The install check in item 8 confirms it.
*   ***Proposed Edit:***
    *   Location: item 4
    *   Change: A-1

### [Issues 17-30] B1, B2, B3, B4, B5, B9, B10, B15, B17, B18, B19, B20, B21, B22 [see round 2 report] - Severity: Major
*   **Affected Scope:** Steps 1-3 (lines 650-875); per-finding scope in the round 2 report
*   **Discrepancy Description:** As listed in `implementation_readiness_report_round2.md`.
*   **Rationale:** They fail the Zero-Decision Rule for Steps 1-3, and several depend on Step 0 results.
*   ***AI Suggestion:*** PROPOSE FIX (each)
*   ***Justification:*** Valid, but specifying them now would be partly rewritten after Step 0. Each becomes a named line in the list, with what it needs and what result it waits for. B18's gate count is also corrected in the devlog, and B1's negation and rejected-lesson conflict gets a direct fix because it needs no Step 0 result.
*   ***Proposed Edit:***
    *   Location: new list before Step 1
    *   Change: A-4, A-5, A-6

### [Issues 31-34] N1, N2, N3, N4 - Severity: Nit
*   **Affected Scope:** Lines 559, 564, 569, 584
*   **Discrepancy Description:** Duplicate devlog entry, ordering, stale reference, leftover raw logs.
*   **Rationale:** See round 2 report.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Each is one line inside the Step 0 rewrite. Raw logs get an explicit delete step.
*   ***Proposed Edit:***
    *   Location: Step 0
    *   Change: A-1

### [Issues 35-38] N5, N6, N8, N9 - Severity: Nit
*   **Affected Scope:** Lines 653, 658, 720, 725, 730, 790, 795, 800, 805
*   **Discrepancy Description:** Negation words, model configuration, `MUNINN_HOME` paths, unlabelled thresholds.
*   **Rationale:** See round 2 report.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** N6's model configuration goes in item 9, N5 and N9 in A-6, and N8 in the list.
*   ***Proposed Edit:***
    *   Location: items 9, 18, list
    *   Change: A-1, A-4, A-6

### [Issues 39-40] N7, N10 - Severity: Nit
*   **Affected Scope:** Lines 750-760, 816-823; loose wording
*   **Discrepancy Description:** Test bullets not mapped to files; overloaded words.
*   **Rationale:** See round 2 report.
*   ***AI Suggestion:*** DECLINE
*   ***Justification:*** Steps 1-3 get rewritten after Step 0, so an editing pass now would be wasted.
*   ***Proposed Edit:***
    *   Location: none
    *   Change: none

---

# Appendix A: Proposed edits

## A-1. Replace everything from `### Step 0` up to `### Step 1`

````markdown
### Step 0: Clean up, baseline and spike

Do this first, before anything below: the author sets `cleanupPeriodDays` to 365 in Claude Code and leaves it there until the delivery gate has run, so evidence does not expire. Afterwards the author decides whether to restore it.

Spike scripts are throwaway, and they run with `tsx`. Real-log inputs and copies stay in `~/.muninn-spike/`, outside the repo. That folder holds raw logs, so the author deletes it after the delivery gate.

Gates in this plan are ordered: the first row that matches applies. With this few runs, they support judgement. They are not statistical tests.

#### 1. `agents.md` (Move to `docs/archive/original-build-spec.md`)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Move the file and add a note at the end, so its line numbers stay the same, saying this design replaces it. On a macOS disk that ignores case, Codex may read `agents.md` as its instructions file, and Claude Code reads `AGENTS.md` when no `CLAUDE.md` exists. Either could follow an outdated build spec with the name `amem`. Whether that happens has not been tested. Update this design's own references to the file. Dated records (`concepts_brief.md`, `docs/checks/`, existing devlog entries) keep theirs.

#### 2. `docs/implementation-plan.md` and `docs/devlog.md` (Modify)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: In the tracker, replace the phases, Quality bar and dogfood milestone with the steps here, and remove its references to `agents.md`. In the devlog, change the header at lines 4-7 so it no longer promises migration through `remember` at the end of Phase 1. Log every gate result in the devlog from this step on.

#### 3. `design_draft.md` (Delete)

*   **Type / Scope**: Working file.
*   **Proposed Changes**: Delete it. It is an earlier version of this design, and it stays available in git history at commit `a7912f5`.

#### 4. `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `scripts/copy-assets.mjs` (Create)

*   **Type / Scope**: Build configuration.
*   **Proposed Changes**: Package with the working name `muninn-preview`, which is not published. A `muninn` command at `dist/cli.js`, Node 22 or later, and `files` listing `dist`. Dependencies: `@libsql/client`, `@huggingface/transformers` and `zod`. Dev dependencies: `typescript`, `@types/node`, `vitest` and `tsx`. Scripts: `build` (`tsc`, then `copy-assets.mjs`, which copies `src/store/migrations/*.sql` and `src/ui/public/*` into `dist/` when they exist), `test` (`vitest run --passWithNoTests`) and `typecheck` (`tsc --noEmit`). `tsconfig.json` uses `rootDir: src` and includes only `src`. Ignore build output and any real logs. Adding another dependency needs a line in the devlog.

#### 5. `scripts/spike/save-logs.ts` (Create)

*   **Type / Scope**: Throwaway script.
*   **Proposed Changes**: Copies the logs for the token repo and 2 other author repos to `~/.muninn-spike/logs/claude/projects/` and `~/.muninn-spike/logs/codex/sessions/`, matching each client's own folders. Run this before the trial. `MUNINN_LOG_ROOT` uses the same layout, so gate runs of `learn` read these copies, and their baselines exclude the trial. Record the date and the number of sessions per repo and tool in `docs/spike.md`.

#### 6. Token-run trial (result recorded in `docs/spike.md`)

*   **Type / Scope**: Manual check.
*   **Proposed Changes**: The author writes one fixed prompt for starting the token script, which mentions neither the token nor `caffeinate`, and uses it for every run here and at the delivery gate. A run passes if the agent refreshes the token, or checks it and finds it valid, before starting the script. Record `caffeinate` the same way. It is reported but decides nothing. Stop the script once it has started, so runs stay short.
    *   **Control arm:** 5 runs in each of Claude Code and Codex, with no added line.
    *   **Line arm:** add token and `caffeinate` lines to `AGENTS.md`, and to `CLAUDE.md` if the repo has one, then do 5 runs in each client. Remove the lines afterwards.
    *   **Before each arm, here and at the delivery gate:** the author removes any token or `caffeinate` text from auto memory, and records that it did.

#### 7. `scripts/spike/client-hook.mjs`, `docs/checks/client-live-tests.md`, `test/fixtures/hooks/` (Create)

*   **Type / Scope**: Throwaway script, documentation and test data.
*   **Proposed Changes**: Check IDs M1-M5 are new here. Numbered tests refer to `docs/checks/client-capabilities.md`, and a letter after a number means this plan narrows that test. Use a throwaway project, a hook that returns a unique made-up fact, and hooks set at user level, as `install` will. Clients: Claude Code 2.1.317, Codex CLI 0.133.0, the desktop app's 0.155 build, the current npm release of Codex, run without replacing the installed CLI, and Cursor 3.25.9 for test 16a only. Run test 15 first, because an untrusted Codex hook would look like a failed delivery. Each pass-or-fail check runs in 2 fresh sessions, and both must pass.

| Pass-or-fail check | Passes if | If it fails |
|---|---|---|
| M1: `SessionStart` at session start | The model repeats the fact on the first turn | No session-start delivery on that client or build |
| M2: `UserPromptSubmit` | The model repeats the fact in that turn | No keyword delivery on that client or build |
| Test 6: `SessionStart` with `compact` | The model repeats the fact after forced compaction. Record which turn | Restore is not promised there, and the README says so |
| M4a: agent runs a read-only local command from the project directory | The agent gets its output. An approval prompt is allowed, and recorded | `muninn ask` is for people only on that client. Agent search returns in a design pass with tests 9 and 10 |
| M4b: that command writes under `MUNINN_HOME` | The file is written | `ask` still answers, and skips `search_log` when a write fails |
| M5: bad hook behaviour (empty output, invalid JSON, non-zero exit, killed by the client's timeout) | The session continues normally in all four cases | Bring this to the author: the hook's failure design changes for that client |

| Recording | What to record | What it decides |
|---|---|---|
| Test 15: Codex trust | What the user sees when a hook is added and changed, and whether an untrusted hook is silent | What `install` and `status` say |
| M3: where hook text appears | The record type holding the fact in each transcript, or that it appears nowhere | Which records readers exclude. If it appears nowhere, nothing needs excluding |
| Hook config | The config file each client reads, including whether the app and CLI share one, the entry format, and timeout units and minimum | The entries `install` writes |
| Test 16a: Cursor import | Whether a hook in `~/.claude/settings.json` runs in Cursor, whether it also runs twice with one in `~/.cursor/hooks.json`, whether its output reaches the model, and which input fields it gets | How Cursor is detected. If no signal exists, the README says hooks installed for Claude Code also deliver in Cursor |
| Test 17a: hook delay | With a hook on `UserPromptSubmit` sleeping 100, 200 and 500 ms, the longest delay the author does not notice | Sets `hookLimitMs`, up to 500 ms. If it is below the latency result in item 8, bring this to the author |
| Test 3a: pre-tool timing, two clients | The timing, and whether deny-with-reason stops a call | No code follows. Any refusal path needs its own design pass |
| Test 5: subagents | Whether text reaches subagents, and whether their tool calls fire hooks | Recorded as a limitation |
| Test 12a, part of test 13: the engineer's own `claude -p` and `codex exec` runs | Whether hooks fire, and how the transcripts are marked | Whether hooks and readers need to skip non-interactive runs |

Tests 1, 2, 7, 8, 11 and 19 wait for any decision on Cursor. Test 4 does not apply at a 300-token limit. Tests 9 and 10 wait for MCP. Test 14 and the rest of test 13 do not apply, because muninn starts no client. Test 18 waits for a release, and unknown-structure counts report format changes in the meantime.

Save observed hook input and accepted output for each client, event and source seen as files in `test/fixtures/hooks/`, including `compact` and any Cursor input. Expected input fields, to be confirmed here: `session_id`, `cwd`, `hook_event_name`, `transcript_path`, plus `prompt` on `UserPromptSubmit` and `source` on `SessionStart`. Expected output: `{"hookSpecificOutput":{"hookEventName":"<event>","additionalContext":"<text>"}}`.

#### 8. `scripts/spike/libsql-check.ts`, `scripts/spike/hook-latency.ts` (Create)

*   **Type / Scope**: Throwaway scripts.
*   **Proposed Changes**: `libsql-check` tests vector columns, a top-5 vector query filtered to `live` lessons, FTS5, and 4 processes writing at once. It also tests clean installs of `@libsql/client` and `@huggingface/transformers`, and `npm pack` holding `dist/`, on macOS and Linux. Separately, it tests the fallback: `node:sqlite` with vectors stored as blobs and a full scan, and FTS5, recording the minimum Node version and any warning. The storage choice depends on these results, and none is verified yet. `hook-latency` measures a full hook run from process start (Node start-up, opening the store, repo identity, matching 500 triggers, writing a log row), 100 times, while another process writes as `learn` would, against a store holding 500 lessons.

#### 9. `scripts/spike/embed-check.ts`, `scripts/spike/match-check.ts` (Create)

*   **Type / Scope**: Throwaway scripts.
*   **Proposed Changes**: The model configuration is fixed for all of Step 0: `Xenova/bge-small-en-v1.5`, `dtype: 'q8'`, mean pooling and normalised vectors, with no query prefix. `embed-check` measures the `npm pack` tarball size with the model included, load time, time per embedding and time to embed one saved repo's logs.

    The author writes `~/.muninn-spike/instructions.jsonl` before any results exist. It holds 30 pairs of real, differently worded instructions as `{"kind":"repeat","a":"...","b":"..."}`, 20 as `{"kind":"question","q":"...","answer":"<instruction text>"}`, and for each instruction a judgement of `always_on` or `specific_moment`. `match-check` reports:
    *   the similarity cutoff that works best on 10 of the pairs, chosen only from those 10
    *   on the other 20 pairs, how many each method finds: embeddings when the pair is at or above the cutoff, and keyword search when FTS5 finds `b` from the words of `a`, with the other instructions and the saved logs' typed sentences as the corpus
    *   on the questions, how many have their answer in each method's top 5
    *   a replay of hand-picked literal triggers against other real transcripts, counting correct, missed and wrong firings against the instructions marked `specific_moment`
    *   how many of the instructions the author judges to make sense on their own, as lesson text
    *   whether the token and `caffeinate` wordings survive item 18's filters on the saved logs, and which common sentences get through
    *   whether Claude Code and Codex logs mark pasted text or non-interactive sessions, and whether they record a tool call's exit status

#### 10. `docs/spike.md` (Create), `scripts/spike/` (Delete)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Results of items 5-9, the decisions below, and the Settle After Step 0 list resolved. Then delete the spike scripts.

**Gate (proposed), first match applies:**

| Result | Action |
|---|---|
| The control arm gets 4 or 5 of 5 in every client | Stop and bring this to the author: agents may already do this without help |
| The line arm gets 4 or 5 of 5 in every client | Stop and bring this to the author: muninn must then justify itself on learning and sharing, not delivery |
| The line arm gets 4 or 5 of 5 in only one client | Bring this to the author: same question, for that client |
| A `@huggingface/transformers` install or embedding run fails | Stop and bring this to the author |
| M1 or M2 fails on every build of both Claude Code and Codex | Stop and bring this to the author |
| M1 and M2 fail on every build of Codex only | The Stage 2 goal narrows to Claude Code, and the author is told. The same applies the other way around |
| FTS5, concurrent writes or the libSQL install fail | Use the fallback if it passes, and tell the author. If it also fails, stop |
| Vector columns or the filtered query fail, and the rest pass | Store vectors as blobs with a full scan in libSQL |
| Full hook run p95 is 400 ms or more | Stop and bring this to the author: hook delivery cannot reliably meet its limit |
| Embeddings find fewer than 3 more of the 20 pairs than keyword search | Bring this to the author before continuing. The question result is reported alongside |
| Fewer than 15 of 20 instructions make sense on their own | Bring this to the author: lesson text needs another approach |

Decisions that follow, in any case:
*   **Model delivery:** ship it if the tarball is under 50 MB, by adding it to `copy-assets.mjs` and loading it from `dist`. Otherwise download once with consent.
*   **First run:** if it takes over 5 minutes on a real repo, cache embeddings by sentence hash in a file under `MUNINN_HOME`, and tell the author, because this stores hashes of unused sentences.
*   **Richer triggers:** if 5 or more instructions are marked `specific_moment` and the replay misses over half of them, note it for a later design pass. It does not block Stage 1.
*   **Wrong firings:** if the replay's wrong firings outnumber its correct ones, tell the author before keyword delivery is built.
````

## A-2. Replace `**Gate to Stage 2 (proposed):**` through the end of that section

````markdown
**Gate to Stage 2 (proposed):** before any tuning, set aside one of the author's 3 repos as held out. Tune only on the other two. Each judged run starts with a fresh `MUNINN_HOME`, reads the logs saved in item 5, and shows 10 lessons per repo. An edit counts as kept. "Later" counts as shown and not kept. A kept lesson that an instruction file already states is left out of both counts. "Finds" means the lesson is among the 10 shown on its repo.

First match applies:

| Result | Action |
|---|---|
| Token lesson not found | One tuning round, then a new judged run. If still not found, stop and rethink before building Stage 2 |
| Fewer than 20 lessons shown in total | Inconclusive: the author decides whether to widen with `--all-repos` or add a deferred signal, and logs why |
| At least half kept in total, and at least 3 of 10 kept on the held-out repo | Continue |
| Anything else, on the first judged run | One tuning round, then a new judged run |
| Fewer than 1 in 4 kept in total, on the second judged run | Stop and rethink before building Stage 2 |
| Anything else, on the second judged run | The author decides and logs why |

The second judged run has already seen the held-out repo, so it is weaker evidence. With about 30 lessons, these rates are rough signals, not measurements. A few other engineers run the tarball on their own repo and report what they kept and whether they would run it again. Their feedback goes in the devlog and does not decide the gate.
````

## A-3. Replace `**Gate after delivery (proposed):**` through the end of its table

````markdown
**Gate after delivery (proposed):** give the token lesson as always-on, so the result does not depend on a keyword. Remove token and `caffeinate` text from auto memory, then do 5 runs in each supported client with item 6's prompt and pass rule.

A difference of one run from item 6 counts as no difference. First match applies:

| Result | Action |
|---|---|
| 2 or more runs below item 6's line arm in a client | Stop and bring this to the author |
| Fewer than 4 of 5 in a client, on the first try | One round of delivery fixes, then repeat |
| Fewer than 4 of 5 in a client, after that | The author decides whether to narrow to the working client or stop, and logs why |
| Within one run of item 6's line arm in any client | Delivery works, but has not beaten an instruction line there. Record it. The author confirms continuing, with muninn's case resting on learning, sharing and the delivery log |
| Anything else (4 or 5 of 5, and 2 or more runs above the line arm, in every supported client) | Continue to Step 3 |
````

## A-4. Add directly before `### Step 1`

````markdown
### Settle After Step 0

Steps 1-3 below are provisional. They do not meet the Zero-Decision bar yet, and they are not built until this list is cleared in this document, using the results in `docs/spike.md` and `docs/checks/client-live-tests.md`, and reviewed again.

| Area | To settle | Waits for |
|---|---|---|
| Support table | How `install`, `hook` and `status` use results per client and build | Item 7 |
| Hook contract | Exact input, output, sources including `fork`, and unknown-source behaviour | Item 7 |
| Compaction | How "once per session" is computed from the append-only log, and what a late Codex hook does | Test 6 |
| Token budget | Whether compaction resets the session budget, and what happens to lessons over 300 tokens or over 3 always-on lessons | Test 6 |
| Send and log | Order on a locked store, the real time ceiling, and whether the hook can claim to exit 0 | M5, item 8 |
| Cursor | Detection order, logged tool, fixture | Test 16a |
| Installer | Exact entries, identifying muninn's entries, repeat installs, absent or malformed files, a command path that survives version managers | Hook config, test 15 |
| Non-interactive runs | Whether hooks and readers skip them | Test 12a |
| Readers | Finding a repo's Codex logs, typed-text rules per client, multi-repo scope, sessions with deleted folders | Item 9 |
| Re-reading logs | Dedupe keys for evidence and commands, a lasting session count, which lessons take top-10 slots | First-run time |
| Lesson states | The full table, including edit, retire and restore, and whether scans can change lesson text | Author review |
| Schema | Rowids for FTS, FTS and `repos` and `scan_counts` owners, ID generation, version record, index filtering, what `lesson_versions` holds | Item 8 |
| Storage interface | One interface across libSQL and any fallback | Item 8 |
| Commands and settings | Arguments, output and exit codes per command, `purge` confirmation, the agent search setting, how `ask` knows its caller, `--all-repos` | M4a |
| Report | Shared repeat-counting, delivery start date, `add` lessons showing "no baseline" | Item 9 |
| UI | Search routes, request and response bodies, shutdown | None |
| Tests | Embedding stub, config path override, fixture tree with 3 or more sessions and a real repo, DOM for escape tests | Item 7 |
| Ordering | Step 3 gate, whether item 33's 2 weeks hold items 34-37, Create and Modify per step | None |
| Memryzed reuse | The read has source locations, not line formats, and Memryzed has no Codex parser. Put redaction patterns and the fusion constant in this plan, and set the outcome if the licence check fails | None |
| Paths and naming | `MUNINN_HOME` in every path and in hook runs, one word for triggers, and labels for remaining thresholds | None |
````

## A-5. Replace the opening sentence of `### Step 2`, and add one under `### Step 3`

````markdown
Items here depend on `docs/checks/client-live-tests.md`. A client, build or moment that failed its check is not installed or promised. Builds that read the same config file get only what works on all of them.
````

Under Step 3:

````markdown
Agent use of `muninn ask` depends on M4a and M4b. Where M4a failed, `ask` is for people only.
````

## A-6. Point fixes inside Steps 1-3

| Item | Change |
|---|---|
| 11 | Remove `autoLiveOwnWords` from the defaults |
| 13 | Replace the table's first three rows with: `proposed`, shown and kept or edited → `live`, reviewed; `proposed`, "later" or never shown → `proposed`; `proposed`, rejected → `rejected`, reviewed. Add: "Nothing goes live without a decision" |
| 15 | "A reader returns text the engineer typed, and separately, tool commands with their exit status where item 9 found it recorded. It excludes tool output, agent text and any hook record type found by M3" |
| 18 | Replace the filter sentence with: "Excludes fenced code, quoted lines, messages over 2,000 characters or 20 lines, sentences under 2 words, and exact matches in a stop-list (`run the tests`, `commit this`, `continue`, `go ahead`, `looks good`, `fix it`, `push it`)". Add "Sessions are processed in date order". Add `cannot`, `won't`, `shouldn't` and `without` to the negation words |
| 19 | Replace the rejected-lesson sentence with this order, first match wins: "a candidate at 0.98 or above to a rejected or retired lesson is dropped; a candidate at or above the cutoff to a `proposed` or `live` lesson, with the same negation, adds evidence; anything else is a new candidate, even if similar to a rejected lesson." 0.98 is proposed |
| 20 | Replace the route sentences with: "It shows the top `shownPerRun` candidates and asks keep, edit, reject or later, and a kept or edited lesson also asks always-on, an optional literal trigger, or neither. If neither, it warns that the lesson is searchable but never delivered automatically. Decisions are saved as they are made, so stopping partway changes nothing else. In a non-interactive run, it prints candidates and changes nothing" |
| 22 | Fixtures include a hook-injected record only if M3 found one |
| 23 | Replace the stop-list and transition bullets to match items 13 and 18. Add "`refresh the token` and `use caffeinate` form candidates when repeated", "'never use X' does not add evidence to 'use X'", and "a rejected lesson's wording does not return as a candidate" |
| 34 | Use "commands that exited 0" only if item 9 found exit status recorded. Otherwise `package.json` scripts and Makefile targets only |

## A-7. Edits outside lines 553-875

| Lines | Change |
|---|---|
| L94-96 (Approval by risk) | "**Approval.** A lesson goes live only when the engineer keeps it, edits it or adds it by hand. Every lesson needs a route: always-on or a keyword." |
| L215 | "Approval \| Lessons go live only by keeping, editing or adding \| Author chose risk-based approval. Changed in review, because without generated triggers an unreviewed lesson has no route to an agent." |
| L319-320 (Approval) | "**Approval.** A lesson goes live when the engineer keeps it, edits it or adds it with `muninn add`. Lessons left for later stay proposed and are shown again. Lessons edited by a person cannot be overwritten by a later scan." |
| Always approving entry (Alternatives) | Move to "Not chosen, and may be revisited", and add: "**Status**: The author rejected always approving in favour of approving risky lessons only. The first version does approve everything, because of the cut to generated triggers. The cost is that review can become a chore. Revisit with richer triggers." |
| Risk table | "Nothing goes live unseen" becomes "Nothing goes live without a decision". Add a row: "Review becomes a chore, so nothing gets delivered \| `learn` shows 10 lessons at a time. Accepted for the first version" |
| Keep-rate success measure, CUJ 2 | CUJ 2's Given: add "and kept the lesson" |

## A-8. Devlog

Add to the review entry: the approval change (D9), the token gates as judgement calls (D10), and that Steps 1-3 stay provisional until the Settle After Step 0 list clears. Change "Four decision gates" to "Three decision gates, with Step 0's covering both the trial and the stack".
