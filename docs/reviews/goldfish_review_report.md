Status: resolved

# Goldfish Annotated Review Report

**Target:** `docs/designs/muninn.md` (lines 534-782)

**Findings source:** `implementation_readiness_report.md` (Stage 9, round 1): 7 Blockers, 28 Majors, 9 Nits.

**Result:** 44 PROPOSE FIX, 0 CONTEST, 0 ESCALATE, 0 DECLINE. I checked these against the design, `docs/checks/`, `concepts_brief.md` and the trackers, and found no finding that was wrong. Several reviewers' *remedies* are rejected or reduced. Each justification says so.

**Nothing in the design has changed yet.** This report only proposes edits.

**How the fixes are organised:** nearly every plan item has at least one finding, so piecemeal edits would conflict. The fix is one replacement for lines 534-782 (Appendix A), plus the edits outside that range that keep the document consistent (Appendix B). Each finding names the items that resolve it.

**Not covered:** Stage 7 and Stage 8 findings that only affect lines 1-533 stay open unless Appendix B touches them. These include the risk section, the Alternatives Rule wording (C21, C22) and most style Nits.

## Decisions built into the fixes

"Auto accept" adopts all of these. Tell me if you want any of them changed, because each one changes Appendix A.

| # | Decision | Built-in choice | What you give up | Alternative |
|---|---|---|---|---|
| D1 | Generated triggers (Z1, Z2) | Cut generation and `PostToolUse`. Lessons are always-on or have a literal keyword the engineer typed, matched against the prompt only. Step 0 measures whether richer triggers are worth a later design | **The biggest cost in this report.** The token lesson becomes an always-on hook, close to an instruction-file line. muninn's edge on that lesson becomes learning it and sharing it across tools, not better timing. L64's "has to do better" and L97's "moment it applies" are only partly met | Keep generation, and specify an algorithm and replay gate in Step 0 |
| D2 | Approval (Z11) | A repeated `own_words` lesson goes live only after it has been shown at review and not rejected. Unshown lessons stay `proposed` | Narrows your decision at L215: nothing goes live unseen | Keep L215 as written, which needs reliable paste detection first |
| D3 | Gates (Z3) | Four decision gates with an outcome for every result. The 70% and 90% figures become reported measures, not gates. All new numbers are proposed | The 70% and 90% figures stop deciding anything | Keep them as gates with minimum counts, sample size and a judge |
| D4 | Client tests (Z5) | A reduced client matrix runs in Step 0, before any product code, and later items depend on its result | Step 0 takes longer | Keep them at the start of Stage 2 |
| D5 | MCP (Z6) | Defer the MCP server. Agents call `muninn ask` from the shell, and Step 0 tests that this works | Each agent search reloads the model. `save_lesson` goes away. CUJ 3's "agent asks through a tool" becomes a shell command | Keep MCP with a fail-closed rule, and restore tests 9 and 10 |
| D6 | Scanning (Z8) | Each `learn` re-reads all available logs. Offsets go away. `status` warns if `learn` is overdue | Slower reruns, possibly much slower on large histories | Store occurrences or cached embeddings, which needs a privacy decision against L288 |
| D7 | Signals (Stage 5 #13) | Stage 1 uses repeats only. Corrections and failure-then-fix are deferred. `muninn add` handles known lessons by hand (Z9) | Lessons from corrections and failures. Fewer lessons per repo, so the keep-rate gate may have few to judge. `inferred` lessons no longer exist in the first version | Keep the three signals and define rules for each in item 18 |
| D8 | Command sources (Stage 5 #13) | Manifests, Makefiles and commands seen to succeed. CI files and README blocks are deferred | L335's fuller index | Keep all five, and add a YAML dependency and extraction rules |

**Question I can't settle from the files:** `docs/devlog.md:77` records "No delivery, UI, daemon or database yet" for the first build, while the design at L212 says the author chose a libSQL store. Item 2 in Appendix A adds a dated devlog entry saying the design supersedes that line. Tell me if that isn't what you decided.

## Prioritized Findings & AI Suggestions

Blockers come first, then Majors, then Nits. "Item" refers to Appendix A, and "B-n" refers to Appendix B.

### [Issue 1] R1 [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** [Lines 649-653](../designs/muninn.md#L649-L653) (item 18)
*   **Discrepancy Description:** Trigger generation has no algorithm: window, sources, normalisation, grammar, stop words and per-lesson count are all undefined. No item writes the `triggers` table.
*   **Rationale:** The stated rule can pick the refresh command, and keywords from the instruction fire only when the engineer repeats the reminder.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid: L653 is the whole specification. The reviewers asked for a full algorithm. I propose removing the need for one (D1), because no example in the document needs generation and its one example may fail.
*   ***Proposed Edit:***
    *   Location: item 18 and L277-281
    *   Change: Appendix A items 18-20, B-5

### [Issue 2] R2 [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** [Lines 653, 681, 686-701](../designs/muninn.md#L686-L701)
*   **Discrepancy Description:** Nothing delivers the token lesson before the run in the common case.
*   **Rationale:** A prompt needn't contain the trigger, `PostToolUse` comes after the call, and `PreToolUse` isn't built.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Always-on delivery at session start gives a documented route in both clients, untested until the matrix runs. Test 3 still runs, but building a refusal path gets its own design pass, because a failed lesson shouldn't block a run on untested behaviour. The cost is in D1.
*   ***Proposed Edit:***
    *   Location: items 23-25, L92-99, L298-308
    *   Change: Appendix A items 7, 24, 26, B-3, B-6

### [Issue 3] R3 [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Blocker
*   **Affected Scope:** [Lines 686-701](../designs/muninn.md#L686-L701) (item 23)
*   **Discrepancy Description:** Item 23 doesn't say which tests apply, what passes or what changes. Its test list doesn't cover the main delivery moments.
*   **Rationale:** "The matching part of this plan changes" gives no mapping, and most tests are open questions.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. `client-capabilities.md` lists no live test for session start or prompt delivery. The fix is a table with new M tests, numbered tests, pass rules, results and exclusions, run in Step 0 (D4).
*   ***Proposed Edit:***
    *   Location: item 23, L386
    *   Change: Appendix A item 7, B-9

### [Issue 4] R4 [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** [Lines 667-671, 692-712](../designs/muninn.md#L692-L712)
*   **Discrepancy Description:** Hook input, hook output, install targets and hook identity are undefined.
*   **Rationale:** An engineer has to guess. Codex can fail on a wrong output shape with an unclear message.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The output shape is documented. Input fields other than `transcript_path` aren't in the checks, so the plan marks them as expected and has item 7 record captured samples as fixtures.
*   ***Proposed Edit:***
    *   Location: items 21, 24, 25, 27
    *   Change: Appendix A items 7, 26, 28

### [Issue 5] R5 [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** [Lines 602-606](../designs/muninn.md#L602-L606) (item 10)
*   **Discrepancy Description:** The first migration can't be written, and needed storage is missing.
*   **Rationale:** The standard's Zero-Decision Rule names database schema explicitly.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The fix adds full DDL, including the fallback variant, with `baselines` and `search_log` tables. No occurrence table is added, because D6 re-reads logs instead.
*   ***Proposed Edit:***
    *   Location: item 10, L355-365
    *   Change: Appendix A item 12, B-8

### [Issue 6] R6 [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Blocker
*   **Affected Scope:** [Lines 596-600, 644-653, 676-678](../designs/muninn.md#L644-L653)
*   **Discrepancy Description:** Repeat and correction detection can't be coded or tested.
*   **Rationale:** Only "3 sessions" is numeric, and no rule separates "use X" from "never use X".
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The fix states a splitter, clustering, cutoff, negation rule, paste rule and ranking. All are tunable defaults, and the spike sets the cutoff. Correction rules go away with D7.
*   ***Proposed Edit:***
    *   Location: items 9, 17, 18, 22
    *   Change: Appendix A items 11, 18, 19, 23

### [Issue 7] R7 [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Blocker
*   **Affected Scope:** [Lines 658-659, 775-777](../designs/muninn.md#L775-L777)
*   **Discrepancy Description:** The Stage 2 success measure can't be computed.
*   **Rationale:** No baseline definition, table or window exists, and nothing counts repeats later. `concepts_brief.md:69` warns the baseline can't be rebuilt.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The fix defines the rate, stores it per lesson and tool, and adds `muninn report`.
*   ***Proposed Edit:***
    *   Location: item 19, L775-777, L111-113
    *   Change: Appendix A items 5, 12, 20, 30, B-2

### [Issue 8] R8 [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 575-579, 586-587, 673-682, 744-749, 772](../designs/muninn.md#L575-L579)
*   **Discrepancy Description:** Generated triggers are never evaluated, and "the product's main bet" misdescribes what item 6 tests.
*   **Rationale:** Automatic delivery uses neither keyword search nor embeddings. `concepts_brief.md:278` proposed a replay that the plan dropped.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid: I confirmed `concepts_brief.md:278`. The fix restores that replay, using hand-picked literal triggers, and adds a threshold set in advance for deciding whether richer triggers deserve a design pass.
*   ***Proposed Edit:***
    *   Location: item 6, Step 0 gate
    *   Change: Appendix A item 9, Step 0 gate

### [Issue 9] R9 [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major
*   **Affected Scope:** [Lines 692-695](../designs/muninn.md#L692-L695)
*   **Discrepancy Description:** Trigger matching semantics are undefined.
*   **Rationale:** Case, boundaries, ties and token counting are unstated.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Literal triggers make this short to specify.
*   ***Proposed Edit:***
    *   Location: item 24
    *   Change: Appendix A item 25

### [Issue 10] R10 [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 611-612, 649-665](../designs/muninn.md#L649-L665)
*   **Discrepancy Description:** Approval and lesson states don't cover triggers, and "keep", "approve" and "live" have no mapping.
*   **Rationale:** Inferred triggers could fire unreviewed, and unseen lessons could go live.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The fix is a state table. With D1, the engineer types every trigger, so no separate trigger approval is needed.
*   ***Proposed Edit:***
    *   Location: items 11, 19, 20, L94-96, L319-322
    *   Change: Appendix A items 13, 20, 21, B-3, B-7

### [Issue 11] R11 [`egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 606, 611, 658-664](../designs/muninn.md#L658-L664)
*   **Discrepancy Description:** Nothing sets always-on, blocking or global.
*   **Rationale:** A lesson with no route is never delivered, and nobody is told.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The fix asks at review, defaults to repo scope, warns when a lesson has no route and drops `blocking`.
*   ***Proposed Edit:***
    *   Location: items 10, 19, 20
    *   Change: Appendix A items 12, 20, 21

### [Issue 12] R12 [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 557-573, 586-587](../designs/muninn.md#L586-L587)
*   **Discrepancy Description:** The Step 0 gate is incomplete, its embedding threshold is weak and the fallback has no driver.
*   **Rationale:** One extra hit in about 20 is noise.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The fix gives every spike result a number and an action. `node:sqlite` and its FTS5 support are unverified, so the spike tests them before the fallback is relied on.
*   ***Proposed Edit:***
    *   Location: items 3-5, Step 0 gate
    *   Change: Appendix A items 8, 9, Step 0 gate

### [Issue 13] R13 [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 680-682](../designs/muninn.md#L680-L682)
*   **Discrepancy Description:** The keep-rate gate is gameable, has an undefined middle band and rests on small counts.
*   **Rationale:** Showing 2 and keeping 1 passes. Keeping 3 of 6 has an interval of about 12-88%.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The reviewer's 30 pooled lessons may be more than D7 can produce, so I use 20, with fewer than that counting as inconclusive rather than a pass. With 20 lessons, the 50% and 25% bars are still rough signals, and the gate says so.
*   ***Proposed Edit:***
    *   Location: Stage 1 gate
    *   Change: Appendix A, Gate to Stage 2

### [Issue 14] R14 [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 550-555, 586-587, 681, 751-755](../designs/muninn.md#L680-L682)
*   **Discrepancy Description:** The outside-engineer test is an anecdote and can't run in sequence.
*   **Rationale:** One person decides it, and there is no package or README in time.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid, but I reject requiring more engineers as a numeric gate: a handful of friends still proves little, and a kept lesson does nothing in Stage 1. It becomes qualitative feedback from a few engineers, using a tarball and a short README made earlier. `concepts_brief.md:235` says this gate was never confirmed by you.
*   ***Proposed Edit:***
    *   Location: Stage 1 gate, item 34
    *   Change: Appendix A items 22, 32, Gate to Stage 2, B-2

### [Issue 15] R15 [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major
*   **Affected Scope:** [Lines 775-777](../designs/muninn.md#L775-L777)
*   **Discrepancy Description:** The 70% target can pass with no effect.
*   **Rationale:** At about 1.4 repeats per two weeks, zero repeats occur about 25% of the time with no effect (recalculated, consistent). Lessons are also selected because they spiked.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. It becomes a reported measure (D3), and the gate uses a direct check on token-script runs.
*   ***Proposed Edit:***
    *   Location: L775-777
    *   Change: Appendix A items 30, 33, Gate after delivery

### [Issue 16] R16 [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 775-777](../designs/muninn.md#L775-L777)
*   **Discrepancy Description:** The 90% check and the instruction-file comparison can't produce a result.
*   **Rationale:** No sample, judge or procedure exists, and misses can't appear.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid, except for the sampling protocol, which I reject as too much process for one user. The author reviews every delivery, marks it as self-graded, and separates relevant from correct. The comparison gets an order and a rule.
*   ***Proposed Edit:***
    *   Location: L775-777
    *   Change: Appendix A items 6, 30, 33, Gate after delivery

### [Issue 17] R17 [`egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 148, 536, 586, 680, 684-777](../designs/muninn.md#L684-L777)
*   **Discrepancy Description:** Step 2 has no real gate, and it bundles unrelated work.
*   **Rationale:** The standard requires incremental phases.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Step 2 splits into delivery, a gate, then ask and UI.
*   ***Proposed Edit:***
    *   Location: Step 2
    *   Change: Appendix A Steps 2 and 3, B-1

### [Issue 18] R18 [`egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 697-701, 711-712, 773](../designs/muninn.md#L697-L701)
*   **Discrepancy Description:** "Codex" is treated as one target.
*   **Rationale:** The checks record 0.133.0, the app's 0.155 build and 0.163.0 on npm, with 180 of 185 threads on the app's version.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The matrix names both builds, and its result sets the minimum supported build. I reject per-claim version notes, following Stage 8.
*   ***Proposed Edit:***
    *   Location: items 23, 34, E2E
    *   Change: Appendix A items 7, 32, E2E

### [Issue 19] R19 [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 158, 708-712, 754](../designs/muninn.md#L708-L712)
*   **Discrepancy Description:** Cursor is called unsupported, but the install can make it run muninn.
*   **Rationale:** Cursor imports hooks from `~/.claude/settings.json` by default (`client-capabilities.md:84`).
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Cursor hooks document `conversation_id` and `workspace_roots` (line 86), so the hook can log a skip and return nothing when those are present. Whether they appear on imported hooks is unverified, so matrix test 16 confirms it.
*   ***Proposed Edit:***
    *   Location: items 25, 27, 34
    *   Change: Appendix A items 7, 26, 28, 32

### [Issue 20] R20 [`egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 712, 729-730](../designs/muninn.md#L729-L730)
*   **Discrepancy Description:** The Codex trust flow and "hook health" are thinner than the evidence.
*   **Rationale:** A hook that never runs writes nothing.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The fix logs every invocation and has `status` report the last one. A stable command avoids hash changes on upgrade, if the hash covers only the command, which test 15 checks. I reject comparing with client logs, following Stage 8.
*   ***Proposed Edit:***
    *   Location: items 27, 30
    *   Change: Appendix A items 7, 26, 28, 29

### [Issue 21] R21 [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major
*   **Affected Scope:** [Lines 692-706](../designs/muninn.md#L692-L706)
*   **Discrepancy Description:** Compaction rules are unresolved.
*   **Rationale:** Second compactions, limits and delayed Codex delivery have no rule.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Stage 8's simpler rule applies: compaction delivers always-on lessons and resets the once-per-session record. No restore budget or read-back is needed.
*   ***Proposed Edit:***
    *   Location: items 24-26, L301, L311
    *   Change: Appendix A items 25, 26, B-6

### [Issue 22] R22 [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major
*   **Affected Scope:** [Lines 732-736](../designs/muninn.md#L732-L736)
*   **Discrepancy Description:** MCP project detection is untested and has no fallback.
*   **Rationale:** Process lifetime is unknown for all clients, and a wrong answer could cross repos.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. D5 removes this. An agent's shell call runs in its own directory. Matrix M4 checks this works, and failure brings MCP back through a design pass.
*   ***Proposed Edit:***
    *   Location: item 31, L224-225, L325-326, L339-341
    *   Change: Appendix A item 7, B-4

### [Issue 23] R23 [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 572-573, 602-606, 697-701, 747](../designs/muninn.md#L697-L701)
*   **Discrepancy Description:** The hook's time limit and failure logging aren't implementable as written.
*   **Rationale:** A timer can't stop blocked native calls, the store may be what's locked, and migrations could start inside a hook.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The fix sets a short lock wait, adds the client's own timeout as the hard stop, bars hooks from migrating and adds one plain error file. I reject moving delivery logs to a side file, following Stage 8.
*   ***Proposed Edit:***
    *   Location: items 5, 10, 25, 33
    *   Change: Appendix A items 8, 12, 26, 31

### [Issue 24] R24 [`egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 706, 711-712, 735-736](../designs/muninn.md#L706)
*   **Discrepancy Description:** Unverified client behaviour is stated as settled.
*   **Rationale:** Rows 3b, 5a and 5c and test 15 say otherwise.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Step 2 now opens with a sentence saying it depends on recorded matrix results.
*   ***Proposed Edit:***
    *   Location: Step 2 opening
    *   Change: Appendix A Step 2

### [Issue 25] R25 [`egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** [Lines 614-618, 644-647](../designs/muninn.md#L614-L618)
*   **Discrepancy Description:** Incremental scans lose the repeat signal.
*   **Rationale:** Earlier sentences aren't stored, so a repeat spread over scans never reaches 3 sessions.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid, and Stage 8 reached the same result independently. D6 removes offsets, and the spike measures rerun cost.
*   ***Proposed Edit:***
    *   Location: items 12, 17, L364
    *   Change: Appendix A items 12, 19, 20, B-8

### [Issue 26] R26 [`egm-codebase-details`, `egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** [Lines 624, 676](../designs/muninn.md#L620-L624)
*   **Discrepancy Description:** Readers may count muninn's own injected text.
*   **Rationale:** Claude Code transcripts hold hook-context attachment records (`client-capabilities.md:62`).
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Matrix M3 finds the record type, and readers exclude it, with a fixture and test.
*   ***Proposed Edit:***
    *   Location: items 13, 21, 22
    *   Change: Appendix A items 7, 15, 22, 23

### [Issue 27] R27 [`egm-implementation-readiness`, `egm-codebase-details`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 773-774](../designs/muninn.md#L773-L774)
*   **Discrepancy Description:** The E2E step can't work as written.
*   **Rationale:** A throwaway repo has no history, and only an always-on lesson clearly passes.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The fix uses `muninn add`, one lesson per delivery route, named client builds and a separate learner check on fixtures.
*   ***Proposed Edit:***
    *   Location: E2E line
    *   Change: Appendix A Verification Plan

### [Issue 28] R28 [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major
*   **Affected Scope:** [Lines 673-678, 744-749, 772](../designs/muninn.md#L744-L749)
*   **Discrepancy Description:** Listed tests leave large gaps.
*   **Rationale:** L772 requires named tests only for what's listed.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid for what remains in scope. MCP, generation and `import` tests go away with the features.
*   ***Proposed Edit:***
    *   Location: items 22, 33
    *   Change: Appendix A items 23, 31, 36

### [Issue 29] R29 [`egm-codebase-details`] - Severity: Major
*   **Affected Scope:** [Lines 717, 723](../designs/muninn.md#L717-L723)
*   **Discrepancy Description:** Search and command results have no trust boundary.
*   **Rationale:** `proposed` lessons could reach agents, and logged commands contradict L504.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Search returns `live` lessons only, and commands are labelled as data with their source. I reject an approval step for commands, because the agent can read the same manifest itself. L504 is corrected.
*   ***Proposed Edit:***
    *   Location: items 28, 29, L502-504
    *   Change: Appendix A items 34, 35, B-10

### [Issue 30] R30 [`egm-codebase-details`, `egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** [Lines 717, 729](../designs/muninn.md#L717)
*   **Discrepancy Description:** Nothing runs the command index or later scans.
*   **Rationale:** "Last capture" and the repeat measure depend on an unstated habit.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. `learn` also builds the index, and `status` warns when it's overdue. I reject a hook-based scan, following Stage 8: it needs the model, which hooks don't hold.
*   ***Proposed Edit:***
    *   Location: items 19, 28, 30
    *   Change: Appendix A items 20, 29, 34

### [Issue 31] R31 [`egm-implementation-readiness`, `egm-codebase-details`] - Severity: Major
*   **Affected Scope:** [Lines 550-555, 769-771](../designs/muninn.md#L550-L555)
*   **Discrepancy Description:** Build and dependencies are underspecified.
*   **Rationale:** The standard requires dependencies up front. L219 attributes Node 22 to `agents.md`, which says "Node 20+" (confirmed).
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. D5 and D8 remove the TOML and YAML needs, provided Codex hooks go in `hooks.json`, which the matrix confirms. The package name stays open, so a working name is used and nothing is published.
*   ***Proposed Edit:***
    *   Location: item 2, Verification Plan, L219
    *   Change: Appendix A item 4, Verification Plan, B-11

### [Issue 32] R32 [`egm-implementation-readiness`, `egm-style`] - Severity: Major
*   **Affected Scope:** [Lines 632-642, 714-749](../designs/muninn.md#L632-L642)
*   **Discrepancy Description:** Redaction, model verification, UI and `pause` leave design choices open.
*   **Rationale:** They fail the Zero-Decision Rule.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The fix states each one. It uses regex rules only and drops entropy checks, because Memryzed's redactor deliberately avoids them and they could damage quotes (`memryzed-read.md:164`). "Secrets never reach the store" is reworded to what fixtures show.
*   ***Proposed Edit:***
    *   Location: items 15, 16, 30, 32, L287-288
    *   Change: Appendix A items 11, 16, 17, 37, B-5

### [Issue 33] R33 [`egm-codebase-details`, `egm-style`, `egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** [Lines 536, 757-765](../designs/muninn.md#L757-L765)
*   **Discrepancy Description:** Tracker and devlog work is in the wrong place, and "replace the phases" doesn't fit the devlog.
*   **Rationale:** `docs/implementation-plan.md:12` schedules this straight after review, and gate logging starts at Step 0.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid: confirmed in both files. The move to Step 0 includes the Quality bar, the dogfood milestone and the devlog header. See the question above about `docs/devlog.md:77`.
*   ***Proposed Edit:***
    *   Location: item 35
    *   Change: Appendix A item 2

### [Issue 34] R34 [`egm-codebase-details`] - Severity: Major
*   **Affected Scope:** [Lines 543-548, 760](../designs/muninn.md#L543-L548)
*   **Discrepancy Description:** Moving `agents.md` leaves references unlisted.
*   **Rationale:** The move has a wider file boundary than stated.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Partly valid. Live references should change, but dated records such as `concepts_brief.md`, devlog entries and `docs/checks/` should stay as written. The note goes at the end of the moved file, so citations like `agents.md:34` stay accurate in content.
*   ***Proposed Edit:***
    *   Location: item 1
    *   Change: Appendix A items 1, 2, B-11

### [Issue 35] R35 [`egm-codebase-details`, `egm-implementation-readiness`] - Severity: Major
*   **Affected Scope:** [Lines 667-671](../designs/muninn.md#L667-L671)
*   **Discrepancy Description:** Hand-written fixtures would encode guesses about formats, and their paths are directories.
*   **Rationale:** L250 says "saved sample logs", and the check recorded structure only.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Fixtures derive from real structure with invented content, with exact file names, and one is added per observed format change. L250 is aligned.
*   ***Proposed Edit:***
    *   Location: item 21, L250
    *   Change: Appendix A item 22, B-12

### [Issue 36] N1 [`egm-codebase-details`] - Severity: Nit
*   **Affected Scope:** [Lines 762-765](../designs/muninn.md#L762-L765)
*   **Discrepancy Description:** The condition for deleting `design_draft.md` is already met, and the file can't be recovered through git.
*   **Rationale:** No commits exist.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Confirmed: `diff` shows only the Status line differs. The delete moves to Step 0, after the author commits the design.
*   ***Proposed Edit:***
    *   Location: item 36
    *   Change: Appendix A item 3

### [Issue 37] N2 [`egm-codebase-details`] - Severity: Nit
*   **Affected Scope:** [Lines 635, 717-723](../designs/muninn.md#L632-L636)
*   **Discrepancy Description:** The plan doesn't use the Memryzed read's reuse recommendations.
*   **Rationale:** `memryzed-read.md:283` recommends them, subject to a licence check.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Worth a line in the items concerned.
*   ***Proposed Edit:***
    *   Location: items 13, 15, 27, 29
    *   Change: Appendix A items 15, 16, 28, 35

### [Issue 38] N3 [`egm-codebase-details`, `egm-style`] - Severity: Nit
*   **Affected Scope:** [Lines 664-665](../designs/muninn.md#L664-L665)
*   **Discrepancy Description:** `purge` leaves hooks, and `import` has no owner.
*   **Rationale:** L86 promises one command removes everything.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** `purge` also runs the uninstall step and removes the model, and `import` is cut.
*   ***Proposed Edit:***
    *   Location: item 20, L86, L374
    *   Change: Appendix A item 21, B-8

### [Issue 39] N4 [`egm-codebase-details`, `egm-style`] - Severity: Nit
*   **Affected Scope:** [Line 771](../designs/muninn.md#L771)
*   **Discrepancy Description:** "Static Analysis & Linting" lists only a typecheck.
*   **Rationale:** The label overstates it.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Rename it. No linter is added.
*   ***Proposed Edit:***
    *   Location: L771
    *   Change: Appendix A Verification Plan

### [Issue 40] N5 [`egm-codebase-details`, `egm-implementation-readiness`, `egm-style`] - Severity: Nit
*   **Affected Scope:** [Lines 711, 748](../designs/muninn.md#L748)
*   **Discrepancy Description:** "Uninstall restores them" is unclear, and the test must use the same event.
*   **Rationale:** `memryzed-read.md:58` shows a different-event test missed an overwrite bug.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Uninstall removes only muninn's entries and never restores a backup.
*   ***Proposed Edit:***
    *   Location: items 27, 33
    *   Change: Appendix A items 28, 31

### [Issue 41] N6 [`egm-implementation-readiness`] - Severity: Nit
*   **Affected Scope:** [Lines 557-584](../designs/muninn.md#L557-L584)
*   **Discrepancy Description:** Spike details are missing.
*   **Rationale:** No runner, input path or cleanup is given.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Small, and needed for the Step 0 changes.
*   ***Proposed Edit:***
    *   Location: Step 0
    *   Change: Appendix A Step 0 opening, items 4, 9, 10

### [Issue 42] N7 [`egm-style`] - Severity: Nit
*   **Affected Scope:** [Lines 642, 653, 695](../designs/muninn.md#L642)
*   **Discrepancy Description:** Trigger terms vary.
*   **Rationale:** "Trigger" is a domain noun.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Triggers become one kind, a literal pattern, and line 642's verb changes.
*   ***Proposed Edit:***
    *   Location: items 16, 18, 24
    *   Change: Appendix A items 17, 25, migration 001 in item 12

### [Issue 43] N8 [`egm-style`] - Severity: Nit
*   **Affected Scope:** [Line 561](../designs/muninn.md#L561)
*   **Discrepancy Description:** "The storage choice rests on these being unverified" reverses the meaning.
*   **Rationale:** Plain wording error.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Rewritten.
*   ***Proposed Edit:***
    *   Location: item 3
    *   Change: Appendix A item 8

### [Issue 44] N9 [`egm-style`] - Severity: Nit
*   **Affected Scope:** [Lines 537, 594, 641, 741-742, 781](../designs/muninn.md#L537)
*   **Discrepancy Description:** Vague wording: "it", "stay fast", "verifies the file", "functional", "ready for Claude Design".
*   **Rationale:** Unclear or unsupported.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Rewritten where the replacement touches them. The "Drafted with EGM" footer stays, because it's harmless.
*   ***Proposed Edit:***
    *   Location: as listed
    *   Change: Appendix A throughout

---

# Appendix A: Replacement for lines 534-782

All numbers are proposed. Expected hook fields and the `node:sqlite` fallback are unverified until Step 0 reports.

````markdown
## Detailed Implementation Plan

Work happens in order, and each step ends at a gate. Gate numbers are proposed. They are written down before the run they judge, and any change is logged in `docs/devlog.md` with its reason. Files are relative to the repo root. The project is a single npm package using pnpm, TypeScript and Vitest, with zod for validating inputs.

### Step 0: Clean up, baseline and spike

Spike scripts are throwaway, and they run with `tsx`. Real-log inputs and copies stay in `~/.muninn-spike/`, outside the repo. Item 10 deletes the scripts once their results are recorded.

#### 1. `agents.md` (Move to `docs/archive/original-build-spec.md`)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Move the file and add a note at the end, so its line numbers stay the same, saying this design replaces it. On a macOS disk that ignores case, Codex may read `agents.md` as its instructions file, and Claude Code reads `AGENTS.md` when no `CLAUDE.md` exists. Either could follow an outdated build spec with the name `amem`. Whether that happens has not been tested. Dated records (`concepts_brief.md`, `docs/checks/`, existing devlog entries) keep their references.

#### 2. `docs/implementation-plan.md` and `docs/devlog.md` (Modify)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: In the tracker, replace the phases, Quality bar and dogfood milestone with the steps here, and remove its references to `agents.md`. In the devlog, change the header at lines 4-7 so it no longer promises migration through `remember` at the end of Phase 1. Add a dated entry saying this design replaces the "no database" line in the 2026-11-03 entry. Log every gate result in the devlog from this step on.

#### 3. `design_draft.md` (Delete)

*   **Type / Scope**: Working file.
*   **Proposed Changes**: Delete after the author has committed `docs/designs/muninn.md`. The two files differ only in their Status line, and neither is in git yet.

#### 4. `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `scripts/copy-assets.mjs` (Create)

*   **Type / Scope**: Build configuration.
*   **Proposed Changes**: Package with the working name `muninn-preview`, which is not published. A `muninn` command at `dist/cli.js`, and Node 22 or later. Dependencies: `@libsql/client`, `@huggingface/transformers` and `zod`. Dev dependencies: `typescript`, `vitest` and `tsx`. Scripts: `build` (`tsc`, then `copy-assets.mjs` copies `src/store/migrations/*.sql` and `src/ui/public/*` into `dist/`), `test` (`vitest run`) and `typecheck` (`tsc --noEmit`). The HTTP server and prompts use `node:http` and `node:readline/promises`. Tokens are estimated as characters divided by 4. Ignore build output and any real logs. Adding another dependency needs a line in the devlog.

#### 5. `scripts/spike/baseline.ts` (Create)

*   **Type / Scope**: Throwaway script.
*   **Proposed Changes**: Before anything else changes, the author raises `cleanupPeriodDays` in Claude Code, and this script copies the token repo's logs to `~/.muninn-spike/logs/`. It records, per tool, the available window, total sessions and sessions containing the token reminder, as sessions with a repeat per 10 sessions. Only counts go in `docs/spike.md`. Reminders may stop during the next item, so this is the evidence the learner is later tested on.

#### 6. Instruction-line trial (result recorded in `docs/spike.md`)

*   **Type / Scope**: Manual check.
*   **Proposed Changes**: The author adds token and `caffeinate` lines to the token repo's instruction file and starts the next 5 token-script runs in each of Claude Code and Codex without mentioning them. Record, per run, whether the agent refreshed the token before starting. Auto memory stays at its default, and the result records whether it held anything relevant. Remove the lines afterwards.

#### 7. `scripts/spike/client-hook.mjs`, `docs/checks/client-live-tests.md`, `test/fixtures/hooks/` (Create)

*   **Type / Scope**: Throwaway script, documentation and test data.
*   **Proposed Changes**: Using a throwaway project and a hook that returns a unique made-up fact, run the checks below on Claude Code 2.1.317, Codex CLI 0.133.0 and the desktop app's 0.155 build. Record the result per client and build, and the minimum supported Codex build.

| Check | Passes if | If it fails |
|---|---|---|
| M1: `SessionStart` at session start | The model repeats the fact on the first turn | That client or build gets no session-start delivery. If Codex has none on any build, the Stage 2 goal narrows to Claude Code and the author is told |
| M2: `UserPromptSubmit` | The model repeats the fact in that turn | That client gets no keyword delivery |
| M3: where hook text appears | The record type holding the fact is found in the transcript | Readers cannot exclude it, so the learner reports the tool as unsupported until solved |
| M4: agent shell call | An agent runs a local command from the project directory under default settings, gets its output, and the command writes a file under `MUNINN_HOME` | `muninn ask` cannot serve agents there. Agent search returns in a design pass with tests 9 and 10 |
| Test 6: `SessionStart` with `compact` | The model repeats the fact after forced compaction. Record which turn | Restore is not promised for that client, and the README says so |
| Test 15: Codex trust | Record what the user sees when a hook is added and changed, and whether an untrusted hook is silent | `install` and `status` state the observed behaviour |
| Test 16: Cursor import | Record whether a hook in `~/.claude/settings.json` runs in Cursor, and whether its input holds `conversation_id` or `workspace_roots` | If neither field appears, find another signal in the recorded input before item 26 is built |
| Test 17: hook latency | Record the slowdown with a hook on `UserPromptSubmit` | The limit in item 26 is lowered to what the user does not notice |
| Test 3: pre-tool timing, two clients | Record the timing and whether deny-with-reason stops a call | No build follows either way. Any refusal path needs its own design pass |
| Test 5: subagents | Record whether text reaches subagents | Recorded as a limitation |

Tests 1, 2, 7, 8, 11 and 19 wait for Cursor support. Test 4 does not apply at a 300-token limit. Tests 9 and 10 wait for MCP. Tests 12, 13 and 14 do not apply, because muninn starts no client. Test 18 is covered by unknown-structure counts until a release.

Save the observed hook input and accepted output per client and event as `test/fixtures/hooks/claude-code-session-start.json`, `claude-code-user-prompt.json`, `codex-session-start.json` and `codex-user-prompt.json`. Expected input fields, to be confirmed here: `session_id`, `cwd`, `hook_event_name`, `transcript_path`, plus `prompt` on `UserPromptSubmit` and `source` on `SessionStart`. Expected output: `{"hookSpecificOutput":{"hookEventName":"<event>","additionalContext":"<text>"}}`.

#### 8. `scripts/spike/libsql-check.ts`, `scripts/spike/hook-latency.ts` (Create)

*   **Type / Scope**: Throwaway scripts.
*   **Proposed Changes**: `libsql-check` tests vector columns, FTS5 and 4 processes writing at once, and clean installs of `@libsql/client` and `@huggingface/transformers` on macOS and Linux. Separately, it tests the fallback: `node:sqlite` with vectors stored as blobs and a full scan, and FTS5. The storage choice depends on these results, and none is verified yet. `hook-latency` measures a full hook run (Node start-up, opening the store, repo identity, matching 500 triggers, writing a log row), 50 times, while another process writes as `learn` would, against a store holding 500 lessons.

#### 9. `scripts/spike/embed-check.ts`, `scripts/spike/match-check.ts` (Create)

*   **Type / Scope**: Throwaway scripts.
*   **Proposed Changes**: `embed-check` measures `Xenova/bge-small-en-v1.5` size, load time, time per embedding and time to embed one real repo's logs. `match-check` reads `~/.muninn-spike/instructions.jsonl`, which holds about 20 real repeated instructions and 20 vague questions, with answers labelled before the run. It reports:
    *   what keyword search and embeddings each find, with a shortlist of 5, and the similarity cutoff that works best
    *   for each instruction, whether always-on is enough or it needs a specific moment, judged by the author before seeing results
    *   a replay of hand-picked literal triggers against other real transcripts, counting correct, missed and wrong firings
    *   whether each instruction's sentence makes sense on its own, as lesson text
    *   whether Claude Code and Codex logs mark pasted text or non-interactive sessions

#### 10. `docs/spike.md` (Create), `scripts/spike/` (Delete)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Results of items 5-9 and the decisions below, then delete the spike scripts.

**Gate:**

| Result | Action |
|---|---|
| The instruction line gets at least 4 of 5 runs right in a client | Stop and bring this to the author before any build: muninn must then justify itself on learning and sharing, not delivery |
| FTS5, concurrent writes or installs fail on libSQL | Use the fallback if it passes, and tell the author. If it also fails, stop |
| Vector columns fail, FTS5 and writes pass | Store vectors as blobs with a full scan in libSQL |
| Full hook run p95 is over 500 ms | Stop and bring this to the author: hook delivery cannot meet its limit |
| Embeddings beat keywords by fewer than 3 of 20 on repeats and fewer than 3 of 20 on vague questions | Bring this to the author before continuing |
| Package with the model is over 50 MB | Download once with consent. Otherwise ship it |
| First run takes over 5 minutes on a real repo | Bring this to the author, and consider caching embeddings by sentence hash |
| Sentences alone make sense in fewer than half of cases | Bring this to the author: lesson text needs another approach |
| 5 or more of 20 instructions need a specific moment and the replay misses over half of them | Note it for a later design pass on richer triggers. It does not block Stage 1 |
| M1 or M2 fails on both clients | Stop and bring this to the author |

### Step 1: Stage 1, the learner

#### 11. `src/cli.ts`, `src/config.ts` (Create)

*   **Type / Scope**: Entry point and settings.
*   **Proposed Changes**: `cli.ts` routes commands, and imports the model and learner only for commands that use them, so hook runs do not load them. `config.ts` finds `~/.muninn` or `MUNINN_HOME` and reads `config.json`, with these defaults: `minSessions` 3, `similarityCutoff` from the spike, `shownPerRun` 10, `autoLiveOwnWords` true, `maxPerDelivery` 3, `tokensPerDelivery` 300, `tokensPerSession` 1000, `hookLimitMs` 500. `muninn pause` creates the file `~/.muninn/paused`.

#### 12. `src/store/db.ts`, `src/store/migrations/001_initial.sql` (Create)

*   **Type / Scope**: Storage.
*   **Proposed Changes**: Opens the store with write-ahead logging, and a lock wait of 100 ms for hooks and 5,000 ms otherwise. Backs up before migrating and runs numbered migrations. Hooks never migrate: on a schema mismatch they log to the error file in item 26 and exit. The first migration is below. On the fallback, `embedding` is `BLOB` and the vector index is omitted.

```sql
CREATE TABLE repos (id TEXT PRIMARY KEY, paths TEXT NOT NULL, excluded INTEGER NOT NULL DEFAULT 0);
CREATE TABLE lessons (
  id TEXT PRIMARY KEY, repo_id TEXT REFERENCES repos(id),
  scope TEXT NOT NULL CHECK (scope IN ('repo','global')),
  text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('own_words','manual')),
  status TEXT NOT NULL CHECK (status IN ('proposed','live','rejected','retired')),
  reviewed_at TEXT, first_shown_at TEXT, edited_by_person INTEGER NOT NULL DEFAULT 0,
  always_on INTEGER NOT NULL DEFAULT 0,
  embedding F32_BLOB(384), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX lessons_vec ON lessons (libsql_vector_idx(embedding));
CREATE INDEX lessons_repo_status ON lessons (repo_id, status);
CREATE TABLE lesson_versions (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id), text TEXT NOT NULL, changed_by TEXT NOT NULL, changed_at TEXT NOT NULL);
CREATE TABLE triggers (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id), pattern TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE evidence (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id), tool TEXT NOT NULL, session TEXT NOT NULL, seen_at TEXT NOT NULL, quote TEXT NOT NULL);
CREATE TABLE baselines (lesson_id TEXT NOT NULL REFERENCES lessons(id), tool TEXT NOT NULL, window_start TEXT NOT NULL, window_end TEXT NOT NULL, sessions_total INTEGER NOT NULL, sessions_with_repeat INTEGER NOT NULL, PRIMARY KEY (lesson_id, tool));
CREATE TABLE commands (id TEXT PRIMARY KEY, repo_id TEXT NOT NULL REFERENCES repos(id), command TEXT NOT NULL, source TEXT NOT NULL, last_seen TEXT NOT NULL, embedding F32_BLOB(384));
CREATE TABLE deliveries (id TEXT PRIMARY KEY, ts TEXT NOT NULL, tool TEXT NOT NULL, session TEXT, event TEXT NOT NULL, lesson_id TEXT, lesson_version TEXT, trigger_id TEXT, outcome TEXT NOT NULL CHECK (outcome IN ('sent','no_match','limit','paused','timeout','unsupported_client')), tokens INTEGER NOT NULL DEFAULT 0);
CREATE INDEX deliveries_session ON deliveries (session, lesson_id);
CREATE TABLE search_log (id TEXT PRIMARY KEY, ts TEXT NOT NULL, from_repo TEXT, result_repo TEXT NOT NULL, query_kind TEXT NOT NULL);
CREATE TABLE scan_counts (tool TEXT NOT NULL, client_version TEXT NOT NULL, scanned_at TEXT NOT NULL, unknown_records INTEGER NOT NULL, PRIMARY KEY (tool, client_version));
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE VIRTUAL TABLE lessons_fts USING fts5(text, content='lessons', content_rowid='rowid');
CREATE VIRTUAL TABLE commands_fts USING fts5(command, source, content='commands', content_rowid='rowid');
```

#### 13. `src/store/lessons.ts` (Create)

*   **Type / Scope**: Storage.
*   **Proposed Changes**: Create, edit, retire, approve, list and find similar. Every change writes a version, and FTS tables are updated in the same transaction. A scan cannot overwrite a lesson with `edited_by_person` set. Transitions:

| From | Action | To | Reviewed? |
|---|---|---|---|
| `proposed` | Shown and kept or edited | `live` | Yes |
| `proposed` | Shown and left undecided, with `autoLiveOwnWords` on | `live` | No, and shown as not yet reviewed |
| `proposed` | Shown and left undecided, with the setting off, or never shown | `proposed` | No |
| `proposed` | Rejected | `rejected` | Yes |
| none | `muninn add` | `live` | Yes |
| `live` | `muninn approve` | `live` | Yes |
| `live` | `muninn retire` | `retired` | Yes |

#### 14. `src/repo/identity.ts` (Create)

*   **Type / Scope**: Repo detection.
*   **Proposed Changes**: Turns a directory into a repo identity. Covers worktrees through the shared git folder, SSH and HTTPS forms of one remote, and repos with no remote.

#### 15. `src/logs/types.ts`, `src/logs/discover.ts`, `src/logs/claude-code.ts`, `src/logs/codex.ts` (Create)

*   **Type / Scope**: Log readers.
*   **Proposed Changes**: The common event type (session, time, working directory, typed text) and finding logs for a repo under `~/.claude/projects/` and `~/.codex/sessions/`, or `MUNINN_LOG_ROOT` in tests. One reader per tool. A reader returns only text the engineer typed. It excludes tool output, agent text and the hook record type found by M3, skips sessions the logs mark as non-interactive if the spike finds a marker, and counts anything it does not recognise. Use the Memryzed read's notes on transcript line formats as a reference, checking the licence before copying any code.

#### 16. `src/privacy/redact.ts` (Create)

*   **Type / Scope**: Security.
*   **Proposed Changes**: Replaces values that match known key patterns and named assignments (AWS, GitHub, Slack, Stripe, OpenAI, Anthropic, Google, npm, JWTs, PEM keys, and `name=value` for names such as `token` and `password`). It uses no entropy guessing, because that can damage hashes in quotes. This is best effort. Everything written to the store passes through it.

#### 17. `src/embed/model.ts` (Create)

*   **Type / Scope**: Embeddings.
*   **Proposed Changes**: Loads the model on first use, following the spike's decision. If a download is needed, it asks first, stores the file under `MUNINN_HOME` and checks it against a SHA-256 value recorded in this file. If consent is refused, `learn` stops with a message saying what the model is for. Stores the model name in `meta`, so a later model change can start re-embedding.

#### 18. `src/learn/repeats.ts` (Create)

*   **Type / Scope**: Signal detection.
*   **Proposed Changes**: Splits typed text with `Intl.Segmenter` into sentences. Excludes fenced code, quoted lines, messages over 2,000 characters or 20 lines, sentences under 4 words, and exact matches in a short stop-list ("run the tests", "commit this", "continue"). Embeds the rest. A sentence joins the first cluster whose first member is at or above `similarityCutoff`, unless one contains a negation word (`not`, `never`, `don't`, `no`, `avoid`, `stop`) and the other does not. A cluster in at least `minSessions` sessions is a candidate. Corrections and failure-then-fix are deferred until the gate shows a gap.

#### 19. `src/learn/candidates.ts` (Create)

*   **Type / Scope**: Lesson creation.
*   **Proposed Changes**: Builds candidates with source `own_words`, using the cluster's longest sentence as the text, plus up to 3 redacted quotes. A candidate at or above the cutoff to an existing lesson adds evidence to it. A candidate near-identical to a rejected lesson (0.98 or above) is dropped, and one that is merely similar is kept. Ranks by distinct sessions, then most recent session.

#### 20. `src/commands/learn.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: `muninn learn` says what it found and will read, then re-reads all available logs for the repo. It shows the top `shownPerRun` candidates and asks keep, edit, reject or later. A kept lesson also asks whether to mark it always-on, and for an optional literal trigger. If neither is set, it warns that the lesson is searchable but will never be delivered automatically. It records `first_shown_at` and a baseline row per lesson and tool, using sessions with a repeat per 10 sessions, unless one exists. It builds the command index once Step 3 exists. It gives clear messages for too few sessions or unknown formats.

#### 21. `src/commands/lessons.ts`, `src/commands/export.ts`, `src/commands/purge.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: `add`, `list`, `show`, `approve`, `edit` (text, triggers, always-on, global), `retire`, `export` (all lessons to JSONL) and `purge`. `purge` removes muninn's hook entries if present, then the store, backups, model and settings. A lesson is repo-scoped unless the engineer marks it global.

#### 22. `test/fixtures/claude-code/2.1.317.jsonl`, `test/fixtures/codex/0.133.0.jsonl`, `test/fixtures/codex/0.155.0-alpha.2.6.jsonl`, `README.md` (Create)

*   **Type / Scope**: Test data and documentation.
*   **Proposed Changes**: Fixtures copy the record structure of real logs with invented content, including a hook-injected record and a pasted block. Add a new file when a format change is observed. The first README covers install from a tarball made with `npm pack`, first run, what is read and stored, and how to remove it.

#### 23. `test/logs.test.ts`, `test/repo.test.ts`, `test/redact.test.ts`, `test/learn.test.ts`, `test/lessons.test.ts`, `test/store.test.ts` (Create)

*   **Type / Scope**: Unit tests.
*   **Proposed Changes**:
    *   Readers against fixtures, including unknown structures, and injected hook text is not returned as typed text.
    *   Repo identity cases.
    *   Fixture secrets in each listed pattern do not reach the store.
    *   Paraphrased repeats form one candidate, pasted text does not count, "use X" and "never use X" stay separate, and a stop-listed sentence does not form a candidate.
    *   A repeat spread across separate `learn` runs is still found.
    *   Rejected lessons stay rejected, and a person's edit cannot be overwritten.
    *   Every transition in item 13, including that an unshown candidate stays `proposed`.
    *   A lesson with no route gets the warning. The baseline is not overwritten by a later `learn`.
    *   Migrations back up first. `add`, `edit`, `export` and `purge` do what item 21 says.
    *   Consent refusal stops `learn` with its message. A checksum mismatch is refused.

**Gate to Stage 2 (proposed):** before any tuning, set aside one of the author's 3 repos. Tune on two, then run on all three with no further changes. Count only lessons shown with `shownPerRun` at 10, pooled across repos, and count an edit as kept. Do not count a kept lesson that an instruction file already states.

| Result | Action |
|---|---|
| Finds the token lesson on the saved logs from item 5, at least half kept, at least 20 shown | Continue |
| Fewer than 20 shown | Inconclusive: the author decides whether to add `--all-repos` or a deferred signal, and logs why |
| Between 1 in 4 and 1 in 2 kept | One more tuning round on the two tuning repos. If still in this band, the author decides and logs why |
| Fewer than 1 in 4 kept after that round, or token lesson not found | Stop and rethink before building Stage 2 |

With about 20 lessons these rates are rough signals, not measurements. A few other engineers run the tarball on their own repo and report what they kept and whether they would run it again. Their feedback goes in the devlog and does not decide the gate.

### Step 2: Stage 2, delivery

Items here depend on the results in `docs/checks/client-live-tests.md`. A client or moment that failed its check is not built or promised for that client.

#### 24. `src/deliver/moments.ts` (Create)

*   **Type / Scope**: Delivery.
*   **Proposed Changes**: Selects lessons per event, for the current repo plus global lessons with status `live`. `SessionStart` with `startup`, `resume` or `clear` selects always-on lessons. `SessionStart` with `compact` selects always-on lessons and resets the once-per-session record. `UserPromptSubmit` selects lessons whose trigger matches the prompt.

#### 25. `src/deliver/match.ts`, `src/deliver/limits.ts` (Create)

*   **Type / Scope**: Delivery.
*   **Proposed Changes**: A trigger matches when its pattern appears in the prompt as a case-insensitive literal bounded by non-word characters. Several triggers on one lesson are alternatives. If more than `maxPerDelivery` lessons match, always-on lessons come first, then the longest pattern, then the newest. Limits are `tokensPerDelivery`, `tokensPerSession` and once per session, counted from `deliveries`. A lesson that would break a limit is logged with outcome `limit` and is not sent. Compaction resets the once-per-session record only, and tokens keep counting. A triggered lesson stays absent after compaction until a prompt matches again.

#### 26. `src/deliver/hook.ts`, `src/deliver/clients/claude-code.ts`, `src/deliver/clients/codex.ts`, `src/store/deliveries.ts` (Create)

*   **Type / Scope**: Delivery.
*   **Proposed Changes**: `muninn hook --client <name>` parses stdin with zod against the fixtures from item 7. If the input has Cursor's signal from test 16, it logs `unsupported_client` and returns nothing. Otherwise, it checks `paused`, selects, returns the shape from item 7 and writes one `deliveries` row per invocation or lesson, including `no_match`. An internal timer ends the run at `hookLimitMs` with outcome `timeout`. The client's hook timeout, set by `install`, is the hard stop if a native call blocks. If the store cannot be reached, it appends a line to `~/.muninn/hook-errors.log`. It exits 0 in every case.

#### 27. `src/commands/pause.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: `pause` creates `~/.muninn/paused`, and `resume` removes it.

#### 28. `src/commands/install.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: `install` and `uninstall`. Adds entries for `SessionStart` and `UserPromptSubmit` to `~/.claude/settings.json` and `~/.codex/hooks.json`, unless item 7 recorded a different location. The command is the absolute path to `muninn` plus `hook --client <name>`, so upgrades do not change it. It sets a hook timeout of 1 second, or the client's minimum. It appends to each event's list and never replaces entries. It backs up the file first and shows the changes. It prints the observed Codex trust step from test 15. It says hooks in `~/.claude/settings.json` may also run in Cursor, where muninn returns nothing. It lists any live lessons not yet reviewed. `uninstall` removes only muninn's entries and does not restore a backup. Use the Memryzed read's installer notes as a reference, including its overwrite bug.

#### 29. `src/commands/status.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: Per tool: last `learn`, last hook invocation and last sent lesson, unknown-format counts, and any `hook-errors.log` lines. It warns if the last invocation is older than the last known session in the logs, because a hook that never runs writes nothing, including an untrusted Codex hook. It warns if `learn` last ran over 21 days ago, because Claude Code removes logs after 30 days by default.

#### 30. `src/commands/report.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: `muninn report` re-reads logs since delivery started and prints, per lesson and tool, sessions with a repeat per 10 sessions, against the baseline, with raw counts. It lists every delivery for the author to judge. It computes nothing about relevance by itself. These numbers are reported, not gates: lessons were chosen because they repeated often, so some fall is expected anyway, and small counts swing widely.

#### 31. `test/deliver.test.ts`, `test/install.test.ts`, `test/concurrency.test.ts` (Create)

*   **Type / Scope**: Unit and integration tests.
*   **Proposed Changes**:
    *   Matching: case, word boundaries, several triggers, the priority order.
    *   Limits, and a skipped lesson logged with `limit`.
    *   Each event selects as item 24 says, including compaction, against the hook fixtures.
    *   Output has the recorded shape per client. Cursor's signal returns nothing and logs it. `paused` delivers nothing.
    *   The hook exits 0 within the limit on a locked store, a schema mismatch and malformed input, and writes to `hook-errors.log`. Hooks never migrate.
    *   Install keeps another tool's hook on the same event. Uninstall removes only muninn's entries and keeps later edits by other tools.
    *   Several processes write without losing rows.
    *   `status` warns on silence and on an overdue `learn`. `report` calculates rates against a fixed baseline.

**Gate after delivery (proposed):** for the next 5 token-script runs in each supported client, the engineer does not mention the token, and records whether the agent refreshed before starting. Compare with item 6.

| Result | Action |
|---|---|
| At least 4 of 5 in each supported client, and no worse than item 6 | Continue to Step 3 |
| Fewer than 4 of 5 in a client | One round of delivery fixes, then repeat. If still below, the author decides whether to narrow to the working client or fall back to exporting to instruction files, and logs why |
| Below item 6 | Stop and bring this to the author |

### Step 3: Stage 2, asking and the UI

#### 32. `README.md` (Modify)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Add what each tool and build supports, based on `client-live-tests.md`. Cursor is not supported, and imported hooks return nothing there. Add pausing, uninstalling, troubleshooting, and a line agents can be given about `muninn ask`.

#### 33. Reported measures (recorded in `docs/devlog.md`)

*   **Type / Scope**: Manual check.
*   **Proposed Changes**: Over 2 weeks of the author's use, record `muninn report`. The author judges every delivery as relevant or not, and correct or not, and says the check is self-graded. Starting points to compare with are a 70% drop and 90% relevant, which decide nothing by themselves. Record any missed firing the author notices, because the log cannot show those.

#### 34. `src/index/commands.ts` (Create)

*   **Type / Scope**: Command index.
*   **Proposed Changes**: Collects commands from `package.json` scripts, `Makefile` targets, and commands that exited 0 in logs, keeping source and date. `learn` calls it. It never runs them. CI files and README blocks are deferred.

#### 35. `src/store/search.ts` (Create)

*   **Type / Scope**: Search.
*   **Proposed Changes**: Combines FTS5 and embedding results by reciprocal rank fusion, using the Memryzed read as a reference. Returns `live` lessons only. Labels results by repo and source, applies the agent search setting and excluded repos, and logs cross-repo results to `search_log`.

#### 36. `src/commands/ask.ts`, `test/search.test.ts`, `test/ask.test.ts` (Create)

*   **Type / Scope**: CLI and tests.
*   **Proposed Changes**: `ask` answers from lessons and the command index, showing source and date. Output marks commands as data from that source, not instructions. It warns if a source's date is over 90 days old. Tests: labels and exclusions, `proposed` and `retired` lessons are not returned, the command index collects each source and ignores failed commands, and the cross-repo log is written.

#### 37. `src/ui/server.ts`, `src/ui/public/index.html`, `src/ui/public/app.js`, `src/ui/public/style.css`, `test/ui.test.ts` (Create)

*   **Type / Scope**: Local web UI.
*   **Proposed Changes**: `muninn ui` starts `node:http` on `127.0.0.1` at a free port and opens a URL with a random token. It checks the token and `Host` on every request. Routes: `GET /api/lessons`, `GET /api/lessons/:id`, `POST /api/lessons/:id` (edit text and triggers, approve, retire), `GET /api/deliveries`, `GET /api/status`. Plain HTML and minimal client-side JavaScript. Tests: refuses requests without the token or with the wrong `Host`, and escapes lesson text.

### Verification Plan

*   **Compilation/Build**: `pnpm build`
*   **Unit Tests**: `pnpm test`
*   **Typecheck**: `pnpm typecheck` (`tsc --noEmit`). No linter in the first version.
*   **Test Coverage Requirement**: No coverage number. Every item under "Proposed Changes" for test files must exist as a named test.
*   **E2E/Integration**: On a throwaway repo with `MUNINN_HOME` set, in Claude Code and the supported Codex builds. `muninn add` two lessons with made-up facts: one always-on, and one with a keyword trigger. Start a new session and ask for the first fact. Then use the keyword in a prompt and ask for the second fact. Force compaction and ask for the first fact again, on the turn recorded by test 6. Check that `status` and the UI show the deliveries. Separately, run `learn` with `MUNINN_LOG_ROOT` pointing at the fixtures, and keep a lesson from them.

--------------------------------------------------------------------------------

*Drafted with EGM*
````

# Appendix B: Edits outside lines 534-782

These keep lines 1-533 consistent with Appendix A. They are limited to what Appendix A makes false, and depend on D1-D8.

| Ref | Lines | Change |
|---|---|---|
| B-1 | 536 (handled in A), 148-150 | Replace with: "**Target numbers:** The gates in the Detailed Implementation Plan use proposed numbers with no evidence behind them yet. They are written down before the run they judge, and any change is logged with its reason." |
| B-2 | 110-118 | Replace "Repeats" with "sessions with a repeat per 10 sessions, per lesson and tool, compared with a baseline from before delivery". Replace "Wrong or irrelevant lessons" with "the share of delivered lessons the author judges relevant, and correct, reviewing all of them". Replace "Adoption" with "what a few other engineers report after running it". Add: "An agent refreshing the token unprompted, compared with an instruction line, is the deciding check. See the gates." Remove "The target numbers are open. See Open Questions." |
| B-3 | 92-99 | Line 92-93: unchanged. Lines 94-96: "A lesson made from the engineer's own repeated words goes live after it has been shown at review and not rejected, and is shown as not yet reviewed. This can be turned off." Lines 97-99: "**Delivery.** A live lesson reaches the agent at session start if marked always-on, or on a prompt containing a keyword the engineer chose. It returns after compaction where the tool allows it. Where a tool cannot do this, the README and `muninn status` say so." |
| B-4 | 188, 224-225, 325-326, 339-341, 237-241 | Remove the MCP server from the overview, text and diagram. L188 becomes "or their agent runs `muninn ask`". L326: "`muninn ask` loads the model each time, which the spike measures." Delete L339-341 and add to Future Improvements: "**MCP server:** add if `muninn ask` proves too slow or agents do not use it." Add to Alternatives Considered, Not chosen: an MCP server entry with those pros and cons |
| B-5 | 257-290 | Lines 257-268: keep only "Repeated instructions". Lines 270-271: remove "suggested triggers" and the operating-system note. Replace lines 277-281 with "**Triggers.** A lesson reaches agents automatically if the engineer marks it always-on or gives it a literal keyword. muninn does not generate triggers in the first version, because no example needs one and one proposed rule picked the wrong command. The spike measures whether richer triggers are worth a later design." Line 284: "limited to the top 10". Lines 287-288: "using known key patterns" and "best effort". Add to Alternatives Considered, Not chosen: generated triggers, with these reasons. Add corrections and failure-then-fix to Future Improvements |
| B-6 | 298-311 | Delete the `PostToolUse` row, and in the compaction row change to "Always-on lessons. Triggered lessons fire again on their next match". Line 305-308: "...This plan does not build it. The spike records the behaviour, and any refusal path gets its own design pass." Line 311: "each lesson once per session, reset by compaction". Line 312: "and logs that it did, if the store can be reached" |
| B-7 | 319-322, 215 | L319-320: "An `own_words` lesson goes live after being shown at review and not rejected, marked as not yet reviewed, and this can be turned off. Lessons never shown stay proposed." Remove "Agent saves count as `inferred`...". L215: "Own repeated words go live after being shown; nothing goes live unseen", status "Author, narrowed in review". Lines 94-96 are in B-3 |
| B-8 | 355-374 | Replace the table with a pointer to migration 001 in item 12, keeping the status list. L367-369: `purge` also removes hooks and the model. L373-374: `learn` · `add` · `ask` · `list` · `show` · `approve` · `edit` · `retire` · `report` · `ui` · `hook` · `install` · `uninstall` · `pause` / `resume` · `status` · `export` · `purge` |
| B-9 | 376-386 | Replace with: "The spike and baseline are in Step 0 of the Detailed Implementation Plan. They run before any product code, including the client checks that the delivery design depends on." |
| B-10 | 335-337, 502-504 | L335: "`package.json` scripts and Makefiles, plus commands seen to succeed in logs". L503-504: "Lesson text from logs is escaped in the UI, and only `live` lessons reach agents. Command results are labelled by source, as data, and the agent decides whether to use them." |
| B-11 | 219, 143, 521 | L219: status "Proposed in this draft. `agents.md` says Node 20+". L143: `docs/archive/original-build-spec.md` |
| B-12 | 250 | "Readers are tested against fixtures that copy real record structure with invented content, with one added per observed format change." |
