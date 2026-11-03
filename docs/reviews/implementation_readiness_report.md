# Stage 9 Implementation Readiness Report: `docs/designs/muninn.md`, lines 534-782

**Round 1 result: not ready.** There are 7 Blockers, 28 Majors and 9 Nits after merging duplicates. The reviewers raised 84 findings in total. This round is not clean.

| Reviewer | Standard | Status | Blocker | Major | Nit |
|---|---|---|---|---|---|
| `egm-implementation-readiness` | implementation-readiness-standard | completed | 7 | 12 | 3 |
| `egm-codebase-details` | implementation-readiness-standard | completed | 4 | 29 | 5 |
| `egm-style` | none | completed | 0 | 21 | 3 |

**Count corrections:** these counts come from the severity labels on each finding. The summary lines of two reviewers differ: codebase details says 25 Majors, and style says 16 Majors and 8 Nits.

**Scope limits**
- Client and Memryzed behaviour rests only on `docs/checks/`. `client-capabilities.md` says nothing in it was tested live, and `memryzed-read.md` says it comes from a static read.
- Reviewers also read in-repo planning files, including `concepts_brief.md`, `agents.md`, `docs/devlog.md` and `docs/implementation-plan.md`. Each reports that it stayed inside your file limits and opened no `_report.md` file.
- The statistical figures are reviewer estimates, and their sample sizes are assumptions.
- The Elephant has not yet evaluated these findings. Spot checks are listed at the end.

**Tension with Stage 8:** Stage 9 asks for more specification, such as a trigger grammar, more outside engineers and sample protocols. Stage 8 argues for cutting those parts. Findings that Stage 8's proposals would remove are marked **[Z1]**, **[Z3]**, **[Z5]**, **[Z6]**, **[Z7]** or **[Z8]**. Decide those proposals before resolving the marked findings, or the plan may gain detail for parts you then remove.

**Finding ids** use `<reviewer>-<round>-<n>`, with `impl`, `code` and `style` as reviewer names.

## Blockers

### R1. Trigger generation has no algorithm [Z1]
- **Scope:** lines 649-653 (item 18)
- **Sources:** `impl-1-1`, `code-1-1`
- **Finding:**
  - "Suggests triggers from the commands, files and words around the evidence" is the whole specification.
  - Undefined: the evidence window, which sources count (agent commands, tool output, engineer text), normalisation of arguments, paths and environment prefixes, pattern syntax, keyword selection and stop words, scoring, the number of triggers per lesson, and a stop-list for commands such as `git status` or `pnpm test`.
  - **Wrong command:** after "refresh the token first", the next command is probably the refresh, not the long script.
  - **Self-defeating keywords:** words from the instruction, such as "token" and "refresh", match only when the engineer repeats the reminder, which is the behaviour the lesson should remove.
  - No item writes the `triggers` table. Item 11 covers lessons only.
  - Item 15's high-entropy redaction could store a command containing a token or hash as a pattern that never matches.
- **Suggested:** specify the extraction rule, normal form, grammar, exclusions and per-lesson cap, with a worked token example. Report lessons with too-broad or no triggers.

### R2. Nothing built delivers the token lesson before the run in the common case
- **Scope:** lines 653, 681, 686-701 (items 23-25)
- **Sources:** `impl-1-2`, `code-1-2`
- **Finding:**
  - `UserPromptSubmit` needs the prompt to contain the trigger, and CUJ 2's engineer "asks for the script run", which need not include the command text.
  - `PostToolUse` fires after the call, which in the author's case comes after up to 4 hours of failed runs (line 37).
  - The `PreToolUse` path is deferred, but no item builds it if the test passes: no handler, client output format, way to set `blocking`, or test.
  - Client-capabilities row 2a says Claude Code's `PreToolUse` text arrives with the tool result, and test 3 leaves Codex unclear. No branch handles Codex.
  - The gate at line 681 only requires finding the lesson, so this failure passes Stage 1.
- **Suggested:** add a conditional item with exact files and behaviour for each result of test 3. State what happens to CUJ 2 if neither client can intervene.

### R3. Item 23 doesn't say which tests apply, what passes, or what changes [Z5]
- **Scope:** lines 686-701 (item 23)
- **Sources:** `impl-1-3`, `code-1-15`, `code-1-16`, `style-1-14`
- **Finding:**
  - **Scope:** the named groups cover tests 1-11 and 15-17. Tests 12-14 and 18-19 are excluded without explanation, though test 18 (transcript stability) matters to both readers. The groups include Cursor-only tests 1, 2, 7, 8 and 11, while line 754 calls Cursor unsupported. Test 11 needs the `agent` CLI, which the checks say is not on the PATH.
  - **Coverage gap:** the list doesn't test the plan's main delivery moments, as the table below shows. Item 23's safeguard wouldn't catch a failure in them.
  - **Failure handling:** "the matching part of this plan changes" names no mapping, pass criterion, owner or fallback, and many tests are open questions rather than pass-or-fail checks.
  - **Fit:** "hooks that return a made-up fact" doesn't fit test 9 (a logging MCP server) or tests 15 and 17. The throwaway hooks and logging server aren't in the file list.
  - **Order:** line 386 places the tests before Stage 2, while item 23 sits inside it.

| Delivery moment | Claude Code | Codex | Live test listed? |
|---|---|---|---|
| Session start | Documented | Documented; third-party report at 0.154 | No |
| `UserPromptSubmit` | Documented | Documented only | No |
| `PostToolUse` | Documented | Documented; field parsing seen in source | No |
| `SessionStart` with `compact` | Documented | Documented; queued in source, "not seen delivering" | Yes, test 6 |

- **Suggested:** replace the sentence with a table of test, client and version, pass criterion, plan item affected and exact change on failure. Mark out-of-scope tests as excluded.

### R4. Hook and install contracts are undefined
- **Scope:** lines 667-671, 692-701, 708-712 (items 21, 24, 25, 27)
- **Sources:** `impl-1-4`, `code-1-21`
- **Finding:**
  - **Input:** no fields per client and event. Codex's tool-call fields are unverified.
  - **Output:** "that tool's format" is undefined. The checks record that Codex's field must sit inside `hookSpecificOutput` and that a wrong shape can produce an unhelpful failure.
  - **Install:** no config paths, formats, scope, event matchers or merge rule. Nothing chooses between Codex `hooks.json` and `config.toml`, or between `claude mcp add` and a direct edit.
  - **Identity:** Codex records trust against the hook's hash, so the plan must fix a stable hook command.
  - **Fixtures:** log samples only, with no hook input or output samples.
  - The Claude Code hooks page and the OpenAI pages were read through a summariser, and the checks warn to confirm their wording.
- **Suggested:** specify a schema per client and event, exact config edits and contract fixtures.

### R5. The first migration can't be written, and needed tables are missing
- **Scope:** lines 602-606, 703-706, 720-724 (items 10, 26, 29)
- **Sources:** `impl-1-5`, `code-1-4`
- **Finding:** Item 10 points to a table of rough contents. Missing: column types, keys, constraints, indexes, FTS5 structure, vector type and dimension, and the lock-wait value. Nothing stores the baseline, cross-repo search logs or repeat occurrences across scans. The only concrete vector type is `F32_BLOB(384)` in `agents.md`, which item 1 archives.
- **Suggested:** include the DDL for `001_initial.sql`, with the plain SQLite variant if the fallback is taken.

### R6. Repeat and correction detection can't be coded or tested
- **Scope:** lines 596-600, 644-653, 676-678 (items 9, 17, 18, 22)
- **Sources:** `impl-1-6`, `code-1-25`
- **Finding:** Only "3 sessions" is numeric. Undefined: similarity cutoff and clustering, the sentence splitter, pasted-block detection, correction phrases and timing window, failure-then-fix and "same command" matching, the ranking formula, and the number shown. Item 22 requires "use X" and "never use X" to stay apart, but no negation rule exists, and close embeddings are the stated reason they can't be merged.
- **Suggested:** give tunable defaults and the method, with the spike producing them.

### R7. The Stage 2 success measure can't be computed
- **Scope:** lines 658-659, 775-777
- **Sources:** `impl-1-7`, `code-1-3`, `style-1-10`
- **Finding:**
  - The baseline has no definition, table, unit or window, and nothing says whether a later `learn` overwrites it.
  - No item counts repeats after delivery or reports the comparison.
  - "Covered" is undefined, and lessons added during the two weeks change the covered set.
  - If raw counts are compared, a shorter window alone could produce much of the drop.
  - Logs expire after 30 days by default, and `concepts_brief.md:69` warns that the pre-launch baseline can't be rebuilt.
- **Suggested:** define repeats per session and per week, per lesson and per tool, with a named command for the calculation. Settle this before Stage 1 records anything.

## Major: generated triggers

### R8. Generated triggers are never evaluated before Stage 2 [Z1]
- **Scope:** lines 575-579, 586-587, 673-682, 744-749, 772
- **Sources:** `impl-1-11`, `code-1-8`, `style-1-2`, `style-1-3`
- **Finding:** Line 579 calls keyword-versus-embedding comparison "the product's main bet", but automatic delivery uses neither. No spike, gate or named test covers generation. `concepts_brief.md:278` proposed a replay counting correct, missed and wrong firings, and the plan neither includes nor rejects it.
- **Suggested:** add that replay to Step 0 or the Stage 1 gate, with thresholds, and reword line 579.

### R9. Trigger matching is unspecified [Z1]
- **Scope:** lines 692-695 (item 24)
- **Sources:** `impl-1-12`, `code-1-5`
- **Finding:** Undefined: literal, word-boundary, prefix, glob or regex matching, case, multi-word keywords, path matching, the hook input field per client, which tool types count, the tie-break when more than 3 lessons match, and how tokens are counted.

### R10. Approval and lesson states don't cover triggers
- **Scope:** lines 611-612, 649-665
- **Sources:** `impl-1-12`, `code-1-6`, `style-1-1`, `style-1-21`
- **Finding:** An `own_words` lesson can go live with triggers inferred from surrounding activity, while lines 94-96 and 504 say anything inferred waits. Items 19 and 20 don't show or edit triggers. A broad keyword such as "run" could fire constantly and use up the limits. "Keep", "approve", "go live" and `live` have no mapping, and nothing says what happens to unshown candidates or Stage 1 candidates when Stage 2 is installed.
- **Suggested:** define the state machine and who approves triggers. Default generated triggers to pending, or state why not.

### R11. Nothing sets always-on, blocking or global
- **Scope:** lines 606, 611, 658-659, 664, 695-701, 741
- **Sources:** `code-1-7`, `style-1-5`, `style-1-19`
- **Finding:** A lesson without a trigger is never delivered automatically unless always-on, so failed generation means silent non-delivery. Migration 001 creates `blocking` before test 3 runs, and no item implements deny-with-reason. `caffeinate` is required by line 92, and `concepts_brief.md:231` notes the default scope can't see it across repos.

## Major: gate numbers

### R12. The Step 0 gate is incomplete and its threshold is weak
- **Scope:** lines 557-567, 572-573, 586-587
- **Sources:** `impl-1-17`, `code-1-9`, `style-1-13`
- **Finding:**
  - The gate lists "installs", but no spike script tests them, although line 378 requires it.
  - It omits vector failure, hook latency, model size, first-run time and shortlist quality. A failed 500 ms check has no action.
  - Plain SQLite has no named driver or vector design, and may not fix a concurrency failure.
  - "No more than keyword search" lets embeddings pass with one extra hit in about 20. No margin, labelling rule or shortlist size is set.
  - Item 5 omits the log write and measures only muninn's own process. Client-perceived latency is untested (test 17).
- **Suggested:** give each spike result a number and an action. Require a margin, with labels set before the run.

### R13. The keep-rate gate is gameable and weak
- **Scope:** lines 680-682
- **Sources:** `impl-1-9`, `code-1-10`, `style-1-7`, `style-1-8`
- **Finding:**
  - **Denominator:** "strongest few" has no number, so showing 2 and keeping 1 passes. Line 110 measures *proposed* lessons, and the gate measures *shown* ones. Pooled or per repo is unstated, and so is whether an edit counts. No table records what was shown.
  - **Outcomes:** 25-50% neither passes nor stops. "After tuning" has no limit or held-out data.
  - **Values:** keeping 3 of 6 has an exact 95% interval of about 12-88%. Keeping costs nothing in Stage 1, since nothing is delivered. A lesson already in `CLAUDE.md` or auto memory still counts as kept, which is the risk at line 63. The 25% stop line is unsupported.
  - **Coverage:** only the token lesson is checked, not `caffeinate`, and the token evidence may have aged out of logs.
- **Suggested:** set a minimum number shown, such as 30 pooled lessons. Count a lesson as kept only if instruction files and auto memory don't already cover it. Give every result an outcome.

### R14. The outside-engineer test is an anecdote and can't run in sequence [Z3]
- **Scope:** lines 550-555, 586-587, 681, 751-755
- **Sources:** `impl-1-9`, `impl-1-18`, `code-1-11`, `style-1-9`
- **Finding:** The bar is 1 of 2 people keeping one lesson and running muninn again at any later time. That is weaker than the brief's "a few" engineers (`concepts_brief.md:235`) and line 116. "Runs it again" has no window or collection method, since nothing leaves the machine. No item publishes or packages muninn, the npm name is open (line 163), and the README arrives at item 34.
- **Suggested:** add a distribution item before the gate, require several engineers and a return window. Stage 8's alternative treats this as qualitative feedback only.

### R15. The 70% target can pass without showing an effect [Z3]
- **Scope:** lines 775-777
- **Sources:** `impl-1-10`, `code-1-12`
- **Finding:**
  - **Small counts:** a lesson at the minimum of 3 repeats in 30 days runs about 1.4 per two weeks, so a 70% drop means zero repeats. With no effect, a Poisson estimate gives zero about 25% of the time. A false pass near 4% needs about 5 covered repeats per two weeks, or 11 in a 30-day baseline.
  - **Bias:** lessons are chosen because they spiked, so regression to the mean favours a pass.
  - **Confounders:** auto memory may absorb the instructions, and the author can simply stop typing reminders.
  - **Aggregation:** the token or `caffeinate` lesson can fail while the total passes, and the measure isn't split by tool.
  - `concepts_brief.md:259` records 70% as a starting point to test, and a miss has no consequence.
- **Suggested:** add a minimum count, a per-lesson rule for the two named lessons, and a check that the agent did the action.

### R16. The 90% check and the instruction-file comparison can't produce a result [Z3]
- **Scope:** lines 775-777
- **Sources:** `impl-1-10`, `code-1-13`, `style-1-11`
- **Finding:** The 90% check has no sample size, method, judge, tool or definition of relevant. A wrong but on-topic lesson counts as relevant, and missed firings can't appear. The comparison has no duration, order, procedure or pass rule, so no result changes any decision, despite line 65.

### R17. Step 2 has no real gate or checkpoint
- **Scope:** lines 148, 536, 586, 680, 684-777
- **Sources:** `code-1-14`, `style-1-12`
- **Finding:** Line 536 says each step ends at a gate, but Step 2's criteria sit under Verification Plan with no pass or stop action. Step 2 bundles delivery, install, search, MCP and UI, with tests near the end, though the standard requires incremental phases. "Gate", "success", "step" and "stage" need one mapping, and Step 0's gate lacks a "(proposed)" label.

## Major: Stage 2 client assumptions

### R18. "Codex" is treated as one target
- **Scope:** lines 697-701, 711-712, 773
- **Sources:** `code-1-17`, `style-1-18`
- **Finding:** The checks record CLI 0.133.0, desktop 0.155.0-alpha.2.6 and 0.163.0 on npm, with 180 of 185 threads matching desktop. `additionalContextLimit` and `PreModelRequest` aren't in 0.133.0, and rollout shapes differ by version. No minimum version or surface is set, and the E2E step doesn't name one or the turn on which to check a compact hook.

### R19. Cursor is called unsupported, but the install can make it run muninn
- **Scope:** lines 158, 708-712, 754
- **Sources:** `impl-1-13`, `code-1-18`, `style-1-18`
- **Finding:** Cursor imports hooks from `~/.claude/settings.json` by default and maps the events muninn uses. `muninn hook` could inject text or log against the wrong tool and limits. No detection or refusal exists, and test 16 leaves output compatibility unknown. Line 754 settles what line 158 still lists as open.
- **Suggested:** specify Cursor detection and whether the hook returns nothing and logs a skip. Add a test.

### R20. Codex trust and "hook health" are thinner than the evidence
- **Scope:** lines 712, 729-730
- **Sources:** `code-1-19`, `style-1-17`
- **Finding:** Trust recurs when a hook's hash changes, so it isn't one step, and the plan has no re-trust flow. Test 15 leaves silent failure open. An untrusted or removed hook may write no record, so it could look the same as no matches. "Hook health" has no definition.

### R21. Compaction rules are unresolved [Z7]
- **Scope:** lines 692-706 (items 24-26)
- **Sources:** `impl-1-14`, `code-1-22`
- **Finding:** A long session can compact twice, and earlier hook text is summarised away. Delivered plus always-on lessons can exceed the limits with no drop order. Reading back by session assumes the ID survives compaction, which is unverified and not asked by test 6. Codex delivery may arrive on a later turn. Subagents and resumed sessions have no rule.

### R22. MCP project detection depends on untested behaviour and has no fallback [Z6]
- **Scope:** lines 732-736 (item 31)
- **Sources:** `impl-1-16`, `code-1-20`
- **Finding:** Codex detection rests on source at one tag with no live server, and `roots` is `None`. The desktop process runs at `/`. Process lifetime is unknown for all clients, including whether the app shares a server across projects. Wrong detection could mislabel results or attach a saved lesson to the wrong repo. Tool schemas aren't defined.
- **Suggested:** define the fallback, such as an explicit `repo` parameter or an error, and zod schemas for all three tools.

### R23. The hook's time limit and failure logging aren't implementable as written
- **Scope:** lines 572-573, 602-606, 697-701, 747
- **Sources:** `impl-1-15`, `code-1-30`, `style-1-16`
- **Finding:**
  - An in-process timer can't stop a hook if a synchronous or native call blocks the event loop.
  - The lock wait has no value and could use the full 500 ms.
  - Timeouts must be logged, but the store may be the locked thing.
  - Nothing says who runs a migration after an upgrade. A hook opening the store first could be killed partway through a backup or migration.
  - Item 5 has no pass value, percentile or store size.
  - "Leave the session unaffected" can't be shown by `test/deliver.test.ts`, and Codex has a recorded case of an unclear failure message.
- **Suggested:** specify the timeout mechanism, a short lock wait, a fallback log and a pass value. Reword the test to "the hook exits 0 within the limit", and move the session claim to live testing.

### R24. Unverified client behaviour is stated as settled [Z5]
- **Scope:** lines 706, 711-712, 735-736
- **Source:** `style-1-15`
- **Finding:** "Re-delivery after compaction", "holds the model after first use", "finds the project as described" and "explains Codex's trust step" all read as settled, though rows 3b, 5a and 5c and test 15 say otherwise. Mark each as conditional, or add one line saying items 24-32 are provisional until item 23 reports.

## Major: other implementation gaps

### R25. Incremental scans lose the repeat signal [Z8]
- **Scope:** lines 614-618, 644-647 (items 12, 17)
- **Source:** `impl-1-8`
- **Finding:** Reruns read only new content, and only lesson evidence is stored. A sentence seen in 2 sessions is forgotten before the third appears, and 30-day log removal makes that permanent. The Memryzed read reaches the same point: learning from repeats needs an occurrence table. Decide what occurrences store, and reconcile that with the privacy promise. Stage 8 independently raised this as Z8.

### R26. Readers may count muninn's own injected text
- **Scope:** lines 624, 676
- **Sources:** `code-1-23`, `impl-1-19`
- **Finding:** Claude Code transcripts hold hook-context attachment records. A rescan could count delivered lessons as evidence or repeats, polluting `own_words` and the repeat measure. Neither the reader spec nor the fixtures address this, and the checks don't settle it for every client. Stage 8 also raised this as Z10.

### R27. The E2E step can't work as written
- **Scope:** lines 773-774
- **Sources:** `impl-1-18`, `code-1-24`, `style-1-4`
- **Finding:** A throwaway repo has no history, so `learn` should report too few sessions, and no seeding step exists. A triggered lesson isn't delivered at session start, and "without mentioning it" may avoid its keyword, so only an always-on lesson clearly passes, and no item sets that flag. The test could fail on a correct build, or pass without testing any trigger or `PostToolUse`. "Lesson's fact" also misdescribes instruction lessons.
- **Suggested:** specify seeded logs, lesson type, delivery moment and client versions.

### R28. Test files and listed tests leave large gaps
- **Scope:** lines 673-678, 744-749, 772
- **Sources:** `impl-1-19`, `code-1-26`
- **Finding:** No listed test covers trigger generation, MCP (including the rule that saves are always `inferred`), the command index, `ask`, `status`, migrations and backup, scan-state resume, `export`, `import`, `purge`, model download, pause, cross-tool lessons, compaction re-delivery or going live automatically. Line 772 requires named tests only for what's listed, so these gaps pass verification.

### R29. Search and `find_command` have no trust boundary
- **Scope:** lines 717, 723
- **Source:** `code-1-27`
- **Finding:** Item 29 doesn't say which statuses are searchable, so `proposed`, `rejected` or `retired` lessons could reach agents, contrary to line 96. `find_command` returns README and log-derived commands with no approval, while line 504 says anything not typed by the engineer waits. State an exception or apply the rule.

### R30. Nothing runs the command index or later scans [Z8]
- **Scope:** lines 717, 729
- **Sources:** `code-1-28`, `impl-1-19`
- **Finding:** No item says what runs the index or when, and line 373 has no `index` command. After Stage 2, only a manual `learn` reads new logs, so "last capture", index freshness and the repeat measure depend on an unstated habit.

### R31. Build and dependencies are underspecified
- **Scope:** lines 550-555, 769-771
- **Sources:** `impl-1-19`, `code-1-29`
- **Finding:** TOML and YAML parsing, token counting, HTTP, prompts and a runner for `scripts/spike/*.ts` have no named package, though the standard requires them up front. `build`, `test`, `typecheck`, `bin` and the package name aren't set. Plain `tsc` wouldn't copy `.sql` or `src/ui/public/` files. Node 22 conflicts with `agents.md:34`, "Node 20+", though line 219 says "From `agents.md`".

### R32. Several items leave design choices to the implementer
- **Scope:** lines 632-642, 714-749
- **Sources:** `impl-1-19`, `style-1-20`
- **Finding:**
  - **Redaction:** no pattern list or entropy threshold. "Removes secrets" and "secrets never reach the store" are absolute, and should be reworded to the patterns and fixtures actually tested.
  - **Model:** "verifies the file" gives no hash source, and the cache must sit under `MUNINN_HOME` or `purge` can't remove it.
  - **Command index:** no CI formats, README extraction rules or caller.
  - **UI:** no routes, port, token passing or edit behaviour.
  - **Commands:** `pause` has no storage location, and `--all-repos` isn't in item 19.

### R33. Tracker and devlog work is in the wrong place
- **Scope:** lines 536, 757-765
- **Sources:** `code-1-31`, `style-1-22`, `impl-1-21` (Nit)
- **Finding:** Item 35 sits at the end of Step 2 but says "log results at each gate", which starts at Step 0. `docs/implementation-plan.md:12` and `:22` say its phases are replaced after review, as pre-build work, so the tracker would keep the old `amem` phases through the build. `docs/devlog.md` has no phases: its stale content is the header at lines 4-7, and `:77` says the first build has no database, while item 10 adds one. The tracker's Quality bar and dogfood milestone (lines 41, 65-69) also come from the old design.

### R34. Moving `agents.md` leaves live references unlisted
- **Scope:** lines 543-548, 760
- **Source:** `code-1-32`
- **Finding:** Unlisted references: `docs/implementation-plan.md:5`, `:12`; `docs/devlog.md:24`, `:28`, `:63`, `:72`; `concepts_brief.md`, including line-number citations; `docs/checks/memryzed-read.md:35`, `:253`, `:255`; `muninn.md:143`, `:219`, `:760`. Item 35 still calls it `agents.md`. The rationale is also incomplete: Claude Code uses `AGENTS.md` when no `CLAUDE.md` exists, and this repo has none, so the risk goes beyond Codex.

### R35. Fixtures would encode guesses about real formats
- **Scope:** lines 667-671 (item 21)
- **Sources:** `code-1-33`, `impl-1-20` (Nit)
- **Finding:** "Hand-written" conflicts with "saved sample logs" (line 250). The check recorded structure only, and key names mainly for Codex. "One per client version seen" has no list, and the check names at least Codex 0.94.0, 0.130.0, 0.133.0 and 0.155, and Claude Code 2.1.309 and 2.1.317. Directory paths aren't allowed for hand-written files under the standard.

## Nits

| Id | Scope | Finding | Sources |
|---|---|---|---|
| N1 | 762-765 | The condition for deleting `design_draft.md` is already met, so it shouldn't sit last. Lines 534-782 match, and Status differs on line 4. Lines 31-533 weren't compared in full. `docs/devlog.md:72` and `concepts_brief.md:32` reference it. The files are untracked with no commits, so the deletion can't be recovered through git. | `code-1-34` |
| N2 | 635, 717-723 | `memryzed-read.md:283` recommends reusing ideas for redaction, transcripts, rank fusion and installer handling, subject to a licence check, and the plan cites none. Memryzed avoids guessing from entropy (line 164), and item 15 relies on it. | `code-1-35` |
| N3 | 664-665 | `purge` leaves hooks and MCP entries, despite line 86. Leftover hook behaviour is undefined. `import` has no owning file or rules. "Remove everything from the first version" is ambiguous. | `code-1-36`, `style-1-24` |
| N4 | 771 | "Static Analysis & Linting" lists only a typecheck. | `code-1-37`, `style-1-24` |
| N5 | 711, 748 | "Uninstall restores them" is unclear next to line 511, and restoring a backup would lose later edits. The test must use the *same* event, because `memryzed-read.md:58` shows a different-event test missed this overwrite bug. | `code-1-38`, `impl-1-19`, `style-1-24` |
| N6 | 557-584 | No step deletes throwaway scripts. Item 6's input file has no path or `.gitignore` entry. Item 4 reads real logs before any reader exists, with no repo named. Item 5 doesn't set the number of lessons or triggers. | `impl-1-22` |
| N7 | 642, 653, 695 | Trigger kinds vary ("commands, files and words" versus "keyword, command and path"), and line 642 uses "trigger" as a verb. | `style-1-6` |
| N8 | 561 | "The storage choice rests on these being unverified" reverses the meaning. | `style-1-23` |
| N9 | 537, 594, 641, 741-742, 781 | "It" has no antecedent. "So hooks stay fast" is unmeasured. "Functional" and "ready for Claude Design" are vague. "EGM" is undefined. | `style-1-24` |

## Unverified claims

| Line | Claim |
|---|---|
| 547 | Whether Codex reads `agents.md` on a case-insensitive disk. The plan already marks this as untested |
| 554, 566 | Package availability and the `Xenova/bge-small-en-v1.5` ID. Items 3 and 4 are meant to test this |
| 572-573 | Whether the 500 ms hook limit is achievable |
| 697-712 | All client behaviour, since nothing was tested live |
| 624 | How injected lesson text appears in every client's logs |

## Checked, no finding

These come from the codebase details reviewer:

- `docs/checks/client-capabilities.md` exists and has the 19 tests cited at line 522.
- `amem` is the name used in `agents.md`.
- `docs/spike.md`, `README.md`, `package.json` and `.gitignore` don't exist yet, so marking them Create is correct.
- The 300-token delivery limit is well below the Claude Code 10,000-character and Codex 2,500-token caps.
- The style reviewer found the caveat at lines 546-548 and the "(proposed)" labels at lines 680 and 775 correctly calibrated.

## Elephant spot checks

- **Confirmed:** `concepts_brief.md:278` proposes the delivery replay (R8).
- **Confirmed:** the project instructions say "Node 20+", and line 219 of the design says Node 22 "From `agents.md`" (R31).
- **Recalculated, consistent:** the exact interval for 3 of 6 (R13), and the Poisson figures of about 25% and 4% (R15).
- Everything else here is unverified by the Elephant.

## Traceability

| Consolidated | Raw findings |
|---|---|
| R1 | `impl-1-1`, `code-1-1` |
| R2 | `impl-1-2`, `code-1-2` |
| R3 | `impl-1-3`, `code-1-15`, `code-1-16`, `style-1-14` |
| R4 | `impl-1-4`, `code-1-21` |
| R5 | `impl-1-5`, `code-1-4` |
| R6 | `impl-1-6`, `code-1-25` |
| R7 | `impl-1-7`, `code-1-3`, `style-1-10` |
| R8 | `impl-1-11`, `code-1-8`, `style-1-2`, `style-1-3` |
| R9 | `impl-1-12`, `code-1-5` |
| R10 | `impl-1-12`, `code-1-6`, `style-1-1`, `style-1-21` |
| R11 | `code-1-7`, `style-1-5`, `style-1-19` |
| R12 | `impl-1-17`, `code-1-9`, `style-1-13` |
| R13 | `impl-1-9`, `code-1-10`, `style-1-7`, `style-1-8` |
| R14 | `impl-1-9`, `impl-1-18`, `code-1-11`, `style-1-9` |
| R15 | `impl-1-10`, `code-1-12` |
| R16 | `impl-1-10`, `code-1-13`, `style-1-11` |
| R17 | `code-1-14`, `style-1-12` |
| R18 | `code-1-17`, `style-1-18` |
| R19 | `impl-1-13`, `code-1-18`, `style-1-18` |
| R20 | `code-1-19`, `style-1-17` |
| R21 | `impl-1-14`, `code-1-22` |
| R22 | `impl-1-16`, `code-1-20` |
| R23 | `impl-1-15`, `code-1-30`, `style-1-16` |
| R24 | `style-1-15` |
| R25 | `impl-1-8` |
| R26 | `code-1-23`, `impl-1-19` |
| R27 | `impl-1-18`, `code-1-24`, `style-1-4` |
| R28 | `impl-1-19`, `code-1-26` |
| R29 | `code-1-27` |
| R30 | `code-1-28`, `impl-1-19` |
| R31 | `impl-1-19`, `code-1-29` |
| R32 | `impl-1-19`, `style-1-20` |
| R33 | `code-1-31`, `style-1-22`, `impl-1-21` |
| R34 | `code-1-32` |
| R35 | `code-1-33`, `impl-1-20` |
| N1-N9 | Listed in the Nits table |
