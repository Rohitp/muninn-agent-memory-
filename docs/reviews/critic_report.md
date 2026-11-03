# Stage 7 Critic Report: `docs/designs/muninn.md`, lines 1-533

**Round 1 result:** 2 Blockers, 21 Majors and 14 Nits after merging duplicates. The reviewers raised 81 findings in total. This round is not clean.

| Reviewer | Standard | Status | Blocker | Major | Nit |
|---|---|---|---|---|---|
| `egm-design` | feature-spec-standard | completed | 2 | 13 | 9 |
| `egm-structural` | feature-spec-standard | completed | 1 | 22 | 7 |
| `egm-style` | none | completed | 0 | 16 | 11 |

**Scope limits**
- **Gate numbers were only partly reviewed.** All three reviewers worked on lines 1-533, and line 148 places the gate values in the Detailed Implementation Plan. They judged how this range describes the numbers, not the values. Stage 9 reviews that section, and Stages 5 and 6 read it.
- **Client and Memryzed behaviour rests only on `docs/checks/`.** `client-capabilities.md` says nothing in it was tested live, and `memryzed-read.md` says it comes from a static read. No reviewer looked elsewhere.
- **Reviewer inferences are not confirmed.** They are marked where the reviewers marked them. The Elephant has not yet evaluated these findings or checked their line references.

**Finding ids** use `<reviewer>-<round>-<n>`. A merged finding takes the highest severity any reviewer gave it, and any disagreement is noted.

## Blockers

### C1. The token lesson has no reliable route to the agent before the run
- **Scope:** lines 92-93, 97, 180-183, 277-281, 299-308
- **Sources:** `design-1-1`, `structural-1-1`, `style-1-3` (style rated it Major)
- **Finding:**
  - The example trigger is the script's command. At `UserPromptSubmit`, it matches only if the prompt contains a keyword or that command. "Kick off the overnight run" may not.
  - At `PostToolUse`, it fires after the call. For a foreground script that could be hours later, after the failures described at lines 37-38.
  - `PreToolUse` is excluded until tested (lines 305-308), and `client-capabilities.md` line 25 says its text arrives with the tool result on Claude Code.
  - Always-on is the remaining route. It is undefined (nothing says who sets it), and it amounts to an instruction-file line, which is the baseline muninn must beat.
  - Both clients document prompt-time context, so "where the tool allows it" blames the client for what may be a limit of the trigger design.
- **Suggested:** trace the token and `caffeinate` lessons through each client, from evidence to generated trigger to delivery moment. Make always-on a defined review step with a default for setup lessons. Weaken line 97 if only prompt-time delivery can arrive first.

### C2. The auto-live path contradicts itself and its inputs are not safe
- **Scope:** lines 82-83, 92-96, 180, 259-261, 272, 277-280, 283-284, 319-320, 360, 367, 504
- **Sources:** `design-1-2`, `structural-1-2`, `structural-1-17`, `structural-1-23`, `style-1-2`, `style-1-25` (style-1-25 rated the status wording a Nit)
- **Finding:**
  - Lines 82 and 92 have the engineer keep each lesson. Lines 94 and 319 send `own_words` lessons live without review, and CUJ 2 has no keep step.
  - Line 284 shows only the strongest few, and nothing says whether the rest go live or what happens to lessons still `proposed` when Stage 2 is installed. Engineers could get lessons delivered that they never saw.
  - A keep rate (line 110) has no clear meaning for lessons that go live without a decision. "Kept" also has no matching status value, and line 23 says "delivers kept lessons" while line 97 delivers live ones.
  - Triggers are inferred, and line 96 says anything inferred waits. The `triggers` table (line 360) has no approval status or reviewed date.
  - Line 261 excludes pasted blocks without saying how they are detected, and the check files don't establish that logs distinguish pasted from typed text. A misclassified paste, or a scripted `claude -p` prompt repeated in 3 sessions (`client-capabilities.md` line 65, test 13), could go live as the engineer's own words. `memryzed-read.md` line 172 shows verbatim stored text is the relevant injection risk.
  - A situational instruction such as "don't push yet", repeated in 3 sessions, would go live in every later session, the harm named at line 67.
- **Suggested:** settle one rule for what goes live and when. Treat generated triggers as inferred, or define a narrow class that is safe without review. Specify pasted, scripted and injected text detection per client, test it on real logs, and fall back to `proposed` when origin is uncertain.

## Major: generated triggers

### C3. Nothing tests whether generated triggers work
- **Scope:** lines 110-116, 154-155, 277-281, 310-311, 315, 376-386
- **Sources:** `design-1-3`, `structural-1-4`, `style-1-1`, `style-1-5`
- **Finding:**
  - "It proposes triggers" and "the intelligence is applied here" read as settled, but spike items 5 and 6 test instruction recognition and search shortlists, not whether a trigger fires at the right moment. `memryzed-read.md` calls the matcher "the hard part" (line 275) and the riskiest assumption (line 281).
  - Line 114 samples delivered lessons, so misses are invisible, and line 315 doesn't say whether "no match" is logged. Lines 154-155 ask how many cases are missed, but no activity answers that.
  - A false match on an early prompt uses up the once-per-session delivery, so the lesson may not fire when the script runs.
  - Line 277 says hooks "cannot" search by meaning, while lines 155 and 432-435 show this follows from choosing no background program.
- **Suggested:** add a spike item that replays held-out real sessions and reports whether each trigger fired before the relevant action, its false-fire rate and its miss rate. State generation as an untested proposal until then.

### C4. Trigger generation and matching are not specified, and triggers can't be corrected
- **Scope:** lines 279, 296, 302-303, 343-344, 359-360
- **Sources:** `design-1-3`, `structural-1-3`
- **Finding:**
  - `pattern` has no defined syntax, normalisation of arguments and paths, handling of compound commands and worktrees, stopwords, or minimum specificity.
  - "Commands run next" could as easily pick the refresh command as the script it protects.
  - If patterns can be regular expressions built from log text, match time affects the 500 ms limit.
  - The UI and CUJ 4 describe editing lessons, not triggers, and `lesson_versions` records text only.
- **Suggested:** define the trigger grammar and add trigger editing and versioning.

### C5. A live lesson can never be delivered
- **Scope:** lines 97, 280-281, 283
- **Sources:** `style-1-4`, `design-1-1`
- **Finding:** A lesson with no trigger and no always-on mark is only searchable, so line 97 needs an exception. Nothing says who sets always-on or which command does it, and the review at line 283 offers only keep, edit or reject.

### C6. No alternative is evaluated for the trigger approach
- **Scope:** lines 277-281, 388-496
- **Source:** `structural-1-5`
- **Finding:** Hand-written triggers and always-on lessons with a budget have no entries. The only related mention is that an LLM "could write better triggers" (line 478). This misses the standard's Alternatives Rule for the design's most important mechanism.

## Major: gate numbers

### C7. Targets are deferred twice and can move after the results
- **Scope:** lines 60-66, 108-118, 148-150, 268, 310, 381
- **Sources:** `design-1-4`, `structural-1-6`, `style-1-7`
- **Finding:**
  - Line 118 points to Open Questions, and lines 148-150 point to a later section, so this range has no target for any success measure.
  - The same numbers are called target numbers, stage gates, proposed numbers, thresholds, starting values and limits.
  - Line 149 revises the numbers once the spike and first real runs report, which are the results being judged. "Should be confirmed in review" names no owner.
  - No outcome is stated for a failed gate, and the main risks have no stop condition, including "instruction files may be enough".
- **Suggested:** record first values before the spike, log any revision with its reason, and define the stop or narrow outcome for each gate.

### C8. The spike "must prove" things but has no pass criteria
- **Scope:** lines 78, 212-213, 376-384, 427-428
- **Sources:** `design-1-4`, `structural-1-7`, `style-1-9`
- **Finding:** Only libSQL has a stated fallback. Items 2 and 4-6 are measurements with no threshold or consequence. Keyword-only search is already rejected, so a poor embedding result has no defined effect. "If the spike fails" and "whichever the spike shows is practical" have no threshold.

### C9. Some success measures can't be calculated
- **Scope:** lines 110-116, 285
- **Sources:** `design-1-4`, `style-1-10`
- **Finding:**
  - The comparison with instruction files has no method, and one engineer can't easily measure both at once.
  - The baseline window is undefined, though Claude Code's default retention is 30 days.
  - Line 114 has no sample size or judge, and the author grades their own product.
  - Line 116 has no time window.
  - "Wrong or irrelevant lessons" sits above a share judged *relevant*, so the measure points the opposite way.

### C10. The hook time limit is under-tested and threatens the delivery log
- **Scope:** lines 105-106, 252, 303, 310-312, 315-317, 351-353, 381, 505, 507-508
- **Sources:** `design-1-10`, `structural-1-8`, `style-1-8`
- **Finding:**
  - Spike item 3 covers Node start-up and opening the store. It omits repo resolution, matching, the log write and lock waits.
  - A hook that times out on a lock held by `muninn learn` may not be able to record the timeout, so line 315's "every delivery, skip and timeout" isn't guaranteed (reviewer inference).
  - The 500 ms limit reads as fixed while the 100 ms p95 aim has no test or evidence. "Never block the agent" conflicts with a hook that can run for 500 ms. Test 17 is open.
  - Line 505 doesn't rule out `npx` in hook commands, and line 303 starts a process on every tool call.
- **Suggested:** spike a full hook run under concurrent writes, add a side-file fallback for log writes, and prohibit `npx` in hook commands.

## Major: Stage 2 detail resting on untested client checks

### C11. The delivery table reads as confirmed, and tests have no decision rules
- **Scope:** lines 97-99, 294-308, 310-312, 386, 522
- **Sources:** `design-1-5`, `structural-1-9`, `structural-1-10`, `style-1-11`
- **Finding:** Every row has the same certainty, though nothing was tested live and evidence differs by client. Line 386 is the only general caveat, and it maps no test to a row. It also places the tests after Stage 1, although Stage 1's trigger work assumes their answers. "Muninn says so" (line 99) has no mechanism.

| Design detail | Evidence state | Gap in the design |
|---|---|---|
| Codex restore after compaction (line 301) | `client-capabilities.md` line 28: documented matcher, runs on a later turn, not seen delivering. Test 6 | Text may arrive after the first post-compaction action, and no meaning is given for late or absent restore |
| Context on `UserPromptSubmit` and `PostToolUse` | Line 3: nothing tested live. Claude Code hooks page and all OpenAI pages read through a summariser (line 55) | CUJ promises assume delivery works |
| Subagent delivery | Test 5 is open | Never mentioned, though a subagent could run the long script |
| Hooks in headless runs | Lines 36 and 65, tests 12-14 | Not addressed, so muninn could inject into scripted runs |
| Output shape | Line 74: Codex requires `hookSpecificOutput`. Line 75 reports unclear failures | Line 296 only says "returns text" |
| Pre-call refusal (lines 305-308) | Test 3 is open | No plan if refusal does not work |

- **Suggested:** run tests 3, 5, 6, 9 and 15 before Stage 1 code, each with a throwaway hook and a made-up fact. Add a per-client status and test number to each row, and record what changes in the design if a test fails.

### C12. MCP lifetime and project detection are stated too firmly
- **Scope:** lines 223-225, 325-326, 330-333, 339-341
- **Sources:** `design-1-8`, `structural-1-11`, `style-1-12`, `style-1-13`
- **Finding:**
  - "Lives as long as its agent session" and "only an agent's first search pays the load cost" are stated as fact. Row 5c (line 34) lists process lifetime as unknown for all clients, including whether the Codex desktop app shares a server across projects. Test 9 has not been run.
  - Line 341 flags only the desktop app, yet the CLI evidence is source-only with no live server seen (row 5a), and row 5b doesn't establish that `CLAUDE_PROJECT_DIR` follows a `cd` or worktree change (test 10).
  - The desktop app is the main case here (180 of 185 threads), and its main process runs at `/` (line 121).
  - Wrong detection could return another repo's results, which matters most when logs mix employers. `save_lesson` could also file a lesson against the wrong repo.
- **Suggested:** fail closed when the project can't be resolved, resolve it per call where possible, and don't assume one server per session until test 9 reports.

### C13. Codex versions and hook trust are unaddressed, and a hook that never runs looks like no match
- **Scope:** lines 93, 200-204, 217, 294-296, 313, 315, 341, 505
- **Sources:** `design-1-7`, `structural-1-12`, `style-1-14`, `style-1-15`
- **Finding:**
  - "Codex" hides a split between CLI 0.133.0, the app's 0.155 build and newer documentation (`client-capabilities.md` lines 15, 73). No minimum or target version is stated.
  - Line 295 assumes a user experience, but the check documents only a requirement. Trust is tied to the hook's hash, so a changed hook needs review again (line 72). Whether upgrades or pinned `npx` versions change the hash is reviewer inference.
  - Test 15 asks whether untrusted hooks fail silently. A hook that doesn't run writes nothing, so `muninn status` can't separate that from no match, and CUJ 5's promise isn't supported.
  - Line 313 can't be enforced by code that never starts, for example when `muninn` or Node 22 is missing from the hook's `PATH`.
- **Suggested:** name the versions each claim covers, log each hook invocation as a heartbeat, have `status` compare heartbeats with recent sessions in client logs, and use an absolute command path at install.

### C14. Hooks may run in Cursor, which the design excludes
- **Scope:** lines 137, 158-159, 217, 294-296, 315, 529
- **Sources:** `design-1-6`, `structural-1-13`, `style-1-17`
- **Finding:** Cursor imports Claude Code hooks by default, reading `.claude/settings.local.json`, `.claude/settings.json` and `~/.claude/settings.json`, and maps the events muninn uses (`client-capabilities.md` lines 24, 84). The design doesn't say which settings file install writes to or how `muninn hook` identifies its client. Effects could include wrong `tool` values in the log, misapplied limits and delivery in an unsupported client. Test 16 hasn't run.
- **Suggested:** detect the calling client, define the behaviour (such as logging and returning nothing for Cursor), and add test 16 to the pre-Stage 2 set.

### C15. "Delivery" and "receives" exceed the evidence
- **Scope:** lines 103, 105, 182-183, 315-317
- **Source:** `style-1-16`
- **Finding:** Line 317 correctly says the log proves only what muninn sent, but CUJ 2 says "the agent receives" the lesson and the UI shows what was "delivered". The check file requires a made-up fact test to prove delivery. Define a logged delivery as "sent by the hook" and use that meaning throughout.

### C16. Delivery limits work against compaction recovery
- **Scope:** lines 98, 300-301, 310-311, 510
- **Sources:** `design-1-9`, `structural-1-15`
- **Finding:**
  - Restoring always-on lessons plus everything delivered can exceed the 3-lesson and 300-token limits, with no priority order.
  - The 1,000-token session cap may be used up before compaction, and nothing says whether compaction resets it.
  - "Once after compaction" doesn't cover a second compaction, and earlier hook text is summarised away (`client-capabilities.md` line 28).
  - "Once per session" could use up a lesson in the parent while a subagent runs the script (test 5).
  - A token that expires every 8 hours (line 35) may need a reminder within one long session.
- **Suggested:** give compaction restore its own budget and priority, allow one re-delivery per compaction, and state how time-sensitive lessons behave.

### C17. The `blocking` flag contradicts the deferral and the performance requirement
- **Scope:** lines 141, 305-308, 313, 358, 507
- **Sources:** `structural-1-14`, `style-1-18` (Nit), `design-1-18` (Nit)
- **Finding:** The schema includes the flag for deferred behaviour, and "never block the agent" has no exception for refusing a call. Test 3 covers all three clients, but the text discusses only Claude Code, and its wording rests on a page read through a summariser. Nothing says how a refusal clears once the token has been refreshed. "Does not use it" has an unclear antecedent.

## Major: other

### C18. Nothing keeps logs scanned or the command index built after the first run
- **Scope:** lines 111-113, 187, 202-204, 285, 289, 296, 330, 335-337, 364, 373
- **Sources:** `design-1-11`, `structural-1-18`, `structural-1-20`
- **Finding:** `muninn learn` is the only scan named. Evidence can disappear with Claude Code's 30-day default retention (`client-capabilities.md` lines 29, 64), and Codex retention is unknown. The Repeats measure needs later scans and the baseline may be thin. CUJ 3 assumes Repo B "has been scanned" and CUJ 5 reports "last capture", but neither step is described.
- **Suggested:** define when scanning happens, such as an incremental scan from a session hook, and check its time cost. State the baseline's minimum history.

### C19. Untrusted commands and lesson results reach agents without approval
- **Scope:** lines 96, 324-328, 335-339, 503-504
- **Source:** `design-1-12`
- **Finding:** Line 504 says anything not typed by the engineer waits for approval, but the command index has no approval step. README code blocks, CI files and logged commands reach agents through `find_command`, and a hostile README could supply one. "Muninn never runs the command" doesn't help, because the agent can. Search doesn't say whether `proposed` lessons are returned or how results are marked as untrusted.
- **Suggested:** return only `live` lessons to agents, label command results by source and trust as data, and correct line 504.

### C20. The instruction-file argument conflicts with the evidence, and the baseline omits auto memory
- **Scope:** lines 49-56, 63-65, 111-113, 388-498, 530
- **Sources:** `design-1-13`, `structural-1-22`, `style-1-19` (Nit)
- **Finding:**
  - Lines 50 and 395 treat instruction files as separate, but Claude Code reads `AGENTS.md` when no `CLAUDE.md` exists, and Codex reads `AGENTS.md` (`client-capabilities.md` line 37). One file can serve both, which strengthens the risk at line 63.
  - Claude Code's auto memory is on by default, saves corrections, loads each session and is re-injected after compaction (lines 37, 68). It has no alternatives entry and isn't in the baseline, so muninn could get credit for repeats it would have stopped anyway.
  - OpenMemory and agentmemory are unassessed, and that work sits under Future Improvements despite being a release prerequisite.
- **Suggested:** correct the claim, add built-in memory as an alternative and baseline, and run a cheap instruction-file trial on the token case before Stage 2.

### C21. Alternatives don't fully meet the Alternatives Rule
- **Scope:** lines 396, 404, 411, 419-421, 427-428, 434, 442, 448, 457
- **Sources:** `design-1-14`, `structural-1-21`
- **Finding:** Each line says "Rejected by author" with no linked issue, discussion or PR. The author may count as the maintainer, which the author should confirm. Weak on their merits regardless:
  - **Line 411:** a decision, not a trade-off.
  - **Lines 419-420:** the reason doesn't separate the options, because a rebuildable index could hold vectors.
  - **Line 427:** rests on an advantage the same line says is unmeasured.
  - **Line 442:** gives a choice with no reason.
  - **Line 457:** doesn't weigh Claude Code alone as the faster test.

### C22. There is no complete risk section, and scalability limits are missing
- **Scope:** lines 58-68, 351-369, 500-515
- **Sources:** `design-1-15`, `structural-1-16`
- **Finding:** Risks sit under The Problem with no mitigations. Missing: growth limits and retention for `deliveries` and the store, search cost as repos accumulate (`memryzed-read.md` line 193), how vector search works on the plain SQLite fallback (line 212), first-run limits for large histories, and mitigations for "demand is unknown" and "instruction files may be enough".

### C23. The data model doesn't match the prose
- **Scope:** lines 271, 285, 355-365
- **Source:** `structural-1-19`
- **Finding:** No table holds the baseline repeat counts, which the Repeats measure needs. No field holds the operating-system note, which a lesson such as `caffeinate` needs.

## Nits

| Id | Scope | Finding | Sources |
|---|---|---|---|
| N1 | 18, 85, 287-290, 502-503 | "Nothing leaves the machine" should be limited to muninn's own network use, since lesson text enters agent context. "Secrets are removed" describes best-effort detection as a guarantee. "Redacted quotes only" omits lesson text and logged commands, which can carry inline credentials. | `design-1-16`, `style-1-21` |
| N2 | 288 | High-entropy checks conflict with the tool muninn may borrow rules from (`memryzed-read.md` line 164). Commit hashes in quotes are a false-positive risk. | `design-1-17` |
| N3 | 86, 369, 505, 511 | "One command removes everything" is really `uninstall` plus `purge`, and the downloaded model isn't mentioned. | `design-1-19`, `structural-1-26`, `style-1-22` |
| N4 | 321, 344, 373-374 | `import` is undefined and could bypass approval. The UI has approve, but the CLI list has no equivalent. | `design-1-20`, `structural-1-27` |
| N5 | 75-78, 174-175, 290, 502 | The "optional" model download has no path for refused consent, though line 76 relies on the model. No integrity check is stated. | `design-1-21`, `style-1-23` |
| N6 | 300, 358 | Nothing says how a lesson becomes `global`, which matters for mixed-employer logs. | `design-1-22` |
| N7 | 485-490 | The Memryzed entry is firmer than its source: "found bugs" came from a static read, "none of muninn's main differences" overstates the UI row, Apache-2.0 omits GitHub's `NOASSERTION`, and "137 days" needs an as-of date. The build-or-extend choice is missing from the decisions table. | `design-1-23`, `structural-1-28`, `style-1-20` |
| N8 | 16, 74, 127, 180, 190, 194, 254, 284, 289, 420, 427, 434 | Subjective wording ("useful first run", "strongest few", "junk", "stand out", "fewer moving parts", "behaved strangely", "cleaned-up", "old"). "Any engineer" conflicts with line 514. CUJ 2 hard-codes a tunable threshold. "30-day" should say "default" (`cleanupPeriodDays`). | `design-1-24`, `style-1-27` |
| N9 | 9, 221, 500, 519, 526 | Additional Resources and Future Improvements nest under Non-Functional Requirements. The second Overview duplicates the first. | `structural-1-24` |
| N10 | 273-275 | Merging is ruled out because "use X" and "never use X" look similar, yet a candidate similar to a rejected lesson can still be dropped. | `structural-1-25` |
| N11 | 137-138, 455-456 | "Cursor logs" should say agent transcripts. Tool results and tokens exist in undocumented local stores, and `postToolUse` documents `tool_output`. | `structural-1-29`, `style-1-24` |
| N12 | 62, 78, 127, 143 | "Chargebee multi-term estimates", the `lessons` mod, `agents.md` tools and "the spike" are used before they are explained, or never explained. | `structural-1-30` |
| N13 | 61, 66, 104, 122, 346-347, 408, 410, 496 | "Seen this idea working" conflicts with line 61. "Working detection" conflicts with "never used enough to be tested". The Claude Design note and "own design pass" are repeated. | `style-1-26`, `style-1-27` |
| N14 | 154, 270, 277-279, 296, 360 | Trigger vocabulary drifts between "simple", "suggested" and "proposes", and "proposed" has several meanings. Define "simple" at first use and replace "the intelligence". | `style-1-6` |

## Unverified claims

The supplied evidence doesn't settle these, and no reviewer looked elsewhere:

| Line | Claim |
|---|---|
| 52 | "Neither moves lessons between tools" |
| 55-56 | OpenMemory and agentmemory, which the design lists as unassessed |
| 62 | The usage history of the earlier `lessons` mod |
| 163-165 | npm name availability |
| 219 | The `agents.md` language decision. `memryzed-read.md` line 255 also says `agents.md:56` plans a daemon, which line 214 rejects |
| 261 | Whether Claude Code and Codex logs mark pasted text |
| 408-410 | The claims about `claude-mods/lessons` |
| 508 | Whether `docs/spike.md` exists |
| 510 | Injected text "is re-read on every later turn", which needs reconciling with compaction summarising hook text |

## Traceability

| Consolidated | Raw findings |
|---|---|
| C1 | `design-1-1`, `structural-1-1`, `style-1-3` |
| C2 | `design-1-2`, `structural-1-2`, `structural-1-17`, `structural-1-23`, `style-1-2`, `style-1-25` |
| C3 | `design-1-3`, `structural-1-4`, `style-1-1`, `style-1-5` |
| C4 | `design-1-3`, `structural-1-3` |
| C5 | `style-1-4`, `design-1-1` |
| C6 | `structural-1-5` |
| C7 | `design-1-4`, `structural-1-6`, `style-1-7` |
| C8 | `design-1-4`, `structural-1-7`, `style-1-9` |
| C9 | `design-1-4`, `style-1-10` |
| C10 | `design-1-10`, `structural-1-8`, `style-1-8` |
| C11 | `design-1-5`, `structural-1-9`, `structural-1-10`, `style-1-11` |
| C12 | `design-1-8`, `structural-1-11`, `style-1-12`, `style-1-13` |
| C13 | `design-1-7`, `structural-1-12`, `style-1-14`, `style-1-15` |
| C14 | `design-1-6`, `structural-1-13`, `style-1-17` |
| C15 | `style-1-16` |
| C16 | `design-1-9`, `structural-1-15` |
| C17 | `structural-1-14`, `style-1-18`, `design-1-18` |
| C18 | `design-1-11`, `structural-1-18`, `structural-1-20` |
| C19 | `design-1-12` |
| C20 | `design-1-13`, `structural-1-22`, `style-1-19` |
| C21 | `design-1-14`, `structural-1-21` |
| C22 | `design-1-15`, `structural-1-16` |
| C23 | `structural-1-19` |
| N1-N14 | Listed in the Nits table |
