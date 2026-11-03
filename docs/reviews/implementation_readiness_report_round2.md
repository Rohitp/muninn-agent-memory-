# Stage 9 Re-audit: `docs/designs/muninn.md`, lines 553-875

**Round 2 result: not ready.** There are 8 Blockers, 22 Majors and 10 Nits after merging duplicates. The reviewers raised 109 findings in total. This is the one re-audit the review allows, so no further re-audit runs in this review.

| Reviewer | Standard | Status | Blocker | Major | Nit |
|---|---|---|---|---|---|
| `egm-implementation-readiness` | implementation-readiness-standard | completed | 2 | 25 | 7 |
| `egm-codebase-details` | implementation-readiness-standard | completed | 6 | 24 | 8 |
| `egm-style` | none | completed | 0 | 28 | 9 |

**Count corrections:** these counts come from the severity labels on each finding. The summary lines of two reviewers differ: codebase details says 21 Majors, and style says 25. Style's Nits are counted as its 9 listed bullets, and its three unnumbered Majors are given the ids `style-2-26` to `style-2-28`.

**Scope limits**
- Client and Memryzed behaviour rests only on `docs/checks/`, which records no live tests.
- Reviewers marked some claims as general knowledge or unverified, including the package-size, `node:sqlite` and pnpm points. Nothing was run.
- The Elephant has not evaluated every finding. Spot checks are at the end.

**What changed from round 1:** the original structural gaps are mostly closed, and the plan now has a schema, gates with outcomes, and a client matrix. Most round 2 findings are about the new text. They fall into two groups:
- real defects in the new text, marked **[Defect]**
- detail a Zero-Decision plan still lacks, much of which depends on Step 0 results, marked **[Detail]**

**Why round 2 is not converging:** the standard requires no design decisions left to the implementer, but Steps 1-3 rest on Step 0 results that don't exist yet. Reviewers can keep asking for detail on those steps, and some of it would be rewritten after Step 0. Findings that must be settled before Step 0 starts are marked **[Before Step 0]**.

## Blockers

### A1. Lessons that go live automatically have no route to the agent [Defect]
- **Scope:** lines 653, 695, 735, 758, 863
- **Sources:** `impl-2-1`, `code-2-7`, `style-2-1`
- **Finding:** "Later" makes a lesson `live`, but the route prompt and warning apply only to kept lessons, and the UI can't set always-on. So auto-live never leads to automatic delivery, and those lessons reach agent search unreviewed under an option labelled "later". "Shown" is also undefined for Ctrl-C and non-terminal runs, so lessons could go live with nobody having seen them.

### A2. "Not built or promised" for a failed client has no mechanism
- **Scope:** lines 594, 598-602, 775, 790, 800, 805, 829
- **Sources:** `impl-2-2`, `code-2-13`
- **Finding:** Nothing stores check results or reads them at run time. `muninn hook --client codex` can't tell which build called it, and the CLI and app may share one config. `install` always adds both events, and `status` shows no capabilities. The matrix also omits npm's 0.163.0, which a new public user would likely install.

### A3. The command index has no data source [Defect]
- **Scope:** lines 710, 848, 858
- **Sources:** `code-2-2`
- **Finding:** Item 15's readers return only typed text, yet item 34 needs commands that exited 0 in logs. No item adds tool calls. The checks don't record exit status, so "exited 0" is unverified for both clients.

### A4. The sentence filter can discard the main lessons, and the stop-list does nothing [Defect] [Before Step 0]
- **Scope:** lines 725, 754, 766, 769
- **Sources:** `code-2-3`, `impl-2-20`
- **Finding:** Sentences under 4 words are dropped, including "refresh the token" and "use caffeinate". The Stage 1 gate stops if the token lesson isn't found. Every listed stop-list entry is already under 4 words, so that test proves nothing. "Don't" can also split a paraphrase, and cluster order is unspecified.

### A5. The keep-rate gate's held-out repo protects little [Defect] [Before Step 0]
- **Scope:** lines 644, 762-771
- **Sources:** `code-2-4`, `impl-2-5`, `style-2-23`
- **Finding:** Pooling lets tuned repos carry a failing held-out repo: 6/10, 6/10 and 3/10 gives 15/30, a pass. Nothing resets the store between rounds, so round two judges different lessons. "Finds", "kept" for undecided lessons, and the denominator after exclusions are undefined. 10 of 20 has an interval of about 30-70% and 5 of 20 about 11-47%, and those overlap.

### A6. Gate rows overlap or leave gaps [Defect] [Before Step 0]
- **Scope:** lines 589, 598-600, 637, 646, 766-769, 829-831
- **Sources:** `code-2-5`, `impl-2-4`, `style-2-19`, `style-2-20`, `style-2-24`
- **Finding:** A first-round keep rate under 1 in 4 has no action, and exactly 1 in 2 matches two rows. Token lesson not found with fewer than 20 shown matches two rows. Delivery 3/5 against item 6's 4/5 matches both "fix" and "stop". "In a client" is ambiguous, "runs right" is undefined, and "M1 or M2 fails on both clients" can be read two ways.

### A7. The token gates can't show what they claim [Before Step 0]
- **Scope:** lines 468, 589, 637, 825-831
- **Sources:** `code-2-6`, `impl-2-3`, `impl-2-4`, `style-2-4`
- **Finding:**
  - The plan stops if the instruction line reaches 4/5, then requires a nearly identical mechanism to reach 4/5. A pass would mostly reflect noise, and a tie passes, despite line 70's "has to do better".
  - At 5 runs, a client with a true 60% rate reaches 4/5 about 34% of the time, and a client with a true 80% rate misses it about 26% of the time. With two clients those become about 56% and 46%.
  - **No fixed conditions:** there is no required token state, so a valid token makes "refreshed" meaningless. The instruction file isn't named, and Codex reads `AGENTS.md`. Auto memory stays on and can carry saved text into the later gate, and there is no control run. The lesson's route during the gate is unset.
  - `caffeinate`, a named Stage 2 goal, is never scored.

### A8. Item 3's reason for deleting the draft is false [Defect] [Before Step 0]
- **Scope:** line 574
- **Sources:** `code-2-1` (Blocker), `style-2-26` (Major), `impl-2-28` (Nit)
- **Finding:** "The two files differ only in their Status line, and neither is in git yet" was true when written, but the design has since changed and both files are now committed. Deleting the draft may still be right, but the stated reason is wrong.

## Major

### Step 0 and client checks

| Id | Before Step 0 | Scope | Finding | Sources |
|---|---|---|---|---|
| B6 | Yes | 600, 710, 745 | M3 fails if hook text isn't recorded, though then nothing needs excluding, and Claude Code's docs say no visible transcript entry. It has no gate row. Fixtures assume the record exists | `impl-2-10`, `code-2-16`, `style-2-8` |
| B7 | Yes | 601, 646, 775, 838, 853-858 | M4 mixes running a command and writing a file, and its failure doesn't reach Step 3. Whether an approval prompt counts as default settings is undefined. Codex sandbox behaviour is unverified | `impl-2-11`, `style-2-17` |
| B8 | Yes | 594-611 | Nothing checks client behaviour on bad output, killed hooks, timeout units or the real Codex config location. No repeat counts are set. Codex trust must come before M1 and M2. Five test rows don't fit the table's columns. Tests 5, 16 and 17 changed meaning from `client-capabilities.md`, and M1-M4 appear in no check file | `impl-2-12`, `code-2-18`, `style-2-14`, `style-2-15` |
| B11 | Yes | 605, 609 | "Tests 12-14 do not apply" misses the engineer's own headless runs, which can fire hooks and write transcripts. Test 18 is only partly covered | `code-2-20`, `style-2-16` |
| B12 | Yes | 523, 605, 616, 640, 800 | A p95 of 499 ms passes, even though the hook gives up at 500 ms. Fifty samples make p95 about the third-worst run. Test 17 has no number, and the timer and the gate measure different things | `code-2-21`, `impl-2-6` |
| B13 | Yes | 621-625, 638, 641-644 | The cutoff is tuned on the items it's scored on. "Beat", "make sense" and the 50 MB "package" are undefined, and quantisation may decide the size alone. A win on vague questions alone passes the embeddings row. No item creates `instructions.jsonl`. A failed transformers install has no outcome. The ship-model branch has no steps | `code-2-22`, `impl-2-7`, `impl-2-8`, `style-2-21`, `style-2-22` |
| B14 | Yes | 584, 735, 766, 810 | Two baselines exist. `learn`'s can include the trial, when reminders may have stopped. Only the token repo's logs are saved, though the gate needs three repos and logs last 30 days. `MUNINN_LOG_ROOT` has no layout. "Repeat" in `report` is undefined, and `add` lessons get no baseline | `code-2-23`, `impl-2-22`, `style-2-25` |

### Delivery

| Id | Before Step 0 | Scope | Finding | Sources |
|---|---|---|---|---|
| B3 | No | 611, 678, 780, 785, 790, 818 | "Reset" has no defined meaning against an append-only log, and `event` holds no compaction marker. `startup`, `resume` and `clear` are unverified, and Codex's documented `fork` has no rule, so strict parsing could lose a delivery. No compaction fixture exists. A late Codex hook could block a lesson | `code-2-10`, `code-2-14`, `code-2-15`, `impl-2-15`, `style-2-5`, `style-2-6`, `style-2-7` |
| B4 | No | 653, 725, 785 | Start plus two compactions uses 900 of 1,000 tokens, so a third restore is blocked with only a `limit` row. A lesson over 300 tokens can never be sent, and more than 3 always-on lessons silently drop the rest | `code-2-11`, `impl-2-9` |
| B5 | No | 306, 523, 790, 800, 820 | The order of sending and logging on a locked store is undefined. A JavaScript timer can't fire during a blocking native call, so the real ceiling is 1 s, not 500 ms. "Exits 0 in every case" conflicts with being killed by the client | `code-2-12`, `style-2-9` |
| B9 | No | 604, 609, 790, 800, 805, 819, 838 | "Find another signal" has no outcome if none exists. Strict parsing could reject Cursor input before the check. No Cursor fixture exists. Cursor runs logged as `claude-code` could hide a silent hook. Line 838 states as settled what line 163 leaves open | `code-2-17`, `impl-2-14`, `style-2-12` |
| B10 | No | 800, 805, 821 | Exact entries, timeout units, identifying muninn's entries, repeat installs and absent or malformed files are undefined. "Upgrades do not change it" is unsupported, because fnm and Homebrew paths can change, and Codex then needs re-trust. Line 805 states test 15's answer as fact | `impl-2-13`, `code-2-18`, `code-2-19`, `style-2-10`, `style-2-11` |

### Learner and data

| Id | Before Step 0 | Scope | Finding | Sources |
|---|---|---|---|---|
| B1 | No | 690-700, 725, 730, 756 | The state table has no row for approving a proposed lesson, editing a live one, or restoring. Rejected-lesson rules conflict between the cutoff and 0.98. Retired lessons have no rule, and a longer sentence could bring a rejected lesson back. The negation guard is missing from evidence matching, so "never use X" can add evidence to "use X" | `code-2-8`, `impl-2-16`, `impl-2-17`, `style-2-28` |
| B2 | No | 676-677, 730, 735, 755 | Re-reading everything has no dedupe key, so evidence and commands duplicate. The session count can't survive log expiry. The test for a repeat across runs is undefined once logs expire. Whether shown lessons take top-10 slots is undefined | `code-2-9`, `impl-2-18` |
| B15 | No | 658, 660-685, 848, 853 | Implicit rowids on `TEXT` primary keys can change on `VACUUM`, which breaks external-content FTS (reviewer's reading of SQLite). No owner exists for `commands_fts`, `repos` or `scan_counts`. Filtering after the vector index can return too few results, and the old tracker's filtered query test was dropped. `lesson_versions` holds text only. ID generation and the version record are undefined | `code-2-24`, `impl-2-25` |
| B19 | No | 705, 710, 735, 767 | Codex logs are stored by date, so finding a repo's logs means opening every rollout. Typed-text rules per client are undefined. `--all-repos` and the offer to widen aren't built, though the gate relies on them. "Too few sessions" has no number | `code-2-28`, `impl-2-19` |

### Build, interfaces and promises

| Id | Before Step 0 | Scope | Finding | Sources |
|---|---|---|---|---|
| B16 | Yes, for items run in Step 0 | 579, 745 | `@types/node` is missing, `npm pack` may omit `dist/` without a `files` field, and pnpm may block dependency build scripts. `node:sqlite` may be experimental on the minimum Node 22. All are reviewer general knowledge, not run | `code-2-25` |
| B17 | No | 616, 639, 658, 710, 715, 735, 790-863, 853 | `cli.ts`, `config.ts`, `learn.ts` and others change later but are listed only as Create. Step 0 leaves nothing for `tsc` to compile. The fallback needs a storage interface. The plan points to Memryzed notes that don't exist: the read has source locations, not line formats, and Memryzed has no Codex parser. No outcome is set if the licence check fails | `code-2-26`, `code-2-30`, `impl-2-27`, `style-2-27` |
| B18 | No | 555, 653, 680, 805, 833-863 | Step 3 has no gate, and the devlog says four gates where the plan has three. Item 33's 2 weeks block items 34-37 under strict ordering. The UI lacks search routes, body shapes and shutdown. The agent search setting has no key or command, and `ask` can't tell an agent from a person | `code-2-27`, `impl-2-24`, `impl-2-26`, `style-2-13`, `style-2-18` |
| B20 | No | 710, 742-745, 754, 760, 821, 871 | No embedding stub exists for tests. Install tests and E2E would write real client config, with no override. Flat fixtures can't yield a 3-session candidate, so the E2E learner check can't pass. Testing escaping needs a DOM | `code-2-29`, `impl-2-21` |
| B21 | No | 653, 693-694, 735, 740, 858, 863, 871 | No arguments, output or exit codes are set for the commands. `add` needs always-on and triggers for E2E. `purge` has no confirmation step. No command changes settings. Route-setting differs between keep, edit, `add` and the UI | `impl-2-23`, `style-2-2` |
| B22 | No | 599, 622, 641, 674, 735, 785, 871 | "Keyword", "literal trigger", "trigger" and `pattern` overlap, and "keyword" also means a search method | `style-2-3` |

## Nits

| Id | Scope | Finding | Sources |
|---|---|---|---|
| N1 | 569 | The requested devlog entry already exists | `code-2-31`, `impl-2-29`, `style-2-29` |
| N2 | 555, 584 | "Before anything else changes" contradicts in-order work. Retention should come first, with a stated value and whether it's reverted | `code-2-32`, `impl-2-30`, `style-2-29` |
| N3 | 564 | Moving `agents.md` leaves line 224's reference stale | `code-2-33`, `impl-2-34` |
| N4 | 559, 631 | Item 10 leaves `~/.muninn-spike/`, which holds raw logs, and `purge` doesn't cover it. The devlog records secret-shaped strings in Codex logs | `code-2-34` |
| N5 | 725 | Negation words are incomplete, and "don't stop" counts as negated | `code-2-35` |
| N6 | 658, 720 | Backup with write-ahead files, first-run hooks with no store, and pooling, query prefix and `dtype` are unspecified, and each changes the cutoff | `code-2-36`, `code-2-37` |
| N7 | 750-760, 816-823 | Test bullets aren't mapped to test files | `code-2-38` |
| N8 | 653, 740, 790, 795, 871 | `~/.muninn` paths ignore `MUNINN_HOME`, and `purge` misses `paused`, `hook-errors.log` and client config backups | `impl-2-32`, `impl-2-33`, `style-2-29` |
| N9 | 725, 730, 800, 805, 843 | Thresholds such as 2,000 characters, 0.98, 21 days and 90 days aren't labelled as proposed. The 21-day warning assumes the 30-day default | `impl-2-34`, `style-2-29` |
| N10 | 579, 594, 643, 720, 735, 742, 785, 875 | Overloaded and loose wording: "build", "moment", "token", "this file", "clear messages" | `style-2-29` |

## Elephant spot checks

- **Confirmed by reading the plan:** A1, A3, A4 and A8. The original item 3 was true when written, and later edits and the commit made it false.
- **Recalculated, consistent:** the 4-of-5 probabilities in A7 and the pooling example in A5.
- **Also my error:** the devlog says four gates, while the plan has three labelled gates (B18).
- **Not checked:** the SQLite, pnpm and `node:sqlite` claims (B15, B16), which need the spike or a run.

## Traceability

| Consolidated | Raw findings |
|---|---|
| A1 | `impl-2-1`, `code-2-7`, `style-2-1` |
| A2 | `impl-2-2`, `code-2-13` |
| A3 | `code-2-2` |
| A4 | `code-2-3`, `impl-2-20` |
| A5 | `code-2-4`, `impl-2-5`, `style-2-23` |
| A6 | `code-2-5`, `impl-2-4`, `style-2-19`, `style-2-20`, `style-2-24` |
| A7 | `code-2-6`, `impl-2-3`, `impl-2-4`, `style-2-4` |
| A8 | `code-2-1`, `style-2-26`, `impl-2-28` |
| B1-B22 | Listed in the tables above |
| N1-N10 | Listed in the Nits table. `style-2-29` stands for the style reviewer's 9 Nit bullets. `impl-2-31` is covered by B18 |
