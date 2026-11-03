## What this proposes

muninn is a local command-line tool with no background process. It reads an engineer's Claude Code and Codex logs and proposes lessons with evidence, mainly from instructions repeated in at least 3 sessions. It stores them in one libSQL file. Stage 1 is `muninn learn`, which lists candidates for the engineer to keep, edit or reject. Stage 2 adds hooks that deliver lessons by simple trigger matching, an MCP server and `muninn ask` for search and "how do I run X?", a local UI, and an append-only delivery log. Work proceeds through a spike, Stage 1 and Stage 2, with proposed numeric checks, and later stages stay in outline.

## How the existing system works, per this document

No muninn code is described as existing yet. The repo's existing files appear only as items to move, modify or delete (`agents.md`, `docs/implementation-plan.md`, `docs/devlog.md`, `design_draft.md`). Coding agents today rely on instruction files that don't learn and per-tool memory that doesn't move between tools. Engineers therefore repeat instructions, and nothing shows why a lesson was lost or ignored. Both vendors write logs in unstable formats, and Claude Code keeps logs for 30 days. Claude Code documents `PreToolUse` text as arriving too late to stop that call, and Codex requires the engineer to trust each hook.

**Paraphrase limits:** I could not paraphrase how the token lesson reaches the agent before the run (Finding 1). I also could not paraphrase which Stage 2 parts are unproven (Finding 2). My paraphrase describes those flows only at the level the document states them.

## Findings

### Generated triggers

**1. Severity: Blocker**
**Affected Scope:** Lines 92-99, 180-183, 279, 298-308
**Discrepancy Description & Rationale:** The document's main example cannot be traced from start to finish.
- The token lesson's example trigger is "the script's command" (279).
- Command triggers match on the prompt or after a tool call (302-303).
- `PreToolUse` is excluded until tested (305-308).
- If the engineer says "run the script" without the literal command, the only described match comes after the call has started. Line 37 says a skipped refresh costs 4 hours of failed runs.

CUJ 2 promises delivery "before the run where the tool allows it" but doesn't say which trigger achieves that. The lesson might need to be always-on, or the document might accept delivery after the run starts. It also gives no trigger for the `caffeinate` lesson, although line 92 requires it to take effect.

**2. Severity: Major**
**Affected Scope:** Lines 277-281, 653
**Discrepancy Description & Rationale:** Trigger generation is described only by its inputs: "commands run next, files touched, words used." Line 277 says "the intelligence is applied here," but extraction uses rules and embeddings with no LLM (218). The document doesn't explain:
- how far "around the evidence" reaches
- how often something must recur across sessions to become a trigger
- how noise such as `git status` is excluded
- whether embeddings play any part
- whether triggers are regenerated on later scans

**3. Severity: Major**
**Affected Scope:** Lines 94-96, 270-271, 283, 319-322, 360
**Discrepancy Description & Rationale:** The document doesn't say whether engineers see, edit or approve generated triggers. Review covers candidates, and the UI and commands refer to lessons. An `own_words` lesson can go live automatically, but its triggers are inferred from surrounding activity, and "anything inferred" waits for approval (95-96). Either reading is possible, and this decides whether unreviewed machine-generated matching rules can fire. The "who proposed it" field (360) also implies other proposers that are never named.

**4. Severity: Major**
**Affected Scope:** Lines 302-303, 310-311, 360, 695
**Discrepancy Description & Rationale:** Matching rules are undefined.
- A pattern could be a substring, token, glob or regex, and case handling is not stated.
- The document doesn't say whether several triggers on one lesson are combined with OR or AND.
- It doesn't say what a command trigger matches in free-text prompt wording.
- It doesn't say which lessons win when more than 3 match, or how the 300-token limit is applied.

"When it fires" is therefore known only at the level of the hook event.

**5. Severity: Major**
**Affected Scope:** Lines 280-281, 300, 308, 331, 358
**Discrepancy Description & Rationale:** The fields "always-on," "global" and "blocking" control delivery, but the document doesn't say what sets them, who sets them, or their defaults. A lesson with no trigger that isn't always-on is live but never delivered automatically, and nothing says the engineer is told. No plan item or test implements `blocking`, though line 358 places the flag in the schema.

**6. Severity: Major**
**Affected Scope:** Lines 154-155, 383-384, 579
**Discrepancy Description & Rationale:** Line 155 asks how many real cases simple triggers miss, but no step answers this directly. The spike compares keyword search with embeddings. It doesn't test whether generated triggers would have fired at the right moment. The Stage 1 gate measures whether lessons are kept, so trigger quality first appears indirectly in the Stage 2 relevance sample, after the system is built.

### Gate numbers

**7. Severity: Major**
**Affected Scope:** Lines 586-587, 680-682, 775-777
**Discrepancy Description & Rationale:** Several missed-gate outcomes are not stated.
- **Keep rate between 1 in 4 and 1 in 2:** the gate is missed, but the stop rule doesn't apply.
- **Token lesson not found:** no outcome is given.
- **Fewer than 2 outside engineers, or none returning:** no outcome is given.
- **"After tuning" (682):** no limit on effort or number of attempts is given.
- **Stage 2's 70% and 90% numbers, or losing to instruction files:** no outcome is given.
- **Vector column failure in the spike:** line 378 tests vector columns, but line 586 omits them from the conditions that trigger the switch to SQLite. The document also doesn't say how plain SQLite would hold vectors.
- **500 ms limit not achievable:** line 573 tests this, but the gate doesn't cover it.

**8. Severity: Major**
**Affected Scope:** Lines 110, 284, 680-682
**Discrepancy Description & Rationale:** The keep-rate denominator is unclear. The success measure uses "proposed lessons," while the gate uses "lessons shown," and output is cut to an unquantified "strongest few." Showing fewer lessons can raise the score. The document also doesn't say:
- whether the rate is pooled or per repo
- whether an edited lesson counts as kept
- how soon "runs it again" must happen

**9. Severity: Major**
**Affected Scope:** Lines 111-115, 285, 355-365, 659, 775-777
**Discrepancy Description & Rationale:** The 70% and 90% numbers can't be reproduced from this document.
- "Covered repeat" is never defined.
- The baseline's time window and its normalisation against the 2-week period are not stated.
- `learn` records a baseline, but no table in the data model holds it.
- No plan item recounts repeats after delivery starts.
- The sample size, the judge and the meaning of "relevant" are missing.
- The measure at line 114 is named "wrong or irrelevant" but counts only relevance.
- The instruction-file comparison has no duration, sequence or pass number, even though line 64 says muninn "has to do better."

**10. Severity: Major**
**Affected Scope:** Lines 148-150, 536, 684-777
**Discrepancy Description & Rationale:** Line 536 says each step ends at a gate, but Step 2 has none. Its numbers appear as "Stage 2 success" under Verification Plan, so a reader can't tell whether they are a gate or a retrospective measure. Line 148 says the stage gates use proposed numbers, but the Step 0 gate has no numeric threshold. "Catch no more than keyword search" (586) doesn't set a margin, and it doesn't say whether repeated instructions and vague questions are judged separately.

**11. Severity: Nit**
**Affected Scope:** Lines 268, 310-312, 507-508
**Discrepancy Description & Rationale:** The document mixes three kinds of number without a summary:
- runtime cutoffs, such as 500 ms
- tunable starting values, such as 3 lessons and 300 tokens
- aims, such as 100 ms at p95

Only the 500 ms cutoff has a stated runtime consequence: the hook gives up and logs it. The token limits say nothing about what is dropped or whether a skip is reported, though the log does record skips. A central table would separate these from the gate numbers.

### Stage 2 dependence on untested client checks

**12. Severity: Blocker**
**Affected Scope:** Lines 298-308, 341, 386, 522, 689-690
**Discrepancy Description & Rationale:** A reader with only this document can't separate settled parts from unproven ones. The 19 tests are in an external file, and the document names their areas only as "delivery, compaction, MCP and install."

| Status per this document | Items |
| --- | --- |
| Explicitly unproven | Refusing a call through `PreToolUse` (305-308), MCP project detection in the Codex desktop app (341), and Codex reading `agents.md` on a case-insensitive disk (548) |
| Possibly unproven, status not stated | Every row of the delivery table for each client, the compaction path, MCP use, and install behaviour |
| Appears settled, but not labelled | Local logic such as matching, limits, the delivery log, command index, search and UI |

The hook table doesn't separate Claude Code from Codex, or documented behaviour from tested behaviour. Plan items 24-27 and 31 read as firm work despite this.

**13. Severity: Major**
**Affected Scope:** Lines 92-93, 97-99, 386, 680-690
**Discrepancy Description & Rationale:** Line 690 says only that "the matching part of this plan changes" if a test fails.
- No fallback is given for any hook or client.
- No gate follows item 23.
- The document doesn't say what happens if Codex can't deliver, yet line 92 is an unconditional goal for both tools.
- "Before Stage 2" (386) places the tests ahead of Stage 2, while item 23 sits inside it, after the go decision.
- "Where a tool cannot do this, muninn says so" (99) has no described mechanism beyond a README support table, which line 754 describes only in terms of Cursor.

**14. Severity: Nit**
**Affected Scope:** Lines 217, 340-341
**Discrepancy Description & Rationale:** "Codex" isn't defined as the CLI, the desktop app or both. Only line 341 reveals that the desktop app might matter, so the supported surface is unclear.

### Other comprehension gaps

**15. Severity: Major**
**Affected Scope:** Lines 92, 94-96, 283-284, 319, 504, 773
**Discrepancy Description & Rationale:** The document doesn't say when an `own_words` lesson goes live. It could be at scan time without the engineer seeing it, or only after "keep." Lines 92 and 773 imply keeping, while lines 94 and 319 imply automatic. It's also unclear what happens to candidates cut from the "strongest few."

Corrections add a similar problem: an engineer types them, but they aren't necessarily repeated, and no source is assigned. Line 94 limits auto-live to "own repeated words," while line 504 says anything "not typed by the engineer" waits. Those two rules give different results for a correction.

**16. Severity: Major**
**Affected Scope:** Lines 187, 335-337, 717
**Discrepancy Description & Rationale:** The document never says what happens after the first run. With no background program, nothing explains when new logs are scanned, or when the command index is built and refreshed. "Repo B has been scanned" assumes a step the document doesn't describe. This affects lesson freshness and the "date last seen" field. The age behind the "old source" warning (190) is also undefined.

**17. Severity: Nit**
**Affected Scope:** Lines 62, 139, 143, 219, 524, 543-548, 760
**Discrepancy Description & Rationale:** `agents.md` is cited as an authority for the language choice and a list of excluded tools before anything explains what it is. Line 547 finally calls it an outdated build spec named `amem`, then moves it. `understand`, `check`, leases, branch handoff and merge promotion are undefined. The `lessons` and `anchor` mods are barely explained.

**18. Severity: Nit**
**Affected Scope:** Lines 53-56, 104, 127, 408, 489, 521-524, 781
**Discrepancy Description & Rationale:** These references can't be understood from this document, and none has a usable external link:
- Chargebee multi-term estimates, an example that assumes prior history
- Claude Design
- "priced rules"
- "EGM"
- Memryzed, OpenMemory and agentmemory
- the local reference documents, which are cited as support without summarising what they establish, apart from the Memryzed conclusions

**19. Severity: Nit**
**Affected Scope:** Lines 78, 212-213, 376
**Discrepancy Description & Rationale:** "The spike" is used repeatedly before it is introduced at line 376. A one-line definition at first use would fix this.

**20. Severity: Nit**
**Affected Scope:** Lines 311, 369, 374, 664
**Discrepancy Description & Rationale:**
- `import` appears in the command lists, but its purpose isn't described.
- The document doesn't say whether post-compaction re-delivery counts against the 1,000-token session limit.
- "Once after compaction" doesn't say whether it means once per compaction or once per session.

## Review scope

I read the persona and the full target (FeatureRange 1-533, DetailedRange 534-782), and nothing else. The caller did not specify a persona `Mode`, so I treated this as a REVIEW. Findings about the unread cited files reflect what this document fails to explain. They don't claim those files lack the information.
