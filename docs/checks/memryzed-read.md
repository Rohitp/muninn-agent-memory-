# Memryzed: full source read, compared with muninn

* **Commit read:** `8ad98ddb2294deb34df10f7c562269a48370fe31`, 2026-06-19 (tag `v0.7.1` is on an earlier commit, `ac6ee98`, 2026-06-13)
* **Date of this read:** 2026-11-03
* **Method:** static reading only. Nothing was installed, built or run, so every statement about behaviour comes from the code and has not been seen happening. Items that most need a live test are listed at the end.

## Summary

| Question | Finding | Status |
| --- | --- | --- |
| Capture | Polls transcript files every 30 seconds for Claude Code, Kiro and Copilot CLI. Codex, Cursor and Continue have MCP wiring only. | Partial |
| Extraction | Seven regexes, one message at a time. Optional Ollama call, reachable only through one tool flag. No detection of repeats, failures, loops or corrections. | Basic |
| Review | Approve, pin and reject exist in a terminal screen. Edit does not exist. Most content reaches agents unreviewed. Rejected facts are not remembered. | Partial, and weaker than the docs say |
| Delivery | Tool call only. Nothing is pushed into context. No trigger field. | Pull only |
| Compaction | A hook exists to capture before compaction, nothing restores afterwards, and the capture hook looks broken. | Restore absent |
| Feedback | Nothing logs deliveries or measures use. The log table and audit log have no production writers. | Absent |
| UI | One terminal screen for the pending queue, plus CLI commands. No web UI. | Minimal |
| Staleness and contradictions | Expiry dates are stored but never enforced. No contradiction handling. | Absent |
| Secrets | Good regex redaction, but applied only to conversation excerpts, not to facts or session records. | Partial |
| Prompt injection | Not found. Stored text is returned verbatim. | Absent |
| Storage and process | Clean SQLite schema with six migrations. No daemon: each client starts its own server, and one holds a lock to do background work. | Solid base, one serious lock bug |
| Project health | One author, 62 commits in 23 days, then none for 137 days. 0 stars, 0 issues, 0 pull requests. Apache-2.0. | Dormant |
| Roadmap | Nothing planned for delivery or feedback. A web UI appears only in one FAQ line. | No overlap planned |

**muninn's five intended differences**

| Intended difference | Exists | Planned | Verdict |
| --- | --- | --- | --- |
| Delivery at the moment a lesson applies | No | No | Truly absent |
| Restoring after compaction | No | No | Truly absent |
| Checking whether lessons worked | No (empty stubs only) | No | Truly absent |
| Learning from repeated instructions | No | No (only general "better extraction") | Truly absent, and current storage removes the signal |
| Searchable, editable UI | Partly (CLI search of facts, no edit) | One FAQ line, not in the roadmap | Mostly absent |

**Extend or build:** all five differences would be new code either way. Reuse would save the capture, storage, redaction and retrieval plumbing, but in Rust, while `agents.md` plans TypeScript. Extending also means owning a dormant single-author codebase and first repairing several foundation bugs. Details are in "How hard would it be to extend Memryzed?" below.

## How to read the evidence

Paths are relative to the Memryzed repo root, with these short forms:

* `core/` = `crates/memryzed-core/src/`
* `cli/` = `crates/memryzed-cli/src/`
* `mcp/lib.rs` = `crates/memryzed-mcp/src/lib.rs`
* `tui/lib.rs` = `crates/memryzed-tui/src/lib.rs`
* `migrations/` = `crates/memryzed-core/migrations/`

Where the docs and the code disagree, this report follows the code. `docs/specs/v1.md:10-15` itself says the spec is a historical record and not current behaviour.

## 1. Capture

There are three routes.

**Transcript polling, the main route.** Each `memryzed serve` starts a background thread (`mcp/lib.rs:61-66`). It mines known transcript folders every 30 seconds (`mcp/lib.rs:104`, `127-140`), reading only bytes added since the last pass (`core/mining/mod.rs:139-151`). `memryzed watch` does the same in the foreground (`cli/commands/watch.rs:59-65`, `85-112`). The source list has exactly three entries (`core/mining/source.rs:74-76`, folders at `80-86`).

**Claude Code hooks.** Install adds `Stop` and `PreCompact` hooks (`core/hooks.rs:49-52`, `cli/commands/install.rs:166-167`). They are capture-only and discard their output (`core/hooks.rs:184-188`, `203-206`).

* **These hooks look like they do nothing.** The scripts run only if the environment variable `CLAUDE_TRANSCRIPT_PATH` is set (`core/hooks.rs:184`, `202`). Claude Code's hooks documentation describes `transcript_path` in the JSON on stdin and does not list that variable. The string appears 0 times in the Claude Code 2.1.317 binary on this machine, while `transcript_path` appears 17 times. Older versions were not checked.
* **Install overwrites other tools' hooks on those two events.** `hooks.insert(...)` replaces the whole `Stop` and `PreCompact` lists (`core/hooks.rs:120`), and uninstall removes the whole key (`core/hooks.rs:146-150`). The code comment says other tools' hooks are kept (`core/hooks.rs:95-97`), but the test covers only a different event (`core/hooks.rs:269-287`). A backup file is written first.

**Agent tool calls.** Any client's agent can call `remember` or `extract_from` (`mcp/lib.rs:375`, `594`). The server's instructions do not mention `extract_from` (`mcp/lib.rs:677-695`).

| Client | Transcript capture | Hooks | MCP wiring by `install` | Rules file written | Tools auto-approved |
| --- | --- | --- | --- | --- | --- |
| Claude Code | Yes | Yes, but likely no-ops | Yes | `~/.claude/CLAUDE.md` | Yes |
| Kiro CLI | Yes | No | Yes | `~/.kiro/steering/memryzed.md` | Yes |
| Copilot CLI | Yes | No | **No adapter** | No | No |
| Cursor | **No** | No | Yes | No | Yes |
| Codex CLI | **No** | No | Yes (TOML) | No | No |
| Continue | **No** | No | Yes (YAML) | No | No |

Evidence: adapters at `core/integrations.rs:125-133`, rules files at `163-166` and `181-184`, auto-approve at `473-483`. The docs list Copilot CLI as supported (`docs/faq.md:17`), and a search of `core/integrations.rs` for "copilot" finds nothing.

**For muninn:** of its three target clients (Claude Code, Codex, Cursor), Memryzed captures only Claude Code. The roadmap says other formats come "as their layouts are confirmed" (`docs/roadmap.md:40-41`).

## 2. Extraction

**Rule-based.** There are exactly seven regexes, run on each user message separately (`core/extractor/mod.rs:57-141`, `148`; called at `core/mining/mod.rs:324-328`):

| Signal | Confidence | Lines |
| --- | --- | --- |
| "remember (that) X" | 1.0 | `63` |
| "don't forget (that) X" | 1.0 | `70` |
| "I prefer X over Y" | 0.95 | `78` |
| "I always/usually use X" | 0.9 | `93` |
| "I never use X" | 0.9 | `101` |
| "this repo/project/codebase uses X" | 0.9 | `113` |
| "the deploy/build/test/lint command is X" | 0.9 | `124` |

**Local LLM.** It makes an HTTP call to the user's own Ollama at `/api/generate` (`core/extractor/ollama.rs:83-94`). The default model tag is `qwen2.5:3b` with a 30-second timeout (`core/extractor/ollama.rs:42-50`). Ollama is not bundled. The prompt asks for durable facts and preferences as a JSON array (`core/extractor/ollama.rs:52-58`).

* It is reachable only when a caller of the `extract_from` tool passes `use_ollama: true` (`mcp/lib.rs:602-604`). A search of `core/mining/` and `cli/` finds no Ollama call, so background capture never uses it.
* The tool uses the hard-coded default settings (`mcp/lib.rs:603`). The `ollama_enabled`, `ollama_url` and `ollama_model` settings (`crates/memryzed-cli/assets/default-config.toml:30-32`) are not read outside the `config` command's generic get and set (checked `core/`, `cli/`, `mcp/`).
* A missing confidence value becomes 0.7, which goes to the review queue (`core/extractor/ollama.rs:143`). This is the only default route into that queue (see section 3).
* The parser accepts only a JSON array (`core/extractor/ollama.rs:123-126`, test at `178`). Whether Ollama's JSON mode reliably returns one was not tested.

**Embeddings** are separate from extraction: `bge-small-en-v1.5` through local fastembed (`crates/memryzed-cli/assets/default-config.toml:25`, `core/embedder/fastembed.rs:106`, `126`).

**Repeated instructions, failures, loops and corrections: not found.** Checked the extractor, the Ollama prompt, mining and episodes.

* **Repeats.** Each message is judged alone, with no counting. A unique index on `(role, content)` and `INSERT OR IGNORE` collapse exact repeats of a turn into one row (`migrations/006_episode_dedup.sql:21`, `core/episodes.rs:244`), so the frequency signal is thrown away.
* **Failures and loops.** Tool activity never gets in. Parsers keep only text: Claude blocks without `text` are skipped (`core/mining/source.rs:240-256`), and Kiro and Copilot drop tool lines (`core/mining/source.rs:148-154`, `214-220`).
* **Corrections.** The docs claim them (`docs/concepts.md:109`, `docs/faq.md:144-146`), and the old spec lists patterns (`docs/specs/v1.md:487-490`), but no such pattern exists in code. Short corrections are also dropped from episodes: anything under 24 characters is discarded (`core/episodes.rs:38`, `81-83`), which includes "no, use pnpm instead".

## 3. Review

**How it works.** `memryzed review` opens a terminal list of pending items (`tui/lib.rs:46-59`). Keys are `a` approve, `p` approve and pin, `r` reject, `q` quit, and up/down or `j`/`k` to move (`tui/lib.rs:142-149`).

**Edit does not exist.** The README, CLI reference, FAQ and concepts page all promise it (`README.md:81`, `docs/cli-reference.md:141-149`, `docs/faq.md:142`, `docs/concepts.md:98`). I found no edit key in the screen and no `Edit` command for memories: the only `Edit` is under `config` (`cli/cli.rs:333`; command dispatch at `cli/commands/mod.rs:63-221`). The only statements that update memories are archive, approve and import (`core/memory/mod.rs:261`, `324`, `core/export.rs:244`). The workaround is to forget and re-add.

**Can anything reach an agent unapproved? Yes, nearly everything.**

* **Conversation excerpts.** All captured turns are recallable with no review, by design (`migrations/005_episodes.sql:7-8`, `core/episodes.rs:24-25`, returned at `mcp/lib.rs:340-351`).
* **Agent `remember` calls.** Stored as approved immediately (`mcp/lib.rs:373`, `403`, `core/memory/mod.rs:389-393`).
* **All seven regex matches.** Every pattern has confidence of at least 0.9, and the threshold is 0.85, hard-coded at `cli/commands/watch.rs:61`, `cli/commands/mine.rs:60`, `111` and `mcp/lib.rs:130`. So every rule match is auto-approved (`core/mining/mod.rs:348-354`). The `memory.auto_approve_threshold` setting is not read by that code.

The consequence is that **the review queue is close to empty by default.** It fills only from Ollama results under the threshold, or from a caller passing a higher threshold to `extract_from` (`mcp/lib.rs:615`). This contradicts "You decide what gets stored" (`docs/faq.md:79-81`).

What the queue does do correctly: pending items are excluded from search on all paths (`core/retrieval.rs:256`, `288`, `319`).

**Are rejected facts remembered? Stored, but not used.** Reject calls the same archive function as forget (`tui/lib.rs:171`, `core/memory/mod.rs:259-268`). The row stays, with no "rejected" status or reason (`core/memory/status.rs:29-40`). Inserts do not compare against existing content (`core/memory/mod.rs:275-297`, `381-440`) and the table has no unique constraint (`migrations/001_initial.sql:9-27`). So a rejected fact said again comes back, auto-approved if a rule matched it. The same lack of checks allows duplicate approved facts.

## 4. Delivery

**Tool call only.** The agent has to call `recall` (`mcp/lib.rs:287`). A search for `SessionStart`, `UserPromptSubmit`, `PostToolUse`, `PostCompact`, `additionalContext` and `hookSpecificOutput` across `crates/`, `docs/`, the README and the changelog finds only `PreToolUse` in test fixtures (`core/hooks.rs:273`, `281`, `306`, `316`).

The word "proactive" here means text asking the agent to call the tool: the tool description (`mcp/lib.rs:264-285`), the server instructions (`mcp/lib.rs:677-695`) and the rules file (`core/integrations.rs:58-72`). `docs/for-agent-authors.md:31-33` suggests a recall at each user turn, but it is advice to client authors and nothing enforces it.

**Compaction.** The `PreCompact` hook captures only (`core/hooks.rs:195-211`), sends all output to `/dev/null`, and is probably inactive (section 1). No code restores anything afterwards. `resume` exists but the agent has to call it (`mcp/lib.rs:496-507`), and the rules file does not mention it. Mined transcripts are saved under a synthetic project (`core/mining/mod.rs:288`, `361-363`), so `resume` in a real repo returns only what an agent explicitly checkpointed.

**"When this applies" or trigger field: not found.** The memory schema has scope, kind, status, confidence and expiry, and nothing for conditions (`migrations/001_initial.sql:9-27`, `core/memory/mod.rs:39-66`). Kind has no effect on ranking (`core/memory/kind.rs:26-27`).

Scope is also weak as a substitute:

* `recall` never filters to the current repo, because it always passes `scope_id: None` (`mcp/lib.rs:294`).
* Mined facts are always forced to global, even "this repo uses X" (`core/mining/mod.rs:332-335`).
* Episodes always store `NULL` as their project (`core/episodes.rs:117`, `208`, `246`), and episode recall has no project input (`core/episodes.rs:436-442`).

So a fact mined from one repo can be recalled in any other.

## 5. Feedback

**No delivery logging and no measure of use. Not found** after checking schema, tools, CLI, roadmap and docs.

* The `recall_log` table exists (`migrations/001_initial.sql:45-59`), but nothing writes to it. The only code reference is a test checking that the table exists (`core/storage/mod.rs:183`).
* The audit log has a writer function (`core/audit.rs:74`) that only its own tests call (`core/audit.rs:158-177`). `memryzed log` reads a file that nothing in production writes. This contradicts `docs/concepts.md:84-86` and `docs/faq.md:123`.
* No field records last use, use count or outcome (`migrations/001_initial.sql:9-27`).
* The published benchmark measures retrieval recall only: recall@5 of 0.842 on LongMemEval-S at version 0.6.0 (`benchmarks/results/longmemeval-s.json:12`, `15`). It does not measure whether a fact helped.

The `recall_log` and audit log are useful as a sign of intent, but they are unused stubs.

## 6. UI

* **Terminal.** One screen for the pending queue, built with ratatui (`crates/memryzed-tui/src/lib.rs`, 307 lines). It cannot browse or search approved facts.
* **CLI.** `list`, `show`, `search`, `remember`, `forget`, `log`, `sessions`, `export` and `import` (`cli/cli.rs:119-185`, `234-315`). `search` covers facts only (`cli/commands/search.rs:22`, `56`). In the CLI, episodes appear only in `doctor` and `reindex` counts and upkeep (`cli/commands/doctor.rs:290`, `cli/commands/reindex.rs:65-88`), so the user cannot browse most of the stored history. `export` does not include episodes either: `core/export.rs` never mentions them.
* **Web: not found.** Checked dependencies and code for an HTTP server. The only HTTP library is the `ureq` client (`Cargo.toml:51`).
* **Roadmap.** `docs/faq.md:150` says "A web UI is on the roadmap", but `docs/roadmap.md` does not mention one, and the old spec lists it as out of scope for v1 (`docs/specs/v1.md:41`).

## 7. Staleness, contradictions, secrets, prompt injection

**Staleness: mostly absent.** A time-to-live can be set (`mcp/lib.rs:397-399`, `cli/commands/remember.rs:66`), but a search of all Rust code finds no comparison against `expires_at`, and the retrieval SQL does not filter on it (`core/retrieval.rs:251-257`, `283-289`, `314-320`). Expired facts keep being returned. The only time signal is a small recency weight of 0.1 with a 30-day decay (`core/retrieval.rs:46`, `203-207`). The newer episode search dropped recency altogether (`core/episodes.rs:447-450`).

**Contradictions: not found.** Checked `core/`, `mcp/`, `cli/` and the docs for "supersede", "contradict" and "conflict". The only matches are the import rule and unrelated code. The claim at `docs/faq.md:144-146` has no code behind it. Two opposite facts would both be stored and returned.

**Secrets: good rules, partial coverage.** `core/redact.rs` is careful and well designed. It covers AWS, GitHub, Slack, Stripe, OpenAI, Anthropic, Google, npm, JWTs, PEM keys and named assignments (`core/redact.rs:58-104`), and avoids guessing from entropy (`core/redact.rs:17-24`). But its only production call is on episode text (`core/mining/mod.rs:409`). These paths are not redacted:

* Mined facts (`core/mining/mod.rs:344`).
* Mined session records, which hold the last 20 raw turns (`core/mining/mod.rs:295-307`).
* The `remember` and `extract_from` tools (`mcp/lib.rs:392`, `631`), which rely on the tool description asking agents not to save secrets (`mcp/lib.rs:370`).

So "remember that password=hunter2hunter2" would be stored as written. There is no encryption at rest (`docs/specs/v1.md:43`).

**Prompt injection: not found.** Searched for "inject", "untrusted", "poison" and "malicious" across `crates/`, `docs/`, the README, `SECURITY.md` and the changelog. The only hits for "sanitize" are about making search strings safe for SQLite (`core/retrieval.rs:404`), and `SECURITY.md:58` concerns install scripts. Assistant turns and pasted content are stored verbatim and returned to agents with no marking as untrusted data (`core/mining/mod.rs:403-413`, `mcp/lib.rs:340-351`). The tool's description tells the agent to fold results into its answer (`mcp/lib.rs:284-285`), and tools are auto-approved on install for three clients.

**Other documented but missing behaviour.** Rate limits are described (`docs/mcp-reference.md:284-292`) and configured (`crates/memryzed-cli/assets/default-config.toml:11-13`), but "rate_limit" appears nowhere in Rust code.

## 8. Storage and process model

**Storage.** One SQLite file with write-ahead logging and a 5-second busy timeout (`core/storage/mod.rs:65-72`).

| Table | Purpose | Source |
| --- | --- | --- |
| `memories` | Curated facts, with CHECK constraints on scope, status and kind | `migrations/001_initial.sql:9-27` |
| `projects` | Repo identity | `migrations/001_initial.sql:34-41` |
| `recall_log` | Unused | `migrations/001_initial.sql:45-56` |
| `meta` | Key-value store, including file offsets | `migrations/001_initial.sql:61-64` |
| `memory_embeddings` | Vectors as blobs | `migrations/002_embeddings.sql:10-16` |
| `memory_fts` | Keyword index with triggers | `migrations/003_fts.sql:8-27` |
| `sessions` | Opaque saved state per project | `migrations/004_sessions.sql:7-18` |
| `episodes`, `episode_fts` | Verbatim turns, vectors and keyword index | `migrations/005_episodes.sql:14-45` |

**Migrations.** Six SQL files compiled into the binary and tracked with `PRAGMA user_version`, each in one transaction, forward only (`core/storage/migrations.rs:37`, `82`, `111-117`). This is simple and fine. Changing the status or kind lists needs a table rebuild, because SQLite cannot alter a CHECK constraint.

**Search.** Vector search is a full scan: every embedding is loaded and compared in Rust on each query (`core/retrieval.rs:278-303`, `core/episodes.rs:466-476`). There is no vector index, so cost grows with history.

**Process model: no daemon.** Each client starts its own `memryzed serve` over stdio (`cli/commands/serve.rs:49-78`). Inside it, a background thread does capture and embedding on its own database connection (`mcp/lib.rs:61-66`, `111`). A lock file ensures one process does this work (`mcp/lib.rs:78-87`, `core/engine.rs:127-155`). The architecture doc still says each process works independently (`docs/architecture.md:52-54`).

**Serious lock bug on macOS and Windows (from reading, not run):**

* The stale-lock check only works on Linux. Elsewhere `pid_alive` always returns true (`core/engine.rs:184-193`).
* The lock is released when its guard is dropped (`core/engine.rs:175-179`), but the guard lives on a detached thread that dies with the process (`mcp/lib.rs:59`, `78`). `serve` waits on the service and then returns (`cli/commands/serve.rs:62-80`), so the thread's cleanup should never run.
* No other code removes the file. `engine_lock` is used only at `core/paths.rs:94` and `mcp/lib.rs:78`.

So on a Mac, after the first server exits, later servers should skip background work silently until `~/.memryzed/engine.lock` is deleted. Combined with the inactive hooks, automatic capture could stop after the first session. `memryzed watch` takes no lock and would still capture, but it does not embed (`cli/commands/watch.rs:85-112`). The test only covers acquiring and releasing within one process (`core/engine.rs:232-244`). CI runs on macOS (`.github/workflows/ci.yml`), which would not catch this.

## 9. Project health

* **Commits.** 62 commits from 2026-05-28 to 2026-06-19, across 15 distinct days.
* **Recent activity.** No commits for 137 days as of 2026-11-03. The changelog's Unreleased section is empty (`CHANGELOG.md:11-23`).
* **Contributors.** One: Hamza Arjah, 62 of 62 commits, confirmed by both `git shortlog` and the GitHub API.
* **Public signals (GitHub API, 2026-11-03).** 0 stars, 0 forks, 0 issues ever (open or closed), 0 pull requests, 1 release (`v0.7.1`, 2026-06-13). Issues are enabled, discussions are off.
* **Location.** `memryzed/memryzed` redirects to `hamzaarja/memryzed`, a personal account. The repo was created on GitHub on 2026-06-12, with earlier history imported.
* **Licence.** Apache-2.0 per `LICENSE`, `NOTICE` and `Cargo.toml:15`. GitHub's detector reports `NOASSERTION`. The file's text ends as Apache's does, and I did not diff it word for word, so check this before reusing any code.
* **Quality signals.** About 14,800 lines of Rust including tests, 206 tests, CI across three operating systems with format and lint checks. The code is tidy, but the docs describe several features the code does not have, as sections 2, 3, 5 and 7 record.

## 10. Roadmap

Read `docs/roadmap.md` in full.

| Gap | In the roadmap? | Nearest item |
| --- | --- | --- |
| Delivery (4) | No | "Equivalents for other clients" is about capture hooks (`docs/roadmap.md:48-49`) |
| Compaction restore (4) | No | The shipped hook is capture only (`docs/roadmap.md:45-47`) |
| Trigger field (4) | No | None |
| Feedback (5) | No | None. Telemetry is mentioned elsewhere as counters only (`docs/faq.md:82`) |
| UI (6) | No | Only `docs/faq.md:150`. The roadmap's "not doing" list rejects a chat UI and IDE plugins (`docs/roadmap.md:120-122`), not a web UI |

Other planned items are general extraction work (`docs/roadmap.md:66`, `92-93`), "did you mean to remember this?" prompts (`docs/roadmap.md:100-102`), optional sync (`docs/roadmap.md:72-86`) and shareable project memory (`docs/roadmap.md:104-110`). The roadmap is also stale: it still lists v1.0 as current work with a "4 to 6 weeks" target (`docs/roadmap.md:9-27`).

## muninn's intended differences

**1. Delivery at the moment a lesson applies: truly absent, not planned.** Nothing pushes content or has a trigger concept. The nearest thing is prose asking agents to call `recall`.

**2. Restoring after compaction: truly absent, not planned.** The `PreCompact` hook points in the other direction, saving rather than restoring.

**3. Checking whether lessons worked: truly absent, not planned.** Two logging stubs exist with no writers. Even if filled, tool events are discarded at parsing, so there would be nothing to compare outcomes against.

**4. Learning from repeated instructions: truly absent, not planned.** Extraction has no memory between messages, and exact repeats are collapsed on storage.

**5. Searchable, editable UI: mostly absent.** CLI fact search and a review queue exist. Edit is documented but missing, episodes cannot be browsed, and there is no web UI.

**What muninn should not claim as different.** Memryzed already has local cross-agent recall of past conversations with a published retrieval score, hybrid search, a review queue, one-command client setup and secret redaction. Those are not points of difference, although its coverage of Codex and Cursor capture is a real gap.

**Corrections to `concepts_brief.md`.** The report that agents call tools to recall is confirmed (`concepts_brief.md:61`). The caveat that a feature missing from the partial read may still exist (`concepts_brief.md:31`) can now be closed for these five. Note that some of Memryzed's documented features are the opposite problem: described but not built.

## How hard would it be to extend Memryzed?

The effort labels are my judgement from reading the structure, not measured estimates.

**What helps.** Four crates with clear boundaries (`core`, `mcp`, `cli`, `tui`). A small migration runner. A `Source` adapter for transcripts and an `Adapter` trait for clients (`core/mining/source.rs:30-39`, `core/integrations.rs:87-122`). A hook-writing module. Good test habits and a permissive licence.

**What hurts.**

* **Language.** Memryzed is Rust. `agents.md:34` plans TypeScript on Node. A fork means switching language, or a mixed system.
* **Ownership.** With a dormant single author and no community, there is little upstream to contribute to, so a fork is in practice all yours.
* **Hook speed.** Each CLI start loads the embedding model through `make_default` (`core/embedder/mod.rs:72-82`, `cli/commands/mine.rs:52`). That is likely too slow for a hook on every prompt, so delivery needs either keyword-only matching or a real daemon, which Memryzed lacks and `agents.md:56` already plans.

**Repairs needed first, whichever feature comes first.** Small to medium in total.

| Repair | Evidence |
| --- | --- |
| Read `transcript_path` from stdin in hooks | `core/hooks.rs:184`, `202` |
| Merge hooks rather than overwrite | `core/hooks.rs:120`, `146-150` |
| Fix the engine lock on macOS and Windows | `core/engine.rs:184-193`, `mcp/lib.rs:78` |
| Duplicate and rejected-fact checks on insert | `core/memory/mod.rs:275-297`, `381-440` |
| Keep project identity on facts and episodes, and filter recall | `core/mining/mod.rs:332-335`, `core/episodes.rs:117`, `mcp/lib.rs:294` |
| Redact on all write paths | `core/mining/mod.rs:295-307`, `344`, `mcp/lib.rs:392` |
| Enforce expiry, and write real logs | `core/retrieval.rs:314-320`, `core/audit.rs:74` |
| Read settings instead of hard-coding them | `cli/commands/watch.rs:61`, `mcp/lib.rs:603` |
| Add Codex and Cursor transcript parsers (Cursor's logs have few fields, per `concepts_brief.md`) | `core/mining/source.rs:74-76` |

**Adding each difference.**

| Difference | What it takes | Effort | Saved by reusing Memryzed |
| --- | --- | --- | --- |
| Moment-of-use delivery | New `inject` command reading hook input, new hook events, trigger columns and a matcher. The matcher is the hard part and is new either way. | Plumbing medium, matching hard | Hook installer, keyword search |
| Restore after compaction | `SessionStart` hook with the `compact` matcher, which Claude Code documents, plus a record of what was active in each session. | Small to medium | Hook installer only |
| Checking lessons worked | Delivery log (`recall_log` is a start), extend `Turn` (`core/mining/mod.rs:48-58`) and all parsers to keep tool events, then outcome logic. | Medium to large | Very little beyond parsers |
| Learning from repeats | Occurrence table, since the unique index removes counts, plus normalising and clustering across sessions, and correction detection. | Medium to large | Transcript reading and the episodes corpus |
| Searchable, editable UI | Add an update function with re-embedding (the FTS trigger already exists, `migrations/003_fts.sql:24-27`), an episode browser, and a web or fuller terminal app. | Medium | Storage and search queries |

**Overall.** Extending is **feasible but saves less than `concepts_brief.md:201` hoped.** It does avoid writing capture, storage and retrieval from zero, and those pieces are decent. But that is the easier part, needs the repairs above, and only covers one of muninn's three target clients. Everything that would set muninn apart, and the riskiest assumption named in the brief (knowing when a lesson applies), is new work either way.

My recommendation is to build rather than extend, if TypeScript stays the plan, and to treat Memryzed as a reference: copy its ideas for redaction rules, the transcript line formats, rank fusion and the installer's config handling, checking the licence and attribution first. Forking makes sense only if you are happy to move muninn to Rust. Depending on it as an upstream product is the weakest option, given its dormancy and the bugs above.

## Not checked, and what to test live

The brief's step 5 also asks for running Memryzed on real work (`concepts_brief.md:263`). That has not been done. Before running it, back up `~/.claude/settings.json`, `~/.claude.json` and `~/.claude/CLAUDE.md`, since install edits all three, and may replace your existing `Stop` and `PreCompact` hooks. A throwaway home directory or machine is safer. Install scripts also download binaries from `memryzed.com`, and those binaries were not inspected.

Three live tests would confirm the highest-impact findings:

1. On macOS, start and quit `memryzed serve` twice. Does `engine.lock` remain, and does background capture stop?
2. Trigger a `Stop` hook in Claude Code 2.1.317. Does the script mine anything?
3. Say "I prefer X over Y" in a session and run `memryzed review`. Is the queue empty, with the fact already approved?

Also not checked: the `memryzed.com` site, native client memory features, and whether Ollama's JSON mode returns arrays.

**A candidate testable claim for step 5:** "When a user prompt or a compaction restart matches an approved lesson's trigger, muninn adds that lesson to context without any agent tool call, and records whether the next actions followed it." This read found no code path in Memryzed that does either. Native memory has not been assessed against it.
