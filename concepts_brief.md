# muninn

* **Author:** Rohit
* **Date:** 2026-11-03

## Overview

muninn is a proposed local tool for individual engineers. Its author would be the first user, and a public release is the goal. It would learn lessons from coding sessions in Claude Code, Codex and Cursor, possibly using a small local LLM. It would deliver each lesson when it applies, answer "how do I run X?" across repos, and show everything in a searchable, editable UI.

Later stages would check whether lessons worked, diagnose repeats, offer organised views of long work, let the user ask an AI about learnings, and track models and cost.

Success means two things: repeated setup instructions stop while wrong or irrelevant lessons stay rare, and engineers have a clear reason to install it beyond what their agent already does.

The repo has no code yet. The review below covers the concept and the earlier, unreviewed spec in `agents.md`, which uses the placeholder name `amem`. Where they differ, the concept takes precedence.

## Analysis

**Reviewer status.** Each reviewer ran once in `Mode: BRAINSTORM`, and none needed a retry.

| Reviewer | Status |
| --- | --- |
| `egm-design` | completed |
| `egm-codebase-details` | completed |
| `egm-zoom-out` | completed |
| `egm-comprehension` | completed |
| `egm-implementation-readiness` | completed |
| `egm-structural` | completed |

**Limits of this evidence.**

- Reviewers could not open URLs, and nothing about Memryzed was verified. The Memryzed facts come from a partial read, and a feature missing from that read may still exist.
- Reviewers were given `agents.md` but not `design_draft.md`, `docs/devlog.md` or `docs/implementation-plan.md`. Those files may already address some points below.
- Local evidence shows that files and code exist. Nobody ran a hook, an injection or a client test.
- All numbers are reviewer estimates or small samples, not measurements.

**Single weakest assumption.** The concept assumes that muninn can tell, automatically and in all three clients, when a lesson applies, and can do so accurately enough that wrong or irrelevant lessons stay rare.

Four reviewers named this directly. Two named a related assumption:

- `egm-implementation-readiness` named the assumption that the three clients offer stable, comparable ways to read sessions and add context.
- `egm-zoom-out` named the assumption that many lessons exist that a static instruction file cannot serve but a trigger can recognise.

These three views fit together. Timely delivery needs a client mechanism, a reliable match, and enough lessons that actually need it. None of the three has been shown.

**What local files show about client capabilities.** Anything not in this table remains unverified.

| Capability | Claude Code | Codex | Cursor |
| --- | --- | --- | --- |
| Local session logs | Present, with working directory, branch and version | Present, with working directory, branch and remote | Present, but with few fields |
| Adding context through a hook | In the cached plugin types for `UserPromptSubmit`, `SessionStart`, `PostToolUse` and others. `PreToolUse` is not in that list. | No evidence found. `~/.codex/config.toml` has no hooks section, which does not prove hooks are unsupported. | Minified app code handles `additional_context` for `beforeSubmitPrompt` and `sessionStart`. It also has a path that drops the text. |
| Signal after compaction | `PostCompact` type exists but is not listed as accepting context. `egm-codebase-details` reports a `SessionStart` source of `compact`. | Compaction is logged. Re-delivery is unconfirmed. | `preCompact` exists. Injection is unconfirmed. |
| Token and model data | Present | Present | Almost none |
| MCP launch directory | Unverified | Unverified | Unverified |

Sources are `~/.claude/plugins/cache/claude-mods/lessons/0.1.0/.claude-plugin/types/claude-code/index.d.ts` (lines 1367-1378 and 7797), `~/.codex/sessions/`, `~/.cursor/projects/`, and `/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js`. The Cursor file is internal code and could change without notice.

**Objections, most serious first.** Severity labels are normalised across reviewers. Where reviewers differed, the entry says so.

1. **Blocker: timely delivery has no definition or proven mechanism.** Raised by all six reviewers; `egm-zoom-out` rated it Major.
   - The concept promises delivery, but `agents.md` lines 129 and 223 rely on a written rule asking the agent to call `recall`.
   - As reported, Memryzed's agents also call tools to recall, so this design would not set muninn apart.
   - Text similarity (`agents.md` line 131) finds related text. It does not show that a lesson applies now.
   - Nobody has defined "applies", how often a lesson may repeat, or what happens after compaction.
   - Codex may have no way to push a lesson at all, which would leave the three clients with different promises.

2. **Blocker: success cannot be measured, and the missing data cannot be recovered later.** Raised by all six.
   - "Stop" and "rare" have no numbers, and "repeat", "wrong" and "irrelevant" have no definitions.
   - The `events` table records only edits (`agents.md` line 98), not deliveries.
   - Checking whether lessons worked comes in a later stage, but past deliveries and the pre-launch baseline cannot be rebuilt afterwards.
   - One user also produces few firings per lesson, so per-lesson statistics will be close to anecdote.
   - A true causal answer has no counterfactual. `egm-zoom-out` suggests measuring whether the repeat stopped after delivery instead.

3. **Blocker: neither the need for muninn nor the reason to choose it has been shown.** Raised by all six. `egm-zoom-out` rated it Blocker and the others Major.
   - Repeated setup instructions are mostly stable, repo-level facts. A line in `AGENTS.md` or `CLAUDE.md` might stop them with no timing logic. The headline success measure may therefore not depend on the main differentiator.
   - The proposed advantages rest on gaps in a partial read of a pre-1.0, Apache-2.0 project. A gap may not be real, or may close.
   - As written, `agents.md` closely resembles Memryzed's reported shape.
   - Client memory is a further rival that the concept does not mention. Claude memory files exist on this machine, along with a Codex file named `memories_1.sqlite`. How these are loaded and used is unverified.
   - `egm-design` and `egm-implementation-readiness` see evidence that lessons help as the differentiator hardest to copy, and the concept defers it to a later stage.

4. **Blocker: capture depends on three surfaces muninn does not control.** `egm-structural` and `egm-implementation-readiness` rated it Blocker; `egm-design`, `egm-zoom-out` and `egm-codebase-details` rated it Major.
   - The three clients keep logs in three different layouts. Their formats may not be documented or stable.
   - `agents.md` line 170 leaves Codex and Cursor capture to an instruction rule, and line 254 spikes the shim only in Claude Code.
   - `egm-codebase-details` found that sampled Cursor logs had almost no working directory, timestamp or usage fields, and no tool output. The repo appears only in a hyphenated folder name. Cursor logs may therefore be unable to show whether a failure came back.
   - Codex logs include subagent sessions and long vendor instructions, which could be mistaken for lessons without filtering.
   - Some Claude transcripts listed in an index were missing from their folder (cause unverified), so old logs may not be a dependable archive.
   - One maintainer would carry this work on the clients' release schedules.

5. **Blocker for public release: stored lessons can carry prompt injection and secrets.** Raised by all six. `egm-design` and `egm-structural` rated it a Blocker for public release, and the others Major.
   - Text from a web page, dependency or tool output could become a lesson and reach later sessions as trusted guidance, including across clients.
   - A narrow pattern matched secret-shaped strings 20 times in 5 Codex files. Reviewers did not check whether these are live and did not print them.
   - `before_json` history, search tables, backups and exports could keep a secret after the user thinks it is gone (`agents.md` lines 19, 98 and 179).
   - Logs on this machine appear to include both work and personal repos, so cross-repo answers could move employer facts elsewhere. `egm-zoom-out` advises checking employer policy before processing those logs.
   - The local UI adds risks from cross-site requests, DNS rebinding and script injection through transcript text. `npx -y` (`agents.md` line 211) runs unpinned code in a tool that can read transcripts.

6. **Blocker: a wrong lesson has no path from seen to fixed, and the trust rules work against the goal.** `egm-comprehension` rated it Blocker; `egm-design` and `egm-codebase-details` rated it Major.
   - The agent can act on a bad lesson without the engineer seeing it.
   - An agent's own save is marked `confirmed` with no human involved (`agents.md` line 81).
   - Unreviewed drafts appear in `recall` by default (lines 130 and 293).
   - Agents can replace lessons (line 226), which could overwrite a human edit.
   - Nothing stops re-extraction from proposing a lesson the user rejected.
   - The 0.90 similarity dedupe (line 137) may merge opposites such as "use X" and "never use X".

7. **Blocker: "across repos" contradicts the spec and is undefined.** `egm-codebase-details` rated it Blocker; four others rated it Major.
   - `agents.md` lines 130 and 260 forbid returning, and test against returning, another repo's findings.
   - The concept could mean a human asking from anywhere about a named repo, or a lesson carried between repos. These need different rules.
   - A confident but outdated command can do harm, especially one that resets a database or deploys.
   - Agents can often read manifests and Makefiles directly, so the real gap may be undocumented or machine-specific facts.

8. **Blocker for public release: no upgrade or rollback plan protects edited lessons.** Raised by `egm-implementation-readiness`; `egm-structural` rated it Major.
   - The spec has no schema version, migration runner, downgrade behaviour or versioned export.
   - Hand-edited lessons cannot be regenerated.
   - Restoring a database also cannot undo a harmful delivery, and no staged rollout is described.

9. **Major: `agents.md` is not a plan for this concept, and the concept's own scope is wide.** Raised by all six.
   - Capture, the core of the concept, arrives in Phase 3 of `agents.md`.
   - Code graphs, blast radius, plan checks, leases, handoff, merge promotion, the grill-me and EGM integrations, and hosting are not in the concept.
   - The concept's later stages need separate data and may be separate products. `egm-comprehension` could not explain "organised views of long work" or "diagnosing repeats" from the concept alone.

10. **Major: the spec ignores the author's closest existing work.** Raised by `egm-codebase-details`.
    - `~/projects/claude-mods/README.md` describes `lessons` (what keeps going wrong and whether a rule is worth carrying), `anchor` (facts surviving compaction), and `context-lens` and `cache-guard` (context and cache costs).
    - These overlap with parts of the concept, though they are Claude-only and the mod API is early access (`README.md` line 102).
    - `~/.claude/history.jsonl` line 878 mentions "lessons is empty". If that refers to this plugin, why it was empty may be the most useful evidence available on extraction yield.
    - Running both tools could deliver one rule twice.

11. **Major: the local LLM is unproven, and the fallback conflicts with the privacy story.** Raised by all six.
    - `egm-design` estimates about 22 minutes of heavy compute a day at 500,000 tokens, and about 33 hours for a 90-day backfill, using several GB of memory. Filtering down to 5% of the volume would bring these to about a minute a day and under two hours.
    - Quality may be the larger problem, because a small model must tell a durable rule from a one-off fix or from the agent's wrong conclusion.
    - `agents.md` line 169 falls back to `claude -p` or an API key, which sends transcripts off the machine. It might also trigger capture on its own session (unverified).
    - Model and prompt changes will shift output, with no regression check. The fixed 384-dimension column (line 85) has no re-embedding path.

12. **Major: failure looks the same as silence.** Raised by `egm-comprehension`, `egm-codebase-details` and `egm-implementation-readiness`.
    - A broken parser or stopped daemon looks identical to "no lesson applied".
    - Clients may drop or truncate injected text while muninn reports success.
    - Public users have no telemetry path for useful bug reports, and `doctor` is not specified to check recent capture and delivery.

13. **Major: review burden is undecided.** Raised by `egm-comprehension`, `egm-design` and `egm-zoom-out`. Mandatory approval risks an abandoned inbox (`egm-design` estimates 20 reviews a day at 10 sessions and 2 candidates each). Skipping approval conflicts with keeping wrong lessons rare.

14. **Major: project identity and scope can be wrong without anyone noticing.** Raised by five reviewers.
    - `repo_id` changes on rename, on move, or when a first remote is added (`agents.md` line 75).
    - The same repo under an SSH host alias and under `github.com` would likely become two repos.
    - Forks, worktrees, monorepos and multi-root workspaces have no defined behaviour.
    - Saves outside a repo default to global (line 118), so scratch-session lessons could appear everywhere.

15. **Major: the daemon is a brittle single point of failure.** Raised by `egm-design`, `egm-structural` and `egm-implementation-readiness`.
    - It combines auto-start, a port and token file, idle exit, and one shim per session.
    - The 5-second cold-start allowance (`agents.md` line 283) could delay a synchronous hook.
    - A floating `npx` launcher can leave shim and daemon on different versions, or migrate the store without the user choosing to upgrade.
    - The daemon exists mainly to hold the embedding model and a single writer, so it may not be needed if those go.

16. **Major: delivered tokens cost more than their size.** Raised by `egm-design`. A 1,500-token block delivered at turn 5 of a 100-turn session amounts to about 144,000 tokens re-read, before caching and compaction. muninn's own overhead would be invisible until cost tracking arrives in a later stage.

17. **Major: the install is heavy and first value comes late.** Raised by `egm-comprehension`, `egm-structural` and `egm-implementation-readiness`.
    - `init` edits global instruction files, client configs and git hooks, downloads a model and starts a daemon.
    - The CLI list has no uninstall command, and stale rule text would point agents at tools that no longer exist.
    - The user then has no lessons until more sessions have run.

18. **Major: overlap with instruction files is unresolved.** Raised by `egm-comprehension` and `egm-implementation-readiness`. Users cannot easily apply "stable rules" versus "evolving knowledge" (`agents.md` line 26), and nothing says which source wins in a conflict or how duplicates are found.

19. **Major: the stack may be premature for a first user.** Raised by `egm-zoom-out`, `egm-design`, `egm-structural` and `egm-codebase-details`.
    - Vector search, an embedding model and the 10,000-finding target have no evidence behind them. `egm-design` notes that 10,000 active lessons would probably have failed on quality first.
    - libSQL's main advantage is later Turso sync, which the concept does not include, and FTS5 support is unconfirmed (`agents.md` line 37).
    - `egm-zoom-out` also questions building a web UI early, although the concept includes one. It suggests deferring the UI, not dropping it.

20. **Major: lessons will age, and staleness covers only linked files.** Raised by `egm-zoom-out`, `egm-structural` and `egm-codebase-details`. A commit count on a linked file (`agents.md` line 173) would not catch "use uv" going out of date or a command broken by a change elsewhere.

21. **Major: too many concepts are exposed to users.** Raised by `egm-comprehension`. The concept says "lesson" and the spec says "finding". The spec has six types, four scopes, five statuses, two trust levels and about 20 CLI commands.

22. **Major: automatic delivery conflicts with clean-context sessions.** Raised by `egm-codebase-details`. `agents.md` line 198 says fresh reviewers must not use memory, but a hook fires whether or not an agent asks. An opt-out per session or per agent would be needed.

23. **Minor points.**
    - `amem`, `AMEM_HOME` and `~/.agent-memory/` become compatibility surfaces if shipped, and npm availability of `muninn` is unverified.
    - The name may be hard to spell or connect to its purpose.
    - One reviewer's understanding of git is that a local `post-merge` hook cannot identify a branch squash-merged on a server (not tested).
    - Evidence from the author alone will not show that another engineer can adopt the tool.
    - Public release adds installers, platform support and format-breakage support.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * From the concept, first stages: learn lessons from Claude Code, Codex and Cursor sessions; deliver each lesson when it applies; answer "how do I run X?" across repos; provide a searchable, editable UI.
  * From the concept, later stages: check whether lessons worked and diagnose repeats; organised views of long work; asking an AI about learnings; model and cost tracking.
  * From the concept, success: repeated setup instructions stop, wrong or irrelevant lessons stay rare, and engineers have a clear reason to install it beyond what their agent already does.
  * Raised by reviewers for addition to the first stage, not yet part of the concept: a baseline of repeated instructions, a delivery log, and basic secret handling before storage.

* **Out-of-Scope Non-Goals:**
  * Set by the author: agents inside products, for now.
  * The concept states no other explicit non-goals. It describes a local tool for individual engineers, which suggests that team sharing and hosting are excluded, and `agents.md` lists both as non-goals for now.
  * Raised by reviewers as items to mark explicitly dropped or deferred, because they appear in `agents.md` but not in the concept: `understand`, `check`, tree-sitter parsing, blast radius, leases, branch handoff, merge promotion, the grill-me and EGM integrations, and hosting.

## Alternatives Weighed

**Rejected by the author so far:**

* **Instruction files (`CLAUDE.md`, `AGENTS.md`) as the product.** Rejected by author: they have no search or UI and do not move lessons between agents, and the author wants those. The author has not tried them for the token and `caffeinate` reminders, so how many repeats they would stop is unmeasured. Using them as a delivery route for muninn, listed below, is still open.
* **Designing for agents inside products (for example, an agent fetching items from a database through a tool).** Rejected by author for now: the core problem is coding agents. The author may revisit reuse later.

**Raised by reviewers.** The alternatives below have been neither accepted nor rejected.

* **Compile approved lessons into native instruction files** (raised by `egm-design`, `egm-zoom-out`, `egm-structural`, `egm-comprehension`, `egm-implementation-readiness`, `egm-codebase-details`). This needs no delivery engine or daemon, and it is easy to read and undo. It adds always-on context, cannot target a moment, may touch team-shared files, and its client loading behaviour is unverified. `egm-design` says every other design should have to beat this baseline.
* **Measure first, with a read-only repeat detector over existing transcripts** (raised by `egm-zoom-out`, `egm-codebase-details`, `egm-design`). One mechanism would yield the baseline, the first lesson candidates and the lasting success metric, with no model required. It delivers nothing by itself and depends on transcript access.
* **Build on or extend Memryzed, adding only delivery, measurement or a UI** (raised by all six). This avoids rebuilding capture, storage and retrieval. It creates a dependency on a pre-1.0 project, and its fit is unknown without a full read of its code.
* **Ship a deterministic "how do I run X?" index first, built from manifests, scripts, CI files and commands seen to succeed** (raised by `egm-design`, `egm-comprehension`, `egm-structural`, `egm-codebase-details`, `egm-zoom-out`). Answers can be checked and cite their source, with no LLM. This is the feature easiest to copy, it may not be enough reason to switch, and it misses undocumented steps.
* **Start with rules or corrections only, and add an LLM only if it beats them on a labelled set** (raised by `egm-design`, `egm-comprehension`, `egm-structural`, `egm-zoom-out`, `egm-codebase-details`). Signals include user corrections, instructions repeated across sessions, and commands that succeeded after failures. Behaviour is predictable and testable, but this misses lessons nobody stated.
* **Use explicit triggers, such as repo, path pattern or command prefix, instead of similarity matching** (raised by `egm-design`). Triggers can be edited, tested and replayed. They need a client trigger point and will not cover vague lessons.
* **Support one client first, or publish support tiers** (raised by `egm-design`, `egm-structural`, `egm-implementation-readiness`, `egm-zoom-out`, `egm-codebase-details`). This proves the core with less work and allows an honest capability table. It weakens the cross-client claim, which `egm-zoom-out` notes may be muninn's clearest edge over native memory.
* **Store lessons as Markdown files, with SQLite as a rebuildable index and event log** (raised by `egm-implementation-readiness`, `egm-zoom-out`). Lessons can be diffed and survive uninstall, and many schema migrations shrink to reindexing. Concurrent edits are harder, and frontmatter still needs versioning.
* **Drop the daemon and embeddings at first, using short-lived commands on SQLite with keyword search** (raised by `egm-design`, `egm-structural`, `egm-implementation-readiness`, `egm-codebase-details`). This removes much of the version-skew and failure risk. Keyword search may miss paraphrases, and model load time may rule out short-lived hooks if a model is kept.
* **Reuse or share a core with `claude-mods/lessons`** (raised by `egm-codebase-details`). `hooks/model.ts` describes itself as a pure model, so it may port. The mods are Claude-only, the API is early access, and low yield may be a warning rather than a head start.
* **Cut later stages** (raised by `egm-zoom-out`). The proposal cuts organised views, separate AI chat, and cost tracking, since the user's own agent could query the store and cost tracking is unrelated to lessons. `egm-structural` proposes instead keeping later stages but unlocking each only after the previous one meets a measured target.

## Check Results

Static checks only; nothing has been run live.

* **Memryzed** (`docs/checks/memryzed-read.md`): the code contradicts parts of its README and of this brief's competitor notes. Edit does not exist, most content reaches agents unreviewed, and transcript capture covers only Claude Code, Kiro and Copilot CLI. Delivery at the moment of use, restoring after compaction, checking results and learning from repeats are absent and not on its roadmap. It has been dormant for 137 days, with one author.
* **Clients** (`docs/checks/client-capabilities.md`): Codex does document hooks, which refutes the concern in objection 1 that it may have no way to push a lesson. Claude Code and Codex document re-adding context after compaction; Cursor documents no way to do so. Claude Code and Codex state that their transcript formats are not stable. Cursor transcripts have no tool output, working directory, branch, model or tokens. Claude Code transcripts have a 30-day default retention. Codex requires the user to trust each hook.

## Key Decisions & Staging for Next Steps

**Decided by the author:**

* The tool is named `muninn`, not `amem`.
* The first priority is learning lessons from the work done in sessions. The first version also has to deliver those lessons and let the engineer see and correct them.
* The author is the first user, and the goal is to ship to other engineers.
* The UI must show what has been learned and allow manual edits. Its visual design comes later, through Claude Design.
* Model and cost tracking is a later addition.
* A small local LLM may be packaged if needed, and scope may expand to compete with Memryzed.

**First build, agreed direction:** a small learner that reads past session logs and proposes lessons with evidence, before any delivery engine, UI, daemon or database. It is built for any engineer and assumes nothing about their company: it runs locally, sends nothing off the machine, and needs no account or model. The full first version follows once its lessons prove worth keeping.

**Learner's default scope:** decided by the author: it reads only the logs for the repo it is run in, and reading more is an explicit choice. Consequence: by default it cannot see instructions repeated across repos, such as `caffeinate`.

**Learner's first tools:** decided by the author: Claude Code and Codex. Both logs include tool output and repo data, so it can detect repeats, failures and corrections. Cursor comes later, and the cross-agent claim stays limited to those two until then.

**Gate before the bigger first version:** proposed in this session, not yet confirmed by the author: a few other engineers run the learner on their own repo, and the measure is whether they keep lessons and run it again.

**Benchmark, changed by the author:** the comparison is what an engineer's agent already does (built-in memory and instruction files) plus other memory tools, not Memryzed alone. **Demand** is unmeasured: the existing `lessons` mod has been shown to nobody.

**The author's success tests:**

* The author no longer has to think about setup tasks such as refreshing a token or keeping the laptop awake, because they are handled as lessons. Whether "handled" means reminding the agent or acting without being asked is open.
* Asking "how do I run X?" returns the command, without reading a README in another repo.

**Working assumptions the author has not contradicted:**

* "Other engineers" means individuals on their own machines. Team sharing is out of scope.
* The engineer would turn muninn off for wrong lessons that mislead agents without notice, or for irrelevant lessons that waste tokens.

**Origin:** muninn started from the author's `lessons` mod in `~/projects/claude-mods`. The author describes that version as Claude-specific and extremely rough, and wants a polished version that does not depend on Claude. It already detects failures, loops and corrections, prices each rule, delivers rules just in time, and tracks whether a failure came back. Its two local stores show every `rules` and `kept` list empty, across a short history. The author says they did not use it enough to test it properly, so the empty stores are not evidence for or against the learning approach. The author treats `claude-mods` as a separate, lightweight side project and not as muninn's base; its ideas can still inform the design.

**Example behind later stages:** on multi-term estimates in Chargebee repositories, the author lost track of the work in a new thread despite a devlog and an implementation plan. What was missing was a clear view of where unneeded database calls and reverts were being reduced.

**Everything below was raised by reviewers and remains open.**

**Open decisions, most consequential first.**

1. **Product identity.** Is muninn a memory store, a delivery layer, a lesson extractor, or a measured way to stop repeated instructions? `egm-design` recommends the last, and says this choice settles most of the others.
2. **Definition of "applies".** Which moments count, which matching method is used, and how does a matched lesson repeat or return after compaction?
3. **Success numbers and stop rule.** What repeat reduction and wrong-lesson rate count as success, and what result narrows or stops the project? `egm-design` offers starting points to test: a 70% drop in covered repeats and at least 90% of delivered lessons judged relevant in a sampled audit.
4. **Build or extend.** Compete with Memryzed, build on it, contribute to it, or share a core with `claude-mods/lessons`? Which verified difference justifies the choice?
5. **Client promise.** Must all three clients be equal at release? What is the minimum for a client to count as supported? If timely delivery works in only one client, does the project narrow, change approach or stop?
6. **Approval.** Can an unreviewed, auto-extracted lesson ever reach a live session? `egm-design`, `egm-zoom-out` and `egm-implementation-readiness` favour approval first, at least until error rates are measured. `egm-comprehension` warns that an inbox can be abandoned.
7. **Who sees a delivery.** Does the engineer see every delivery, or only the agent?
8. **Local-only promise.** Is it absolute, or can users opt in to off-machine extraction? If a hosted model wins a comparison, does "local tool" still hold?
9. **Cross-repo boundary.** What does "across repos" mean, and what must never cross, especially between work and personal repos? Which transcripts are excluded by default?
10. **Raw session data.** Reviewers differ. `egm-design` advises not copying raw transcripts by default. `egm-implementation-readiness` leans towards a redacted, time-limited archive. `egm-codebase-details` advises copying what is needed at capture time, because old logs may disappear.
11. **Source of truth.** Are lessons held in repo files, personal files or a private database? Should muninn propose documentation edits even when that reduces its own role?
12. **Stage order.** Does outcome tracking, or at least its logging, move into the first stage? Does the UI stay in the first stage or wait for review volume? `egm-comprehension` recommends moving basic tracking up, and `egm-zoom-out` suggests deferring the UI.
13. **Role of `agents.md`.** Is it a base to trim or background only? `egm-design`, `egm-zoom-out` and `egm-codebase-details` advise against using it as the plan.
14. **Architecture.** Is a long-running process needed, and who owns database migrations?
15. **Public commitments.** Which platforms and client versions are supported? What upgrade guarantee applies before 1.0, and across which surfaces? What must uninstall, purge and rollback each remove? Is a model download of several GB acceptable?
16. **Testing beyond the author.** How will quality be tested beyond one person's habits and private transcripts?

**Checks reviewers proposed before any build.**

1. **Client capability table.** Test by hand, on current versions, each client's triggers, injection, compaction signal, transcript fields and MCP launch directory, with Codex hooks and injection first.
2. **Repeat audit.** Hand-audit two to four weeks of real transcripts. Count repeated instructions and how many a static file would prevent. A crude regex by `egm-codebase-details` matched 20 of 907 prompts in `~/.claude/history.jsonl`, which covers Claude only and is not a baseline.
3. **Delivery replay.** Hand-write 20 to 30 lessons and replay other real transcripts against simple triggers, counting correct, missed and wrong firings. If this performs poorly with hand-picked lessons, automatic extraction will not rescue the idea.
4. **Simple baseline.** Run instruction files plus a run index for two weeks, and measure the repeats that remain. Those remaining repeats are what muninn must justify itself against.
5. **Memryzed read.** Read its full source and run it on the same work. Write one testable claim about what muninn does that Memryzed and native memory do not.
6. **Extraction comparison.** Hand-label about 50 sessions and compare rule-based and local-model precision.
7. **Prior work.** Find out why `claude-mods/lessons` may have been empty, and read any results from the scratch path ending in `lessons-live-proj` under `~/.claude/projects/`. No reviewer opened that path.

**Starting limits suggested by `egm-design`, to test and not treated as settled.**

* One delivery: 300 tokens and at most 3 lessons.
* Automatic delivery per session: 1,000 tokens.
* Repeat firing: once per session, plus once after a confirmed compaction.
* Hook latency: under 100 ms at p95, with a 500 ms timeout, then continue without delivery.
* New candidates: 5 per day.
* Pushed lessons: a soft cap of about 50 active per repo.

**Requirements reviewers said must exist from the first delivery, if the project proceeds.**

* An append-only delivery log covering lesson version, trigger, client, session, match reason, tokens and outcome.
* Per-client status showing last capture, last delivery and unknown formats.
* Redaction before storage, and a true purge across history, indexes, backups and exports.
* A record of where each lesson came from, with no automatic activation of content derived from tool output.
* Hooks that time out and let the session continue.
* One command to pause all delivery.
