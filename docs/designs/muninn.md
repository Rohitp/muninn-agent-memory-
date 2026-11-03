# muninn: Lessons That Carry Across Coding Sessions

*   **Author:** Rohit
*   **Status:** Proposed
*   **Date:** 2026-11-03

--------------------------------------------------------------------------------

## Overview

muninn is a local tool for individual engineers who use coding agents. It reads
their coding sessions, proposes lessons from what happened, and gets the lessons
they keep to the agent at the moment they apply. Engineers can search and edit
those lessons in a UI, and can ask how to run something in any repo.

The author is the first user. The goal is a public release that any engineer can
install, whoever employs them, so muninn makes no assumptions about a company. It
runs on the engineer's machine, and muninn itself sends nothing off it by default.
Lesson text it delivers enters the agent's context, which the agent's model provider
may receive.

This document details the **first version**, built in two stages:

*   **Stage 1, the learner:** reads past logs and proposes lessons with evidence.
*   **Stage 2, use:** delivers kept lessons, answers "how do I run X?", and adds
    the UI.

Later stages are outlined only, because they depend on what the first version
shows.

## The Problem

Coding agents do not reliably carry what they learn from one session to the next,
and engineers pick up the work of repeating it.

*   **Repeated setup instructions.** One of the author's repos needs an access
    token that expires every 8 hours, and a script that takes hours to run. Every
    session, the author has to tell the agent to refresh the token first and to
    keep the laptop awake with `caffeinate`. If the agent skips this, 4 hours of
    runs produce only failures.
*   **Knowledge that is hard to reach.** Finding out how to run something in
    another repo can mean reading through its README, when a single command is all
    that is needed.
*   **Lessons that are lost or do not take effect.** A lesson may never be written
    down. Or it may be written down but not found, loaded and then removed by
    compaction, or present and ignored. Each cause needs a different fix, and
    today nothing shows which one happened.

**Why existing options fall short:**

*   **Instruction files (`CLAUDE.md`, `AGENTS.md`)** do not learn on their own and
    have no search or UI. One file can serve both tools: Claude Code reads `AGENTS.md`
    when there is no `CLAUDE.md`, and Codex reads `AGENTS.md`. A repo that keeps both
    files has to keep them in step by hand.
*   **Built-in memory** belongs to one tool. Claude Code's auto memory is on by
    default, saves corrections, and loads each session and after compaction, so it may
    already handle part of the problem there. Codex Memories is off by default. No way
    to move lessons between the two was found, though this has not been tested.
*   **Memryzed**, the closest tool read so far, stores facts for agents to request.
    Its code has no delivery at the moment of use, no learning from repeats, and no
    check on whether lessons worked. Other memory tools, such as OpenMemory and
    agentmemory, have not been assessed.

**The main risks to this idea:**

*   **Learning may not produce lessons worth keeping.** Most of a session is not a
    lesson. Nobody has yet seen automatic learning produce lessons the author kept:
    the earlier `lessons` mod was not used enough to tell.
*   **Instruction files may be enough.** Setup reminders are mostly stable facts,
    so a line in an instruction file might stop most of them. muninn has to do
    better than that, and this has not been measured.
*   **Demand is unknown.** Nobody other than the author has seen this idea working.
*   **A wrong lesson does harm without anyone noticing.** It can mislead every agent
    that receives it, and the engineer may not see where the behaviour came from.

## Goals

### Stage 1: the learner

*   **Useful first run.** Running one command in a repo gives a list of proposed
    lessons from existing logs, with no account or API key. A local embedding model
    lets it recognise instructions that mean the same thing in different words. The
    model either ships in the package or downloads once with the engineer's consent,
    whichever the spike shows is practical. After that, nothing needs the network.
*   **Claude Code and Codex.** It reads logs from both tools, and can find a lesson
    that shows up across them.
*   **Evidence with every proposal.** Each one shows what was seen, in how many
    sessions, and the quotes behind it. The engineer keeps, edits or rejects it. A
    rejected lesson is not proposed again.
*   **The engineer's control over data.** By default it reads only the repo it is
    run in. Before reading, it says what it found and what it will read. Secrets are
    removed from anything it writes, and one command removes everything it created.
*   **Failures are visible.** An unsupported log format or too few sessions produces
    a clear message, not an empty list that looks like nothing was learned.

### Stage 2: use

*   **The token and `caffeinate` lessons take effect.** After the engineer keeps
    them, those reminders no longer need repeating, in Claude Code or Codex.
*   **Approval by risk.** A lesson made from the engineer's own repeated words goes live
    after it has been shown at review and not rejected, and is shown as not yet reviewed.
    This can be turned off. Nothing goes live unseen.
*   **Delivery.** A live lesson reaches the agent at session start if marked always-on, or
    on a prompt containing a keyword the engineer chose. It returns after compaction where
    the tool allows it. Where a tool cannot do this, the README and `muninn status` say so.
*   **"How do I run X?"** The engineer gets the command, its source and its date,
    without opening a README in another repo.
*   **A UI for what has been learned.** The engineer can browse, search and edit
    lessons, and see what was delivered to which agent. Its visual design will come
    from Claude Design later.
*   **Every delivery is logged from the start.** Past deliveries cannot be rebuilt,
    and later stages depend on this record.

### Success measures

*   **Lessons:** the share of lessons shown that the engineer keeps.
*   **Token check:** whether an agent refreshes the token unprompted, compared with an
    instruction line. This is the deciding check. See the gates.
*   **Repeats:** sessions with a repeat per 10 sessions, per lesson and tool, compared with a
    baseline from before delivery.
*   **Wrong or irrelevant lessons:** the share of delivered lessons the author judges relevant,
    and correct, reviewing all of them.
*   **Adoption:** what a few other engineers report after running it.

### Later stages (outline only)

Each stage starts only after its own design pass.

*   **Check results:** whether a lesson worked, why a mistake repeated, and whether
    the fix belongs in a test, a hook or a tool description instead of memory.
*   **Long work:** organised views that keep the picture of a large piece of work
    across threads, like the one that was missing on Chargebee multi-term estimates.
*   **Ask and analyse:** asking an AI about learnings, and tracking which model did
    what work and at what cost.

## Non-Goals

*   **Team or shared memory.** muninn serves individuals on their own machines.
*   **A hosted version.**
*   **Agents inside products.** The focus is coding agents. This can be revisited.
*   **Replacing instruction files.** Stable rules can stay in them.
*   **Cursor in the learner.** Cursor logs have no tool output, working directory,
    branch, model or token data. Cursor can be added later.
*   **Building on `claude-mods`.** It stays a separate side project, though its
    ideas can be reused.
*   **Agents acting on their own.** A lesson tells the agent something. muninn does
    not refresh a token or run a command itself.
*   **The remaining tools from `docs/archive/original-build-spec.md` in the first version:** `understand`, `check`,
    the code graph, blast radius, leases, branch handoff and merge promotion.

## Open Questions

*   **Target numbers:** The gates in the Detailed Implementation Plan use proposed numbers with
    no evidence behind them yet. They are written down before the run they judge, and any change
    is logged with its reason.
*   **Crossing repos:** The first version lets agents search all repos, with labelled
    results. The author chose this provisionally and expects to iterate. What should
    the default be for other engineers, whose logs may mix employers?
*   **Searching by meaning in hooks:** Automatic delivery uses literal triggers only, because no
    background program holds the model. How many real cases does this miss? The spike measures this.
*   **Export to instruction files:** Should kept lessons also be writable to
    `CLAUDE.md` or `AGENTS.md`? Doing so changes files that a team may share.
*   **Cursor in Stage 2:** Does Cursor get delivery and search in the first version?
    It documents no way to add context when a prompt is submitted or after compaction.
*   **Local LLM:** Is an LLM needed for extraction at all? If so, does a small local
    model do better than rules on real sessions?
*   **Free or paid:** Is muninn free, open source, paid, or a mix?
*   **Package name:** `muninn` and `muninn-cli` are both taken on npm (checked
    2026-11-03), so the package needs a scoped or different name. The command can still
    be `muninn`.

## Critical User Journeys (CUJs)

### CUJ 1: First run on a repo

*   **Given**: An engineer has used Claude Code or Codex in a repo. muninn is not yet
    set up.
*   **When**: They run `muninn learn` inside the repo.
*   **Then**: muninn says which logs it found and what it will read, and gets the model
    if needed, asking first. It then lists proposed lessons with evidence. If there are
    too few sessions, it says so and offers to widen the scope.

### CUJ 2: The token lesson stops the repeat

*   **Given**: The engineer told agents to refresh the token in 3 or more sessions.
*   **When**: A new session starts in that repo and the engineer asks for the script run.
*   **Then**: The agent receives the lesson without being told, before the run where the
    tool allows it. The delivery is logged and visible in the UI.

### CUJ 3: "How do I run X?" from another repo

*   **Given**: Repo B has been scanned, and the engineer is working elsewhere.
*   **When**: They ask through `muninn ask` or the UI, or their agent runs `muninn ask`.
*   **Then**: They get the command, the repo, its source and the date last seen, with a
    warning if the source is old.

### CUJ 4: Correcting a wrong lesson

*   **Given**: An agent behaved strangely because of a lesson.
*   **When**: The engineer opens the UI, finds the delivery, and edits or retires the
    lesson.
*   **Then**: The change applies to the next delivery, in every tool. A retired lesson is
    not proposed again. Each edit is kept as a version.

### CUJ 5: Something breaks

*   **Given**: A client update changed its log format, or a hook stopped running.
*   **When**: The engineer runs `muninn status`.
*   **Then**: It shows the last capture and last delivery per tool, and names the problem.

## Technical Plan (Architecture)

### Decisions this plan rests on

| Decision | Choice | Status |
| --- | --- | --- |
| Storage | libSQL file with vector columns, in the first build | Author, confirmed in review. Fallback is plain SQLite if the spike fails. |
| Embedding model | Local; shipped or downloaded once | Author. The spike decides which. |
| Background program | None | Author |
| Approval | Own repeated words go live after being shown; nothing goes live unseen | Author, narrowed in review |
| Across repos | Agents search all repos, labelled | Author, provisional |
| Tools | Claude Code and Codex | Author, for the learner. Applied here to Stage 2 too. |
| Extraction | Rules plus embeddings, no LLM | Proposed in this draft |
| Language | TypeScript on Node 22, published to npm | Proposed in this draft. `agents.md` says Node 20+. |

### Overview

muninn is a command-line program with no long-running process. Each entry point opens
the same store, does its work and exits. The exception is the UI, which runs only while it
is open.

```text
 Claude Code logs ─┐
                   ├─► log readers ─► signal detectors ─► candidate lessons
 Codex logs ───────┘                  (with embeddings)          │
                                                                 ▼
 repo manifests, logs ────► command index ─────────►  store: one libSQL file
                                                      ~/.muninn/muninn.db
                                                         ▲       ▲       ▲
                  ┌──────────────────────────────────────┘       │       │
                  │                      ┌───────────────────────┘       │
              muninn CLI              muninn ui                     muninn hook
           (learn, ask, status)     (browse, edit)                 (trigger match
                  │                                                 and delivery)
                  │                                                      │
                  └──────────────────► agent ◄───────────────────────────┘
```

### Stage 1: the learner

**Log readers.** One reader for each tool turns its log into a common list of events:
session, time, working directory, branch, what the engineer typed, tool calls and tool
results. Both vendors say their formats are not stable, so each reader checks the
structure and counts anything it does not recognise. Those counts appear in the output.
Readers are tested against fixtures that copy real record structure with invented content, with one
added per observed format change.

**Which repo a session belongs to.** The reader takes the working directory from the log
and asks git for the repo. Worktrees resolve to one repo through the shared git folder.
The repo's identity is its cleaned-up `origin` URL, or its path if it has no remote.
Sessions whose folder no longer exists are counted and reported.

**Signal.** The first version looks for repeated instructions: what the engineer typed is split
into sentences and embedded. Sentences with similar meaning, in at least 3 different sessions, form
a candidate. Pasted blocks are excluded, because the engineer did not write them. Corrections and
failure-then-fix signals are deferred until the gate shows a gap. The thresholds are starting values
to be tuned on real logs.

**Candidates.** Each candidate holds the wording, the evidence and a source (`own_words`). A repeated
instruction uses the engineer's own words as the lesson text. A new candidate similar to an existing
lesson adds evidence to it. One near-identical to a rejected lesson is dropped. Candidates are never
merged automatically, because similar text can have the opposite meaning, such as "use X" and
"never use X".

**Triggers.** A lesson reaches agents automatically if the engineer marks it always-on or gives it a
literal keyword. muninn does not generate triggers in the first version, because no example needs one
and one proposed rule picked the wrong command. The spike measures whether richer triggers are worth a
later design. A lesson with neither is searchable only, and `muninn learn` warns about this.

**Review.** `muninn learn` lists candidates in the terminal, and the engineer keeps, edits or
rejects each one, or leaves it for later. Output is limited to the top 10, because a stranger who sees
junk will not run it twice. The same run records the repeat rates that become the baseline.

**Privacy.** Secrets are removed before anything is stored, on a best-effort basis, using known key
patterns. Only short evidence quotes are stored and raw logs are not copied. This
means evidence outlives Claude Code's 30-day log retention, and the store never holds a full
transcript. muninn sends nothing over the network except the optional one-time model download.

### Stage 2: use

**Delivery.** `muninn install` adds hooks to Claude Code and Codex, keeping any existing
hooks, and shows what it changed. Codex requires each hook to be trusted, so install explains this.
Each hook starts `muninn hook`, which matches literal triggers and returns text to the agent:

| Moment | Hook | What is delivered |
| --- | --- | --- |
| Session start | `SessionStart` | Always-on lessons for this repo, plus global ones |
| After compaction | `SessionStart` with `compact` | Always-on lessons. Triggered lessons fire again on their next match |
| Prompt submitted | `UserPromptSubmit` | Lessons whose keyword triggers match the prompt |

Claude Code documents that `PreToolUse` text arrives with the tool result, too late to stop
that call. Refusing the call with a reason may be the only way to intervene before a long
run. This plan does not build it. The spike records the behaviour, and any refusal path gets its
own design pass.

**Limits on delivery.** Starting values are at most 3 lessons and 300 tokens per delivery,
1,000 tokens per session, and each lesson once per session, reset by compaction. A hook
gives up after 500 ms and lets the session continue without delivery, and logs that it did, if the
store can be reached.
Any hook failure must never interrupt the agent. `muninn pause` stops all delivery.

**Delivery log.** Every delivery, skip and timeout is recorded: lesson version, trigger, tool,
session, reason and tokens. The log is append-only. Later stages rely on it, and it is what
the UI shows. It can only prove what muninn sent. It cannot prove what stayed in context.

**Approval.** An `own_words` lesson goes live after being shown at review and not rejected, marked as
not yet reviewed, and this can be turned off. Lessons never shown stay proposed. Lessons added with
`muninn add` are live and reviewed. Lessons edited by a person cannot be overwritten by a later scan.

**Search.** Search combines keyword matching with embeddings, and each result shows its repo
and date. `muninn ask` loads the model each time, which the spike measures. Vague questions rely on
two steps: embeddings produce a shortlist, and the agent reading it decides what is relevant. muninn
itself does not run an LLM.

**Across repos.** Agents' searches cover all scanned repos, and results are labelled by repo.
Automatic delivery only uses the current repo and global lessons. A setting limits agent search
to the current repo, and individual repos can be excluded. Cross-repo results are logged, so the
choice can be judged and revised.

**"How do I run X?"** A command index is built from `package.json` scripts and Makefiles, plus commands
seen to succeed in logs. Each entry keeps its source and the date last seen. Answers show both, because
a source can be wrong, and muninn never runs the command.

**UI.** `muninn ui` starts a local web page, which stops when closed. It has lessons (browse, search,
edit, retire, approve), the delivery log, and status per tool. It accepts connections from this
machine only, needs a random token, and checks the `Host` header to block requests from web pages.
All lesson text is escaped, since it comes from logs. The layout is functional, and Claude Design will
design the visuals later.

### Data model

Every table sits in one file, `~/.muninn/muninn.db`, whose folder only the owner can read. Multiple
short-lived processes write to it, relying on write-ahead logging and a wait on locks. The spike must
confirm libSQL handles this.

Migration 001 in the Detailed Implementation Plan gives the tables and columns.

Status is one of `proposed`, `live`, `rejected` or `retired`. Rejected lessons are kept so they are not
proposed again. Every upgrade backs up the file first and applies numbered migrations.
`muninn export` writes all lessons to JSONL, and `muninn purge` removes muninn's hooks and deletes the
store, backups, model and settings.

### Commands

`learn` (`--all-repos` to widen) · `add` · `ask` · `list` · `show` · `approve` · `edit` · `retire` · `report` ·
`ui` · `hook` · `install` · `uninstall` · `pause` / `resume` · `status` · `export` · `purge`

### What the spike must prove before Stage 1 code

The spike and baseline are in Step 0 of the Detailed Implementation Plan. They run before any product
code, including the client checks that the delivery design depends on.

## Risks and Mitigations

| Risk | Mitigation or decision |
| --- | --- |
| Learning does not produce lessons worth keeping | The keep-rate gate stops the build before Stage 2 |
| Instruction files or built-in memory are enough | The Step 0 trial runs before any build, and records whether auto memory held the lesson. The author decides what happens if the line works |
| Demand is unknown | A few other engineers report back after Stage 1. Accepted: this will not prove demand |
| A wrong or situational lesson misleads agents | Nothing goes live unseen. The delivery log shows what was sent, and `edit`, `retire` and `pause` take effect on the next delivery |
| Pasted or scripted text is mistaken for the engineer's words | Readers return only typed text, with paste and non-interactive rules. The spike checks what logs mark. Lessons are shown before going live |
| A secret reaches the store or a delivered lesson | Pattern-based redaction, which is best effort. The store is readable only by its owner, and `purge` removes it. Accepted: some secrets may get through |
| One employer's lessons reach an agent working for another | Automatic delivery stays within the repo unless a lesson is marked global. Agent search can be limited, and repos excluded. The default for other engineers is an Open Question |
| A client update breaks a log format, or hooks stop running | Readers count unknown structures, and `status` flags them, along with silent hooks |
| Client behaviour differs from its documentation | The client checks run in Step 0, and each has a stated result if it fails |

Growth limits for the store and delivery log are not set, because the first version serves one engineer's
lessons. First-run time on a real repo has a limit in the Step 0 gate.

## Alternatives Considered

### Rejected by the author

#### Instruction files as the product

*   **Pros**: Nothing to build. Stable facts such as the token reminder may be served well.
*   **Cons**: No learning, search or UI. One `AGENTS.md` can serve both tools, but separate files
    must be kept in step by hand.
*   **Reason for Rejection**: Rejected by author: the author wants search, a UI and movement
    across agents. How many repeats these files alone would stop has not been measured, so
    they remain the baseline muninn is compared with.

#### Designing for agents inside products

*   **Pros**: A larger possible use of the same ideas.
*   **Cons**: Repo and branch scope mean little there, and customer data raises privacy issues.
*   **Reason for Rejection**: Rejected by author for now: the core problem is coding agents.

#### Building on `claude-mods/lessons`

*   **Pros**: Working detection of failures and loops, priced rules, and tracking of whether a
    failure came back.
*   **Cons**: Claude-only, built on an early-access API, and never used enough to be tested.
*   **Reason for Rejection**: Rejected by author: it stays a separate, lightweight side project.
    Its ideas can still be reused.

#### Markdown files with a rebuildable index

*   **Pros**: Lessons can be read and diffed, and they survive database problems. Many format
    changes become a reindex.
*   **Cons**: Files and index must stay in step, and concurrent edits are harder.
*   **Reason for Rejection**: Rejected by author: the author chose one libSQL store with vectors,
    because making sense of vague or related things is where the product should stand out.
    This leaves hand-edited lessons dependent on migrations, which backups and export address.

#### Keyword search only, without embeddings

*   **Pros**: No model and a lighter install.
*   **Cons**: Misses instructions that mean the same thing in different words.
*   **Reason for Rejection**: Rejected by author for the same reason. Whether embeddings catch
    more on real data has not been measured, and the spike tests it.

#### A background program holding the model

*   **Pros**: Hooks could search by meaning, and there is a single writer to the store.
*   **Cons**: Crashes, port conflicts and version mismatches could stop delivery without notice.
*   **Reason for Rejection**: Rejected by author: fewer moving parts. The cost is that automatic
    delivery uses simple triggers only.

#### Always approving, or going live by default

*   **Pros**: Always approving is the safest. Going live by default takes the least work.
*   **Cons**: Review can become a chore nobody does, in which case nothing gets delivered. Going
    live by default lets text from web pages or tool output reach agents as guidance.
*   **Reason for Rejection**: Rejected by author in favour of approving risky lessons only.

#### Other default scopes for the learner

*   **Pros**: Picking from a list, or reading all repos, finds cross-repo repeats on the first run.
*   **Cons**: Picking adds a step. Reading everything may process employer logs without any thought.
*   **Reason for Rejection**: Rejected by author: reading the current repo is the simplest to
    understand, and widening is an explicit choice.

#### Other first tools for the learner

*   **Pros**: Claude Code alone is the fastest test. All three tools, using only what the engineer
    typed, would match the cross-agent goal.
*   **Cons**: One tool proves nothing cross-agent. Using all three loses failure signals, because
    Cursor logs have no tool output.
*   **Reason for Rejection**: Rejected by author: Claude Code and Codex both have rich logs.

### Not chosen, and may be revisited

#### Relying on built-in memory

*   **Pros**: Nothing to build. Claude Code's auto memory is on by default, saves corrections, and survives
    compaction.
*   **Cons**: It belongs to one tool, with no shared view across tools, no evidence behind a lesson, and no
    record of what was delivered.
*   **Status**: Not assessed on real use. The Step 0 trial records whether it already holds the token lesson.

#### Generated triggers

*   **Pros**: Could deliver at a specific moment with no work from the engineer.
*   **Cons**: Needs an algorithm no example yet justifies, and the proposed rule could pick the refresh
    command instead of the script. Keywords from the instruction fire only when it is repeated.
*   **Status**: Deferred in review. The spike reports how many instructions need a specific moment. The
    cost is that the token lesson is delivered much as an instruction line would be.

#### An MCP server

*   **Pros**: Agents get a named tool, and a long-lived server could hold the model between searches.
*   **Cons**: Process lifetime and project detection are untested, and a wrong answer could cross repos.
*   **Status**: Deferred in review. Agents run `muninn ask` from the shell, which the spike tests.

#### Other rules for crossing repos

*   **Pros**: Repo groups keep work knowledge apart. Limiting agents to the current repo is simple
    to explain.
*   **Cons**: Groups add setup. Limiting agents blocks a command from a sibling repo.
*   **Status**: The author chose labelled search across repos provisionally, and expects to iterate.
    The setting in the Technical Plan keeps this reversible.

#### Writing kept lessons to instruction files

*   **Pros**: Needs no delivery engine, is easy to read and undo, and works in each tool.
*   **Cons**: Always-on context that cannot target a moment, and it may change files a team shares.
*   **Status**: Not part of the plan. It remains an Open Question, as an export option and not as
    the product.

#### An LLM for extraction

*   **Pros**: Could catch lessons nobody stated, and could write better triggers.
*   **Cons**: A small model may be poor at this judgement, and a hosted one sends data off the machine.
*   **Status**: Not in the first version, as proposed in this draft. It can be added if it beats rules
    on a hand-labelled set of real sessions. The author is open to packaging one.

#### Extending Memryzed

*   **Pros**: Reuses capture, storage, redaction and retrieval plumbing, under Apache-2.0.
*   **Cons**: It is written in Rust, captures only Claude Code among muninn's two first tools, and has
    a single author with no commits for 137 days. The code read also found bugs in its foundation.
    Its code has none of muninn's main differences, so they would be new code either way.
*   **Status**: This draft builds separately, based on `docs/checks/memryzed-read.md`. The author has
    not ruled on this directly. The read was static and nothing was run.

#### Cutting the later stages

*   **Pros**: The engineer's own agent could query the store, and cost tracking is unrelated to lessons.
*   **Cons**: Removes parts of the roadmap the author wants.
*   **Status**: Kept in outline. Each starts only after its own design pass.

--------------------------------------------------------------------------------

## Non-Functional Requirements

*   **Security and privacy:** muninn itself sends nothing off the machine except the optional model
    download. Delivered lesson text enters the agent's context, which its model provider may receive. The
store holds redacted quotes, lesson text and logged commands, and only its owner can read it. Lesson
    text from logs is escaped in the UI, and only `live` lessons reach agents. Command results are labelled
    by source, as data, and the agent decides whether to use them. `npx` instructions pin an exact version.
    `muninn purge` removes muninn's hooks, lessons, evidence, history, backups, model and settings.
*   **Performance:** Hooks give up after 500 ms and never block the agent. The aim is under 100 ms at
    p95, to be measured. First-run time is measured in the spike and reported in `docs/spike.md`.
*   **Token use:** Delivery limits are listed in the Technical Plan. Each delivery's tokens are logged,
    because injected text is re-read on every later turn of a session.
*   **Rollout and rollback:** `muninn pause` stops delivery at once. `muninn uninstall` removes muninn's hooks,
    keeping the store. Each upgrade backs up the store before migrating. The data format
    may change before 1.0, but every change has a migration.
*   **Platforms:** macOS and Linux for the first version. Windows is not supported yet, and paths must
    not rule it out.

--------------------------------------------------------------------------------

### Additional Resources

*   `concepts_brief.md`: brainstorm output, reviewer objections and decisions.
*   `docs/checks/client-capabilities.md`: what each tool documents, and 19 hands-on tests still to run.
*   `docs/checks/memryzed-read.md`: static read of Memryzed's source.
*   `~/projects/claude-mods`: earlier `lessons` and `anchor` mods, kept separate.

### Future Improvements

*   **Check results, long work, ask and analyse:** the later stages under Goals.
*   **Cursor:** delivery and search, once hands-on tests show what it allows.
*   **Other memory tools:** assess OpenMemory and agentmemory before public release.
*   **MCP server:** add if `muninn ask` proves too slow or agents do not use it.
*   **More signals and sources:** corrections, failure-then-fix, and CI and README commands.
*   **Richer triggers:** a design pass if the spike shows many instructions need a specific moment.

--------------------------------------------------------------------------------

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
