# Stage 8 Intermediate Zoom-Out: `docs/designs/muninn.md`

> **Elephant note on the count:** the reviewer's verdict line below says 1 Blocker, 10 Majors and 3 Nits. The findings as labelled add up to 1 Blocker (Z1), 11 Majors (Z2-Z12) and 2 Nits (Z13-Z14). The reviewer's text is otherwise unchanged.

**Verdict: revise before implementation.** I found 1 Blocker, 10 Majors and 3 Nits.

The objective is clear, so the context check passes. The later stages found real gaps, but many of their fixes would add machinery around parts that should be removed. Cutting trigger generation, `PostToolUse` delivery and the MCP server, and running a few client tests first, settles most of those findings at once.

## Focus 1: generated triggers

### Z1. Cut trigger generation from the first version
- **Severity:** Blocker (refines Stage 5 #1 and #3)
- **Affected Scope:** L154, L277-281, L302-303, L360, L649-653
- **Simplicity Rationale:**
  - Six proposals exist only because generation exists: C3 replay, C4 grammar and versioning, C5, N14, the trigger half of C2, and Comprehension #2-4.
  - No draft example needs a generated trigger, and its one example may pick the wrong command (Stage 5 #3).
  - The author's decision is "simple triggers" (L434-435). Generation is this draft's addition, so removing it reopens no decision.
  - **Replacement:**
    - A repeated setup lesson can be marked always-on at review.
    - The engineer can optionally type a keyword or command as a literal, case-insensitive match against the prompt.
    - Triggers need no generation step, regex or separate approval path. `muninn edit` changes them.
  - **Consequence for the author:** always-on delivery is close to an instruction line (L63-65). The first version may therefore not prove "moment of use" (L13, L97), and the design should say so.
  - Stage 5 #1's classification of the 20 instructions then decides whether richer triggers are worth a later design. The author should set that threshold before looking at the results.

### Z2. Remove `PostToolUse` delivery and path triggers
- **Severity:** Major (missed by all stages)
- **Affected Scope:** L97, L303, L360, L695
- **Simplicity Rationale:**
  - This row delivers after the action, which is the opposite of L97. No CUJ or example needs it.
  - It starts Node on every tool call, which is the main source of C10's latency worry, test 17 and C22's log growth.
  - It lets a poor match use up the once-per-session delivery (C3).
  - Claude Code also lists `PostToolUseFailure` as a separate event (client-capabilities L24-25), and the plan does not hook it. Failed calls may be missed, though this is unverified.
  - Removing the row leaves session start, compaction and prompt submission. The prompt hook runs once per prompt rather than once per tool call.

## Focus 2: proposed gate numbers

### Z3. Use four decision gates and report everything else
- **Severity:** Major (consolidates Stage 5 #6-8, Comprehension #7-10, C7-C9)
- **Affected Scope:** L110-118, L148-150, L586-587, L680-682, L775-777
- **Simplicity Rationale:** The earlier stages together ask for denominators, pooling rules, sample protocols, judges, normalisation and a central number table. That is too much process for one user. The numbers also cannot carry the precision implied:
  - **Keep rate:** if 15 lessons were shown and half were kept, the 95% interval is about 27-73%, which nearly reaches the 1-in-4 stop line. The 15 is my assumption.
  - **Relevance:** 18 of 20 relevant gives about 70-97%.
  - **Repeat drop:** from a baseline of 5 repeats, 1 repeat passes a 70% drop and 2 repeats fail it.
  - **Selection bias (missed by all stages):** lessons are chosen because they were repeated often, so counts may fall even with no effect. Project phases also end. A 70% drop on that set is weak evidence.

| Gate | Pass | Otherwise |
|---|---|---|
| Step 0: instruction line | The line does not stop the token repeat in a short trial | The author decides whether to narrow scope, before any build |
| Step 0: stack | libSQL or its fallback works, and a full hook run fits the limit | Switch the store, or cut the slow hook |
| Stage 1: learner | Finds the token lesson, and about half of a fixed top-N is kept on a held-out repo | Under 1 in 4: stop. In between: one tuning round, then the author decides and logs why |
| Stage 2: delivery | In the next N token-script runs, the agent refreshes without being told, in each supported client, and beats the instruction line | Fix delivery, or cut back to export |

- The 70% and 90% figures, keep rate and return use become reported measures, not gates.
- Outside engineers give qualitative feedback (Stage 5 #6).
- Numbers are written down before measuring, and any change is logged (C7).
- Drop the independent judge in C9. The author can say the check is self-graded.
- Review all deliveries while the volume is low, rather than designing a sample.

### Z4. The proposed instruction-file trial can destroy the evidence
- **Severity:** Major (missed by all stages, and caused by Stage 5 #2 and C20)
- **Affected Scope:** L180, L259-260, L285, L289, L680
- **Simplicity Rationale:**
  - If the reminders stop during the trial, the old reminders can age out of the 30-day default retention (client-capabilities L64).
  - The learner may then lack 3 sessions to find the token lesson, which L680 requires. The baseline at L285 would also shrink.
  - **Fix:** before the trial, record the baseline, keep a private copy of that repo's logs outside version control, and raise `cleanupPeriodDays` on the author's machine.
  - Replace Stage 5's throwaway repeat counter with the direct check on token-script runs.
  - A separate auto-memory arm is probably unnecessary. Leave it at its default in both periods and record that it was on. Whether it was active for this repo is not established (client-capabilities L68 only reports 4 memory directories on the machine).
  - Keep C20's short alternatives entry for built-in memory.

## Focus 3: Stage 2 detail that depends on untested client checks

### Z5. Test first, then write the Stage 2 detail
- **Severity:** Major (consolidates Stage 5 #9, Comprehension #12-13, C11, C13, C15)
- **Affected Scope:** L122, L294-311, L325-326, L339-341, L386, L686-736
- **Simplicity Rationale:**
  - L690 already admits the plan will change. Items 24-27 and 31 specify work whose inputs are unknown.
  - L122 requires a design pass for later stages. Apply the same rule to Stage 2 delivery.
  - Do not add per-row status columns and per-claim version notes (C11, C13). They document uncertainty that a day of testing could remove.
  - For now, a single caveat above the L298 table is enough.

| Tests from `client-capabilities.md` | Disposition |
|---|---|
| New matrix: each kept hook, Claude Code plus the Codex build in use, made-up fact | Run first |
| 3 (two clients only), 6, 15, 16, 17 | Run in Step 0 |
| 5 | Run only as an add-on to the matrix, and record a limitation rather than change the design |
| 9, 10 | Only if MCP stays (see Z6) |
| 1, 2, 7, 8, 11, 19 | Defer with Cursor |
| 4 | Drop while the limit is 300 tokens |
| 12, 13, 14 | Drop or defer, because muninn does not spawn clients |
| 18 | Covered by unknown-structure counts until a release |

- Stage 5 #13 is right to cut the `blocking` flag, but test 3 should stay. It is the one cheap test of whether a call can be intercepted before it runs. C17's questions wait for that result.
- State the minimum supported Codex build once, after testing. 180 of 185 threads are on the desktop build (client-capabilities L15), so that is the first target.

### Z6. `muninn ask` may replace the MCP server for the first version
- **Severity:** Major (missed by all stages; Stage 5 only deferred MCP)
- **Affected Scope:** L188, L224-225, L325-326, L339-341, L732-736
- **Simplicity Rationale:**
  - The MCP server is not in the decisions table (L210-219), and `muninn ask` already exists.
  - An agent running `muninn ask` from the shell gets its current directory directly.
  - That removes Stage 5 #10, C12, tests 9-10, the model-holding claim, and the `save_lesson` risk.
  - **Costs:**
    - Model load on every call (L326), which spike item 2 can measure.
    - Agents must be told the command exists. One always-on line can do that.
    - Shell approval prompts and sandbox write limits are unverified. They could affect logging from `muninn ask`.
  - Add MCP back if those costs are measured and prove too high.
  - If MCP stays, keep only C12's fail-closed rule.

### Z7. Replace restore budgets with a simpler rule
- **Severity:** Major (replaces Stage 5 #12, C16 and part of Comprehension #20)
- **Affected Scope:** L98, L301, L310-311, L706
- **Simplicity Rationale:**
  - Do not add a separate restore budget, priority order or time-sensitive lesson class.
  - Compaction delivers always-on lessons and resets the once-per-session record, and triggered lessons fire again on their next match.
  - This also removes the "read back what the session received" function in item 26.
  - The cost is that a triggered lesson stays absent until a prompt matches again. Measure that before adding anything.
  - Handling the 8-hour token expiry inside long sessions (C16) waits for the Stage 2 direct check.

## Other points the earlier stages missed

### Z8. Incremental scanning cannot detect repeats across runs
- **Severity:** Major
- **Affected Scope:** L259-260, L288, L361, L364, L617
- **Simplicity Rationale:**
  - Reruns read only new content, and only evidence quotes tied to lessons are stored.
  - A sentence seen once in each of three scan periods has no stored earlier copy, so it never reaches 3 sessions.
  - The simplest fix is to re-read all available logs on each `learn` and delete the offsets from `scan_state`, keeping any format counts wherever they are reported.
  - If that proves slow, the fix is to cache sentence embeddings. That stores data for every sentence, so it needs a privacy decision against L288.
  - **This rejects C18's hook-based scan.** Embedding needs the model, which hooks do not hold (L154, L155), and the 500 ms limit applies. Use manual `learn`, with a warning in `status` (Stage 5 #15).

### Z9. There is no way to add a lesson by hand
- **Severity:** Major
- **Affected Scope:** L373-374, L664, L735
- **Simplicity Rationale:**
  - The token lesson is already known, yet it can only arrive through 3 sessions of log evidence, `import`, or an agent's `save_lesson`.
  - `muninn add` is one small command, and a hand-added lesson goes through the same review, delivery and retire paths.
  - It lets Stage 2 run even when the learner has not produced a lesson, and it replaces `import` for the first version.

### Z10. Delivered text may be learned from or counted as a repeat
- **Severity:** Major
- **Affected Scope:** L111, L259-261, L319, L623-624
- **Simplicity Rationale:**
  - Hook context is recorded in Claude Code transcripts (client-capabilities L62). How Codex records it is unknown.
  - If a reader treats it as typed text, a lesson confirms itself and the Repeats measure is corrupted.
  - The agent's repeat of the lesson should also not count.
  - C2 mentions injected text only as a safety concern.
  - Add one check to the matrix: find the made-up fact in the transcript and see which record type holds it. Fall back to `proposed` if the origin is uncertain.

### Z11. Stage 5's auto-live fix reopens an author decision, and sentence fragments make the risk worse
- **Severity:** Major (corrects Stage 5 #5; narrows C2)
- **Affected Scope:** L94-96, L215, L272, L284, L319, L437-442
- **Simplicity Rationale:**
  - "Nothing goes live until kept" conflicts with an author decision (L215, L442). It should be put to the author, not assumed.
  - **Missed by all stages:** L272 uses a split sentence as the lesson text. "Refresh the token first" does not say which token or how, and "use that one instead" means nothing out of context.
  - With no LLM to rewrite it, the lesson may fail even if it is repeated and correct.
  - **Compatible rule to offer the author:** an `own_words` lesson goes live only after being shown at review and not rejected. Unshown lessons stay `proposed`, and lessons of uncertain origin stay `proposed`.
  - That rule replaces C2's per-client detection specification. Whether logs mark pasted text stays unverified, so the spike should check it on real logs.

### Z12. The spike omits the riskiest install, and the fallback has no driver
- **Severity:** Major
- **Affected Scope:** L212, L378-380, L554, L566, L586
- **Simplicity Rationale:**
  - Clean-install checks cover libSQL only. `@huggingface/transformers` is an equally large dependency, and item 4 measures only its size and speed. Its runtime's install burden is my concern, not an established fact.
  - "Plain SQLite" names no package. Node's built-in `node:sqlite` could remove a dependency, but I have not verified its status or FTS5 support on the target Node version. The spike should test it, with blob vectors as in Stage 5 #8.

### Z13. Readers can shrink if signals are cut, and fixtures should not track versions
- **Severity:** Nit
- **Affected Scope:** L246-250, L670
- **Simplicity Rationale:**
  - With repeats only and no generated triggers, Stage 1 readers need only session, time, directory and typed text. That shrinks exposure to unstable formats.
  - Tool-output parsing comes back with the command index.
  - L250 says "saved sample logs" while L670 says "hand-written". Hand-written logs test assumptions, not real formats.
  - "One per client version seen" does not scale. Use one fixture per observed format change, derived from real structure with no real content.

### Z14. Smaller gaps
- **Severity:** Nit
- **Affected Scope:** L16, L163, L219, L358, L365, L566
- **Simplicity Rationale:**
  - The chosen model is English-only, while L16 says "any engineer". State the limit.
  - The model name is stored twice (L358, L365). Keep one copy.
  - No plan item publishes the package, so outside runs can use an `npm pack` tarball.

## Disposition of Comprehension and Critic proposals

| Proposal | Decision | What remains |
|---|---|---|
| C1, Comprehension #1 | Replace | Z1, plus a trace of both lessons after the Step 0 tests |
| C2, Comprehension #15 | Replace | Z11 and one rule for corrections: they are `inferred` unless repeated |
| C3 replay, C4 grammar and versioning, Comprehension #2-4, N14 | Drop | Dissolved by Z1 |
| C5, Comprehension #5, N6 | Keep small | Set always-on at review, warn when a lesson has no route, default to repo scope, global only by explicit choice |
| C6 | Combine | One alternatives entry recording that generation was deferred |
| C7, C8, C9, Comprehension #7-10 | Combine | Z3 |
| Comprehension #11 | Drop | The number table adds nothing beyond Z3 |
| C10 | Keep most | Test a full hook under concurrent `learn`, and ban `npx` in hook commands. Drop the side-file unless the test loses writes, and then use a single log file rather than two destinations |
| C11, Comprehension #12-13 | Replace | Z5 |
| C12 | Replace | Z6, or fail-closed if MCP stays |
| C13, Comprehension #14 | Keep small | Absolute command path, one row per hook invocation, `status` shows last invocation and flags silence. Drop per-claim version notes and parsing client logs for comparison |
| C14 | Keep small | Identify Cursor from the hook's input or transcript path, then log and return nothing. A `--client` flag alone will not work, because the imported command is identical |
| C15 | Keep | One definition: "delivered" means sent by the hook |
| C16, Comprehension #20 | Replace | Z7 |
| C17 | Combine | Cut the flag and keep test 3 |
| C18, Comprehension #16 | Replace | Z8 and manual scans |
| C19 | Keep small | Agents get only `live` lessons, and commands are labelled as data. No approval step for commands, because the agent can read the same README itself. Fix L504 |
| C20 | Keep small | Correct L50 and L395, add the alternatives entry, and run the trial (Z4) |
| C21, C22 | Mostly drop | For one user, growth and retention limits are speculative. Keep first-run limits and any strengthening of the L419-420 reasoning the author wants. If the unseen feature-spec standard binds, the Elephant decides |
| C23 | Replace | Remove the OS note (L271), because lessons do not move between machines in this design. Store the baseline in `meta` or the gate log, not a new table |
| N1, N3 | Keep | Wording only |
| N2 | Combine with Stage 5 #14 | Regex rules only, unless evidence supports entropy checks |
| N4 | Replace | Cut `import` and add `add` |
| N5 | Keep half | State what happens if consent is refused. Its integrity point is already covered at L641-642, outside the Critic's line range |
| N7, N11 | Keep | Small accuracy edits |
| N10 | Keep | One line: only near-identical rejected text is dropped automatically |
| N8, N9, N13, Comprehension #18 | Drop for now | Editing passes after the structure settles |
| N12, Comprehension #17, #19 | Keep lightly | Define terms at first use |

**Stage 5 items changed by this review**
- #1 and #3 are absorbed by Z1.
- #2 is refined by Z4.
- #5 is corrected by Z11.
- #6-8 are consolidated by Z3.
- #9 is refined by Z5.
- #10 may dissolve under Z6.
- #12 is replaced by Z7.
- #13 is refined by Z5 and Z13.

The rest stand as written, except that #14 no longer needs to block Step 0.

**Critic unverified table:** `docs/spike.md` does not exist yet, and item 7 creates it, so L508 is a planned output rather than a false claim.

## Keep Step 0 small

Taken together, the proposals would make Step 0 larger than a spike:

- Six existing spike items.
- Two baseline arms and a repeat counter.
- A client matrix and trigger replay.
- Instruction classification and a competitor read.

Reduce it to this order:

1. Snapshot logs and record the baseline (Z4).
2. Run the instruction-line trial on the token case.
3. Run the client matrix with one throwaway hook, which also answers Z10.
4. Keep one private file of about 20 real instructions. Use it for embeddings versus keywords, always-on versus specific-moment, learner recall and sentence usability (Z11). That removes the need for separate datasets.
5. Run the libSQL, fallback and full-hook checks, including the transformers install.

Time-box the OpenMemory and agentmemory read (Stage 5 #14), and do not let it block these steps.

## Review limits

- The repo has no source code, so there is nothing to reuse. A search of the repo found only documents and sample git hooks.
- I did not read `agents.md`, `concepts_brief.md`, `docs/implementation-plan.md` or `docs/devlog.md`, because they were not supplied. "Author" attributions come from the target.
- No `README.md` or `context.md` exists to check alignment against.
- `feature-spec-standard` was not supplied, so its compliance is not judged here.
- Client and Memryzed claims rest only on `docs/checks/`, which reports no live client test and no Memryzed run.
- These remain unverified:
  - How the logs mark pasted text.
  - How Codex records hook text.
  - Whether hooks run in the desktop build.
  - Whether `muninn ask` works under agent shell and sandbox rules.
  - The `node:sqlite` and transformers install points.
- The intervals in Z3 are illustrative calculations, using my own sample sizes.
