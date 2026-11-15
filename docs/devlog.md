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

## 2026-11-03 — Validation stopped; building

**Did:**
- Ran the rules on one repo's logs (106 sessions): 19 candidates, none from corrections or returning mistakes. "Worked after" named whichever command last succeeded. One repo and first-draft rules can't judge the product.

**Decided:**
- Stop validating and build. Gates become the author's judgement from real use, and detail is settled while building.
- Rules find moments, and an LLM writes lessons through the engineer's `claude -p` or `codex exec`, behind one interface so a local model can follow.
- Automatic learning from a `SessionEnd` hook, on by default, batched, proposing only. Delivery adds `PostToolUseFailure` and `SubagentStart`.

**Gotcha:**
- muninn's own `claude -p` runs could feed its learner and trigger its hooks, so it has to mark and skip them.

**Next:**
- Build Stage 1.

## 2026-11-03 — Stage 1 first build

**Did:**
- Built the store, readers, four signals, lesson writer, `learn`, `review`, lesson commands, `install --learn`, and the `SessionEnd` scan. 44 tests pass on generated logs, with a fake model and writer.
- Ran `learn` on this repo's own logs: the pipeline worked, but found no moments.
- Tried the real `claude -p` writer on 4 made-up moments, in 6.3 s. It wrote 2 sensible lessons, discarded a normal test failure, and ignored an injected instruction. It left no session file.

**Decided:**
- Unknown-format warnings check record shape, not a list of types, because Claude Code adds new record types often.
- Failure moments give the LLM the commands that ran in between, not a guessed cause.
- The model stays a one-time download for now. It's 33 MB, so shipping it is still possible.

**Gotcha:**
- `codex exec` fails here: the default `gpt-6-sol` model isn't supported with this ChatGPT account on CLI 0.133.0. The Codex writer is untested as a result.
- `install --learn` covers Claude Code only until Codex's hook file is checked.

**Not done:**
- Model checksum, `status`, the session-start nudge, and a live test that a scan survives the session closing.

**Next:**
- Author runs `muninn learn` on a real repo.

## 2026-11-06 — First real run

**Did:**
- Author ran `muninn learn` in `cb-ai-agents/apps/api`. 4 lessons shown and all 4 kept.
- 2 were news to the author, both from failure-then-fix: zsh treating an unquoted `===` as a command lookup, and `benchmarks/` living at the repo root rather than under `apps/api`. The other 2 were known preferences about explaining simply.

**Decided:**
- The author's verdict: known lessons are still useful, because the tool saves noting them down. The two known ones should have been offered as one.
- To-dos: show existing keywords and warn on shared ones, explain delivery choices with an example, show model size, source and progress, offer to combine similar lessons, suggest global scope, and phrase lessons as instructions.

**Gotcha:**
- Four lessons from one repo is a small sample. It's a good sign, not a measurement.

## 2026-11-06 — Review fixes and delivery for Claude Code

**Did:**
- Review now explains the delivery choices with an example, suggests a keyword, lists keywords in use, warns when a keyword already has 3 lessons, offers to combine similar lessons, and suggests global scope. The writer phrases lessons as instructions and says whether a lesson is repo-wide or global. The model prompt gives size and source, and a progress bar shows during the download.
- Checked Claude Code 2.1.317 live with `claude -p` and a settings override: `SessionStart`, `UserPromptSubmit` and `PostToolUseFailure` all deliver text.
- Built delivery: the hook picks live lessons for the repo plus global ones, sends at most 3 and 300 tokens, and logs every outcome. It sends each lesson once per session, resets on compaction, skips Cursor and paused states, and mentions waiting lessons at session start. Also `install`, `uninstall`, `status` and `keywords`. 56 tests pass.
- Ran the real hook on the author's 4 kept lessons through `claude -p`, and the model quoted both always-on lessons word for word.

**Gotcha:**
- A first timing of the hook said 1 s, but it included Python's start-up from the timer. Measured with `/usr/bin/time`, it's 0.31-0.40 s.
- libSQL enforces foreign keys, so lessons need their repo row first.
- Test runs wrote delivery rows into the author's real store. They were removed.

**Next:**
- Author runs `muninn install` and uses it. Codex waits for a working `codex exec`.

## 2026-11-06 — Cursor through rules files, and a basic ask

**Did:**
- `muninn cursor on` writes kept lessons into `.cursor/rules/` in that repo. Always-on and global lessons go in `muninn.mdc` with `alwaysApply: true`. Each keyword gets an agent-requested file whose `description` lets Cursor's agent pull it in when the task fits. The file also tells the agent about `muninn ask`. Files are listed in `.git/info/exclude`, rewritten after any lesson change, and removed by `muninn cursor off` or `purge`. The format was checked against cursor.com/docs/rules.
- Added a basic `muninn ask`, which searches kept lessons in every repo by FTS5 and embeddings, with this repo's first. The meaning cutoff is 0.65, because at 0.5 every lesson matched. 59 tests pass.

**Decided:**
- Cursor uses rules files first, not its hooks, because they're plain files muninn controls with no untested hook behaviour. The cost is that Cursor's use can't be logged.

**Gotcha:**
- Cursor user rules live only in its settings screen, not as files, so global lessons are copied into each enabled repo's file.


## 2026-11-15 — Same lesson written again on every run

**Found (second real run):** `muninn learn` re-read all sessions, found the same moments, and the writer worded them differently each time. Two rewordings of one idea scored about 0.8, under the 0.85 cutoff, so each run added a copy. cb-ai-agents had 1 live and 10 proposed "explain simply" lessons, all built from the same Codex quotes.

**Did:**
- A moment is now matched to existing lessons by its evidence (session plus quote) before the writer runs. If a live or proposed lesson already holds any of its quotes, the evidence is added there and nothing is written. Quotes behind a rejected or retired lesson stay dropped. This also saves writer calls.
- `foldDuplicates` runs at the start of each learn: a proposed lesson sharing quotes with a live or older proposed one is retired into it (version marked `learn:duplicate`). Live lessons are never touched. Two live lessons sharing quotes are reported for the person to retire one. On a copy of the real database this folded 14 copies.
- The "Downloading model" bar appeared when loading from disk, because transformers.js reports progress for cached files too. It now shows only when the model is missing.
- Review prints the similar lesson in full. `list` marks cut text with "…". 61 tests pass.

## 2026-11-15 — Codex hooks, Cursor reader, notes, handoffs, report, UI

**Did:**
- **Codex delivery.** `muninn install` also writes `~/.codex/hooks.json` when Codex is installed. Codex has no failure event, so `PostToolUse` with matcher `Bash` runs every time and muninn looks for a non-zero exit code in the result. The result's shape isn't documented, so the first one seen is recorded (types only) and shown in `status`. Codex skips new hooks until the user trusts them in `/hooks`. SessionEnd hooks get a 3-second timeout, the Codex maximum.
- **Cursor reader.** Transcripts at `~/.cursor/projects/<slug>/agent-transcripts/<id>/<id>.jsonl` hold only role and text blocks. Typed text sits in `<user_query>`, with a `<timestamp>` like "Tuesday, Oct 27, 2026, 12:41 PM (UTC)". The repo comes from the slug, rebuilt by checking which folders exist, since folder names contain dashes. All 25 local transcripts mapped to the right repo.
- **Notes.** A typed message of 300+ characters with 3+ sentences, mostly not questions, is an "explained" moment. The writer turns it into a 2-6 sentence note with keywords, or says no. Every "no" is stored in a new `judged` table so reruns don't ask again. At most 30 new notes per run, newest first.
- **Handoffs.** The SessionEnd hook starts `muninn handoff --transcript` in the background, which asks the writer for up to 8 labelled lines (Goal, Done, Decided, Next, Open). Learn also writes them for recent sessions that had no hook, which covers Cursor. Delivered at `SessionStart` with source startup or clear when the branch matches, within 7 days, never to the session that wrote it.
- **Report and UI.** `muninn report` compares evidence before and after a lesson was kept, and says when the tool where it came back wasn't receiving lessons. `muninn ui` serves a page on 127.0.0.1, checks the Host header, and needs a random token on every request.

**Gotcha:**
- The install tests wrote the real `~/.codex/hooks.json`, because Codex's path wasn't overridden in tests. Removed both files (there was none before), and `useHome()` now points every client's config into the test folder.
- Cursor puts its own "Briefly inform the user about the task result…" prompt inside `<user_query>` 123 times. It's now on the not-typed list.
- `git rev-parse --abbrev-ref HEAD` fails before the first commit. `symbolic-ref --short -q HEAD` doesn't.
- The first real handoff hit the length cap mid-sentence. The prompt now asks for under 900 characters, and long replies are cut at a line break.

## 2026-11-15 — Plain English in search

**Why:** a search for "how did the contract benchmarks run?" returned a rule written for agents ("raises FileNotFoundError"), labelled with a long repo id. Accurate, but not something a person can read at a glance.

**Did:**
- A separate pass writes, for every lesson without one, a plain line addressed to the engineer and 2-3 questions it answers. Questions are embedded, and search compares the question typed with them, which matches better than question to rule. Editing a lesson's text clears both. The next learn, or the UI in the background, writes them again.
- Search results show the plain line first, "Agents are told:" second, where it came from ("Learned from a command that failed and was then fixed, in Codex, 28 Sept"), and waiting items marked "not kept yet". `muninn ask` for agents still returns kept items only.
- The Answer button writes up to 5 sentences from the top kept items and the two newest handoffs, citing them. On a copy of the real database it said the kept items don't cover how the benchmark ran, which was true.

**Decided:**
- Plain lines are computed when lessons are written, because the question isn't known then but the lesson is. Answers that combine several items still need a call at search time, so that's a button, not automatic.
- Claude only for now. Other providers go in `writer.ts` later.

## 2026-11-15 — muninn's own AI cost, cut and counted

**Found:** every `claude -p` call carried about 62,000 tokens before muninn's prompt, mostly MCP server instructions and Claude Code's system prompt, even with `--tools ""`. A one-word test reply cost $0.012 on Haiku.

**Measured (one-word reply, Haiku):**

| Flags | Tokens in |
| --- | --- |
| current | 62,181 |
| + `--system-prompt` | 59,048 |
| + `--strict-mcp-config --mcp-config '{"mcpServers":{}}'` | 619 |

**Did:**
- Every call now adds `--strict-mcp-config` with an empty server list, `--disable-slash-commands`, `--setting-sources ""`, a one-line `--system-prompt`, and `--output-format json`.
- Jobs pick a model: `backgroundModel` (default `haiku`) for handoffs, plain lines and answers. `judgeModel` (default: the client's own) for deciding what is worth a lesson.
- Each call's tokens and cost go into a new `llm_calls` table. `muninn report` and the UI's report tab show the last 30 days of muninn's own spend, the tokens added to agents' context, and how many kept lessons' problems came back.
- Real run on a copy: one handoff 10,074 tokens and $0.003. Plain lines for 5 lessons 3,047 tokens and $0.001. Both came out as good as the earlier ones.

**Not measured:** tokens saved in agent sessions. There's no clean way to count work that didn't happen. The report's stand-in is "problem came back after keeping".

## 2026-11-15 — Why "explain simply" didn't reach a session

**Found:** in session `71351cc7` (cb-ai-agents, Nov 12), the engineer asked for "step by step" and "without overwhelming me" again. muninn sent the two always-on lessons at the start, then ran on 99 prompts with no match. Both "explain simply" lessons had been kept on Nov 6 with the keyword "simplify", which the engineer never typed.

**Decided:** keywords suit task-specific lessons. Lessons about how the engineer likes to work are phrased too many ways for a keyword, so they belong always-on and global.

**Did:**
- Review spots these lessons (`isPreference`), recommends always-on and global, defaults to always-on on Enter, and asks again if a keyword is chosen. The UI shows the same advice and an "Any repo" checkbox.
- The report finds sessions where a kept lesson's problem came back but the lesson wasn't sent, in tools where muninn's hook runs. It names the date and the keyword that didn't match, and the UI offers "Make it always-on".
- On the real database, with the engineer's approval: combined `4d68f6e6` and `d949c23e` into `2c223396`, rewrote it to include "go step by step" and "don't overwhelm with detail", and made it always-on and global. A simulated session start in chargebee-app now receives it.

## 2026-11-15 — First run, review defaults and a Claude Code panel

**Why:** the journey review found the biggest gaps at install and first run (several commands, a long terminal quiz), and that muninn's value was invisible day to day.

**Did:**
- `muninn setup`: says what muninn reads, sends and changes, then installs the hooks, offers Cursor rules for every repo Cursor was used in, scans every repo, and opens the review page in the background. `muninn ui --detach` reuses a running page.
- One set of defaults (`defaultRoute`) for the terminal review, the UI and the panel. How-you-work lessons: always-on, any repo. Notes: their keywords. Command fixes: a keyword from the command. Everything else: always-on in its repo. Enter or Keep accepts them. `muninn keep <id>` and `muninn reject <id>` do the same from anywhere.
- The "lessons waiting" note to the agent goes out at most once a day per repo.
- Deliveries record the keyword that matched (in `trigger_id`), so muninn can say why it sent something.
- `muninn panel --session --cwd` gives the panel's data as JSON. The Claude Code mod in `mods/muninn-panel` draws it beside the chat: lessons sent this session and why, with retire; the handoff; the top 3 waiting with Keep and Reject; this week's numbers and muninn's own cost; "Open muninn". It refreshes when a turn ends and every 30 seconds, and puts "muninn: N sent" in the status line.

**Open:** the mod needs `muninn` on the PATH Claude Code starts with. It isn't published yet. For now it loads as a mod in this session, or with `claude --plugin-dir mods/muninn-panel`.
