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
*   **Lessons nobody stated.** A command keeps failing the same way, or the engineer
    keeps correcting the agent on the same thing, and nothing records it. The engineer
    may not know it is a pattern. This is where muninn can do what a line in an
    instruction file cannot.
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
    the earlier `lessons` mod was not used enough to tell. A rough search of three of the
    author's repos on 2026-11-03 found 79 sentences or close variants typed in 3 or more
    sessions. 59 had identical wording, which suggests copied text, and many of the rest
    were conversation. Repeats alone may not be enough.
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
*   **Lessons nobody stated.** Besides repeated instructions, it looks for corrections,
    failures that were later fixed, and mistakes that came back across sessions.
*   **Evidence with every proposal.** Each one shows what was seen, in how many
    sessions, and the quotes behind it. The engineer keeps, edits or rejects it. A
    rejected lesson is not proposed again.
*   **The engineer's control over data.** By default it reads only the repo it is
    run in. Before reading, it says what it found and what it will read. Secrets are
    removed from anything it writes, and one command removes everything it created.
*   **Failures are visible.** An unsupported log format or too few sessions produces
    a clear message, not an empty list that looks like nothing was learned.

### Stage 2: use

*   **Kept lessons take effect.** After the engineer keeps a lesson, the agent follows it
    without being told, in Claude Code or Codex.
*   **Approval.** A lesson goes live only when the engineer keeps it, edits it or adds it by hand.
    Every lesson needs a route: always-on or a keyword.
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

*   **Lessons:** the share of lessons shown that the engineer keeps and says they did not already
    know or had not written down. Keeping something they could have written themselves does not count.
*   **Behaviour check:** whether an agent follows kept lessons unprompted, compared with an
    instruction line. This is the deciding check. See the gates.
*   **Repeats:** for lessons from repeated instructions, sessions with a repeat per 10 sessions, per
    lesson and tool, compared with a baseline from before delivery.
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
*   **Local LLM:** Can rules turn "this failed, then this worked" into a lesson worth reading? The
    signal check in Step 0 tests this. If they cannot, is an LLM added, and does a small local
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

### CUJ 2: A kept lesson stops the repeat

*   **Given**: The engineer kept a lesson, such as refreshing a token before a long run.
*   **When**: A new session starts in that repo and the engineer asks for that work.
*   **Then**: The agent receives the lesson without being told, at session start or on a matching
    prompt, where the tool allows it. The delivery is logged and visible in the UI.

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

### CUJ 6: A lesson nobody stated

*   **Given**: A command in a repo kept failing the same way across sessions before a change fixed it.
*   **When**: The engineer runs `muninn learn`.
*   **Then**: It proposes a lesson, with the failure and the fix as evidence, marked as inferred. The
    engineer says whether it was news to them, then keeps, edits or rejects it.

## Technical Plan (Architecture)

### Decisions this plan rests on

| Decision | Choice | Status |
| --- | --- | --- |
| Storage | libSQL file with vector columns, in the first build | Author, confirmed in review. Fallback is plain SQLite if the spike fails. |
| Embedding model | Local; shipped or downloaded once | Author. The spike decides which. |
| Background program | None | Author |
| Approval | Lessons go live only by keeping, editing or adding | Author chose risk-based approval. Changed in review, because without generated triggers an unreviewed lesson has no route to an agent. |
| Across repos | Agents search all repos, labelled | Author, provisional |
| Tools | Claude Code and Codex | Author, for the learner. Applied here to Stage 2 too. |
| Extraction | Rules plus embeddings, no LLM | Proposed in this draft |
| Language | TypeScript on Node 22, published to npm | Proposed in this draft. `docs/archive/original-build-spec.md` says Node 20+. |

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

**Signals.** Rules look for four things. All thresholds are starting values, to be tuned on real logs.

*   **Repeated instructions:** what the engineer typed is split into sentences and embedded. Sentences
    with similar meaning form a candidate if they appear on at least 3 separate days, or in at least 3
    sessions with at least 2 different wordings. This keeps resumed sessions and copied text from
    counting as repeats. Conversation, questions, pasted blocks and agent answers pasted between tools
    are excluded.
*   **Corrections:** an engineer's message right after an agent action that disagrees with or redirects
    it, such as "no", "don't" or "use X instead".
*   **Failure then fix:** the same command failing more than once, then succeeding with a change. This
    relies on tool output.
*   **Mistakes that came back:** the same command and error in at least 3 sessions. This also relies on
    tool output.

Repeats return what the engineer already says. The other three are how muninn can find what they do not.

**Candidates.** Each candidate holds the wording, the evidence and a source (`own_words` or `inferred`). A
repeated instruction uses the engineer's own words as the lesson text. The other signals build text from
what happened, such as "`X` failed with Y, and worked after Z", with no LLM. Whether that reads well enough
is what the Step 0 signal check tests. A new candidate similar to an existing lesson adds evidence to it. One
near-identical to a rejected lesson is dropped. Candidates are never merged automatically, because similar
text can have the opposite meaning, such as "use X" and "never use X".

**Triggers.** A lesson reaches agents automatically if the engineer marks it always-on or gives it a
literal keyword. muninn does not generate triggers in the first version, because no example needs one
and one proposed rule picked the wrong command. The spike measures whether richer triggers are worth a
later design. A lesson with neither is searchable only, and `muninn learn` warns about this.

**Review.** `muninn learn` lists candidates in the terminal, and the engineer keeps, edits or
rejects each one, or leaves it for later, and says whether a kept lesson was news to them. Output is limited to the top 10, because a stranger who sees
junk will not run it twice. The same run records the repeat rates that become the baseline for repeated-instruction lessons.

**Privacy.** Secrets are removed before anything is stored, on a best-effort basis, using known key
patterns. Readers see typed text, agent text and tool output, but only short redacted evidence quotes are stored, and raw logs are not copied. This
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

**Approval.** A lesson goes live when the engineer keeps it, edits it or adds it with `muninn add`. Lessons
left for later stay proposed and are shown again. Lessons edited by a person cannot be overwritten by a later
scan.

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
edit, retire), the delivery log, and status per tool. It accepts connections from this
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

`learn` (`--all-repos` to widen) · `add` · `ask` · `list` · `show` · `edit` · `retire` · `report` ·
`ui` · `hook` · `install` · `uninstall` · `pause` / `resume` · `status` · `export` · `purge`

### What the spike must prove before Stage 1 code

The spike and baseline are in Step 0 of the Detailed Implementation Plan. They run before any product
code, including the client checks that the delivery design depends on.

## Risks and Mitigations

| Risk | Mitigation or decision |
| --- | --- |
| Learning does not produce lessons worth keeping | The Step 0 signal check runs the rules on real logs before any product code. The keep-rate gate stops the build before Stage 2 |
| Rules cannot turn what happened into a readable lesson | The signal check tests this. If it fails, the author decides whether to add an LLM, change the signals or narrow the product |
| Instruction files or built-in memory are enough | The keep rate counts only lessons the engineer did not already know or had not written down. The delivery gate compares chosen lessons with an instruction line, and records whether auto memory held them |
| Demand is unknown | A few other engineers report back after Stage 1. Accepted: this will not prove demand |
| A wrong or situational lesson misleads agents | Nothing goes live without a decision. The delivery log shows what was sent, and `edit`, `retire` and `pause` take effect on the next delivery |
| Pasted or scripted text is mistaken for the engineer's words | Readers return only typed text, with paste and non-interactive rules. The spike checks what logs mark. The engineer decides on every lesson |
| Review becomes a chore, so nothing gets delivered | `learn` shows 10 lessons at a time. Accepted for the first version |
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
*   **Status**: Not assessed on real use. The delivery gate records whether it already holds the chosen lessons.

#### Always approving, or going live by default

*   **Pros**: Always approving is the safest. Going live by default takes the least work.
*   **Cons**: Review can become a chore nobody does, in which case nothing gets delivered. Going
    live by default lets text from web pages or tool output reach agents as guidance.
*   **Status**: The author rejected always approving in favour of approving risky lessons only. The first
    version does approve everything, because of the cut to generated triggers. The cost is that review can
    become a chore. Revisit with richer triggers.

#### Generated triggers

*   **Pros**: Could deliver at a specific moment with no work from the engineer.
*   **Cons**: Needs an algorithm no example yet justifies, and the proposed rule could pick the refresh
    command instead of the script. Keywords from the instruction fire only when it is repeated.
*   **Status**: Deferred in review. The spike reports how many instructions need a specific moment. The
    cost is that a lesson is delivered much as an instruction line would be.

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
*   **More sources:** CI and README commands.
*   **Richer triggers:** a design pass if the spike shows many instructions need a specific moment.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

Work happens in order, and each step ends at a gate. Gate numbers are proposed. They are written down before the run they judge, and any change is logged in `docs/devlog.md` with its reason. Files are relative to the repo root. The project is a single npm package using pnpm, TypeScript and Vitest, with zod for validating inputs.

### Step 0: Clean up, baseline and spike

Do this first, before anything below: the author sets `cleanupPeriodDays` to 365 in Claude Code and leaves it there until the delivery gate has run, so evidence does not expire. Afterwards the author decides whether to restore it.

Spike scripts are throwaway, and they run with `tsx`. Real-log inputs and copies stay in `~/.muninn-spike/`, outside the repo. That folder holds raw logs, so the author deletes it after the delivery gate.

Gates in this plan are ordered: the first row that matches applies. With this few runs, they support judgement. They are not statistical tests.

#### 1. `agents.md` (Move to `docs/archive/original-build-spec.md`)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Move the file and add a note at the end, so its line numbers stay the same, saying this design replaces it. On a macOS disk that ignores case, Codex may read `agents.md` as its instructions file, and Claude Code reads `AGENTS.md` when no `CLAUDE.md` exists. Either could follow an outdated build spec with the name `amem`. Whether that happens has not been tested. Update this design's own references to the file. Dated records (`concepts_brief.md`, `docs/checks/`, existing devlog entries) keep theirs.

#### 2. `docs/implementation-plan.md` and `docs/devlog.md` (Modify)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: In the tracker, replace the phases, Quality bar and dogfood milestone with the steps here, and remove its references to `agents.md`. In the devlog, change the header at lines 4-7 so it no longer promises migration through `remember` at the end of Phase 1. Log every gate result in the devlog from this step on.

#### 3. `design_draft.md` (Delete)

*   **Type / Scope**: Working file.
*   **Proposed Changes**: Delete it. It is an earlier version of this design, and it stays available in git history at commit `a7912f5`.

#### 4. `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `scripts/copy-assets.mjs` (Create)

*   **Type / Scope**: Build configuration.
*   **Proposed Changes**: Package with the working name `muninn-preview`, which is not published. A `muninn` command at `dist/cli.js`, Node 22 or later, and `files` listing `dist`. Dependencies: `@libsql/client`, `@huggingface/transformers` and `zod`. Dev dependencies: `typescript`, `@types/node`, `vitest` and `tsx`. Scripts: `build` (`tsc`, then `copy-assets.mjs`, which copies `src/store/migrations/*.sql` and `src/ui/public/*` into `dist/` when they exist), `test` (`vitest run --passWithNoTests`) and `typecheck` (`tsc --noEmit`). `tsconfig.json` uses `rootDir: src` and includes only `src`. Ignore build output and any real logs. Adding another dependency needs a line in the devlog.

#### 5. `scripts/spike/save-logs.ts` (Create)

*   **Type / Scope**: Throwaway script.
*   **Proposed Changes**: Copies the logs for the 2 author repos the gates use, one for tuning and one held out for the Stage 1 gate, to `~/.muninn-spike/logs/claude/projects/` and `~/.muninn-spike/logs/codex/sessions/`, matching each client's own folders. `MUNINN_LOG_ROOT` uses the same layout, so gate runs of `learn` read these fixed copies. Record the date and the number of sessions per repo and tool in `docs/spike.md`. Repo names and log content are not committed.

#### 6. `scripts/spike/signal-check.ts` (Create)

*   **Type / Scope**: Throwaway script, and the first test of the product's main bet.
*   **Proposed Changes**: Runs the four signals with the rules in items 18-19 on the tuning repo from item 5, including the counting rules and filters, and writes up to 30 candidates with their evidence to `~/.muninn-spike/signal-check.jsonl`. It reports whether each client's logs record exit status and failed-call output. If exit status is not recorded, it uses output patterns and reports how reliable they look. The author labels each candidate `new` (useful, and not already known or written down), `known` (useful, but already known or written down), `unclear` (might be useful, but the text does not say enough) or `junk`. Only counts per signal and label go in `docs/spike.md`.

#### 7. `scripts/spike/client-hook.mjs`, `docs/checks/client-live-tests.md`, `test/fixtures/hooks/` (Create)

*   **Type / Scope**: Throwaway script, documentation and test data.
*   **Proposed Changes**: Check IDs M1-M5 are new here. Numbered tests refer to `docs/checks/client-capabilities.md`, and a letter after a number means this plan narrows that test. Use a throwaway project, a hook that returns a unique made-up fact, and hooks set at user level, as `install` will. Clients: Claude Code 2.1.317, Codex CLI 0.133.0, the desktop app's 0.155 build, the current npm release of Codex, run without replacing the installed CLI, and Cursor 3.25.9 for test 16a only. Run test 15 first, because an untrusted Codex hook would look like a failed delivery. Each pass-or-fail check runs in 2 fresh sessions, and both must pass.

| Pass-or-fail check | Passes if | If it fails |
|---|---|---|
| M1: `SessionStart` at session start | The model repeats the fact on the first turn | No session-start delivery on that client or build |
| M2: `UserPromptSubmit` | The model repeats the fact in that turn | No keyword delivery on that client or build |
| Test 6: `SessionStart` with `compact` | The model repeats the fact after forced compaction. Record which turn | Restore is not promised there, and the README says so |
| M4a: agent runs a read-only local command from the project directory | The agent gets its output. An approval prompt is allowed, and recorded | `muninn ask` is for people only on that client. Agent search returns in a design pass with tests 9 and 10 |
| M4b: that command writes under `MUNINN_HOME` | The file is written | `ask` still answers, and skips `search_log` when a write fails |
| M5: bad hook behaviour (empty output, invalid JSON, non-zero exit, killed by the client's timeout) | The session continues normally in all four cases | Bring this to the author: the hook's failure design changes for that client |

| Recording | What to record | What it decides |
|---|---|---|
| Test 15: Codex trust | What the user sees when a hook is added and changed, and whether an untrusted hook is silent | What `install` and `status` say |
| M3: where hook text appears | The record type holding the fact in each transcript, or that it appears nowhere | Which records readers exclude. If it appears nowhere, nothing needs excluding |
| Hook config | The config file each client reads, including whether the app and CLI share one, the entry format, and timeout units and minimum | The entries `install` writes |
| Test 16a: Cursor import | Whether a hook in `~/.claude/settings.json` runs in Cursor, whether it also runs twice with one in `~/.cursor/hooks.json`, whether its output reaches the model, and which input fields it gets | How Cursor is detected. If no signal exists, the README says hooks installed for Claude Code also deliver in Cursor |
| Test 17a: hook delay | With a hook on `UserPromptSubmit` sleeping 100, 200 and 500 ms, the longest delay the author does not notice | Sets `hookLimitMs`, up to 500 ms. If it is below the latency result in item 8, bring this to the author |
| Test 3a: pre-tool timing, two clients | The timing, and whether deny-with-reason stops a call | No code follows. Any refusal path needs its own design pass |
| Test 5: subagents | Whether text reaches subagents, and whether their tool calls fire hooks | Recorded as a limitation |
| Test 12a, part of test 13: the engineer's own `claude -p` and `codex exec` runs | Whether hooks fire, and how the transcripts are marked | Whether hooks and readers need to skip non-interactive runs |

Tests 1, 2, 7, 8, 11 and 19 wait for any decision on Cursor. Test 4 does not apply at a 300-token limit. Tests 9 and 10 wait for MCP. Test 14 and the rest of test 13 do not apply, because muninn starts no client. Test 18 waits for a release, and unknown-structure counts report format changes in the meantime.

Save observed hook input and accepted output for each client, event and source seen as files in `test/fixtures/hooks/`, including `compact` and any Cursor input. Expected input fields, to be confirmed here: `session_id`, `cwd`, `hook_event_name`, `transcript_path`, plus `prompt` on `UserPromptSubmit` and `source` on `SessionStart`. Expected output: `{"hookSpecificOutput":{"hookEventName":"<event>","additionalContext":"<text>"}}`.

#### 8. `scripts/spike/libsql-check.ts`, `scripts/spike/hook-latency.ts` (Create)

*   **Type / Scope**: Throwaway scripts.
*   **Proposed Changes**: `libsql-check` tests vector columns, a top-5 vector query filtered to `live` lessons, FTS5, and 4 processes writing at once. It also tests clean installs of `@libsql/client` and `@huggingface/transformers`, and `npm pack` holding `dist/`, on macOS and Linux. Separately, it tests the fallback: `node:sqlite` with vectors stored as blobs and a full scan, and FTS5, recording the minimum Node version and any warning. The storage choice depends on these results, and none is verified yet. `hook-latency` measures a full hook run from process start (Node start-up, opening the store, repo identity, matching 500 triggers, writing a log row), 100 times, while another process writes as `learn` would, against a store holding 500 lessons.

#### 9. `scripts/spike/embed-check.ts`, `scripts/spike/match-check.ts` (Create)

*   **Type / Scope**: Throwaway scripts.
*   **Proposed Changes**: The model configuration is fixed for all of Step 0: `Xenova/bge-small-en-v1.5`, `dtype: 'q8'`, mean pooling and normalised vectors, with no query prefix. `embed-check` measures the `npm pack` tarball size with the model included, load time, time per embedding and time to embed one saved repo's logs.

    The author writes `~/.muninn-spike/instructions.jsonl` before any results exist. It holds 30 pairs of real, differently worded instructions as `{"kind":"repeat","a":"...","b":"..."}`, 20 as `{"kind":"question","q":"...","answer":"<instruction text>"}`, and for each instruction a judgement of `always_on` or `specific_moment`. `match-check` reports:
    *   the similarity cutoff that works best on 10 of the pairs, chosen only from those 10
    *   on the other 20 pairs, how many each method finds: embeddings when the pair is at or above the cutoff, and keyword search when FTS5 finds `b` from the words of `a`, with the other instructions and the saved logs' typed sentences as the corpus
    *   on the questions, how many have their answer in each method's top 5
    *   a replay of hand-picked literal triggers against other real transcripts, counting correct, missed and wrong firings against the instructions marked `specific_moment`
    *   how many of the instructions the author judges to make sense on their own, as lesson text
    *   whether Claude Code and Codex logs mark pasted text or non-interactive sessions

#### 10. `docs/spike.md` (Create), `scripts/spike/` (Delete)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Results of items 5-9, the decisions below, and the Settle After Step 0 list resolved. Then delete the spike scripts.

**Gate (proposed), first match applies:**

| Result | Action |
|---|---|
| Fewer than 5 candidates are labelled `new` | Bring this to the author before any product code. Choices: add an LLM, change the signals, or narrow the product |
| More candidates are labelled `unclear` than `new` | Bring this to the author: the rules may find things but cannot explain them, so an LLM may be needed for lesson text |
| A `@huggingface/transformers` install or embedding run fails | Stop and bring this to the author |
| M1 or M2 fails on every build of both Claude Code and Codex | Stop and bring this to the author |
| M1 and M2 fail on every build of Codex only | The Stage 2 goal narrows to Claude Code, and the author is told. The same applies the other way around |
| FTS5, concurrent writes or the libSQL install fail | Use the fallback if it passes, and tell the author. If it also fails, stop |
| Vector columns or the filtered query fail, and the rest pass | Store vectors as blobs with a full scan in libSQL |
| Full hook run p95 is 400 ms or more | Stop and bring this to the author: hook delivery cannot reliably meet its limit |
| Embeddings find fewer than 3 more of the 20 pairs than keyword search | Bring this to the author before continuing. The question result is reported alongside |
| Fewer than 15 of 20 instructions make sense on their own | Bring this to the author: lesson text needs another approach |

Decisions that follow, in any case:
*   **Model delivery:** ship it if the tarball is under 50 MB, by adding it to `copy-assets.mjs` and loading it from `dist`. Otherwise download once with consent.
*   **First run:** if it takes over 5 minutes on a real repo, cache embeddings by sentence hash in a file under `MUNINN_HOME`, and tell the author, because this stores hashes of unused sentences.
*   **Richer triggers:** if 5 or more instructions are marked `specific_moment` and the replay misses over half of them, note it for a later design pass. It does not block Stage 1.
*   **Wrong firings:** if the replay's wrong firings outnumber its correct ones, tell the author before keyword delivery is built.

### Settle After Step 0

Steps 1-3 below are provisional. They do not meet the Zero-Decision bar yet, and they are not built until this list is cleared in this document, using the results in `docs/spike.md` and `docs/checks/client-live-tests.md`, and reviewed again.

| Area | To settle | Waits for |
|---|---|---|
| Support table | How `install`, `hook` and `status` use results per client and build | Item 7 |
| Hook contract | Exact input, output, sources including `fork`, and unknown-source behaviour | Item 7 |
| Compaction | How "once per session" is computed from the append-only log, and what a late Codex hook does | Test 6 |
| Token budget | Whether compaction resets the session budget, and what happens to lessons over 300 tokens or over 3 always-on lessons | Test 6 |
| Send and log | Order on a locked store, the real time ceiling, and whether the hook can claim to exit 0 | M5, item 8 |
| Cursor | Detection order, logged tool, fixture | Test 16a |
| Installer | Exact entries, identifying muninn's entries, repeat installs, absent or malformed files, a command path that survives version managers | Hook config, test 15 |
| Non-interactive runs | Whether hooks and readers skip them | Test 12a |
| Signals | Final rules, thresholds and lesson text templates, or an LLM if the author chooses one | Item 6 |
| Readers | Finding a repo's Codex logs, typed-text and tool-output rules per client, multi-repo scope, sessions with deleted folders | Items 6, 9 |
| Re-reading logs | Dedupe keys for evidence and commands, a lasting session count, which lessons take top-10 slots | First-run time |
| Lesson states | The full table, including edit, retire and restore, and whether scans can change lesson text | Author review |
| Schema | Rowids for FTS, FTS and `repos` and `scan_counts` owners, ID generation, version record, index filtering, what `lesson_versions` holds | Item 8 |
| Storage interface | One interface across libSQL and any fallback | Item 8 |
| Commands and settings | Arguments, output and exit codes per command, `purge` confirmation, the agent search setting, how `ask` knows its caller, `--all-repos` | M4a |
| Report | Shared repeat-counting, delivery start date, `add` lessons showing "no baseline" | Item 9 |
| UI | Search routes, request and response bodies, shutdown | None |
| Tests | Embedding stub, config path override, fixture tree with 3 or more sessions and a real repo, DOM for escape tests | Item 7 |
| Ordering | Step 3 gate, whether item 33's 2 weeks hold items 34-37, Create and Modify per step | None |
| Memryzed reuse | The read has source locations, not line formats, and Memryzed has no Codex parser. Put redaction patterns and the fusion constant in this plan, and set the outcome if the licence check fails | None |
| Paths and naming | `MUNINN_HOME` in every path and in hook runs, one word for triggers, and labels for remaining thresholds | None |

### Step 1: Stage 1, the learner

#### 11. `src/cli.ts`, `src/config.ts` (Create)

*   **Type / Scope**: Entry point and settings.
*   **Proposed Changes**: `cli.ts` routes commands, and imports the model and learner only for commands that use them, so hook runs do not load them. `config.ts` finds `~/.muninn` or `MUNINN_HOME` and reads `config.json`, with these defaults: `minSessions` 3, `similarityCutoff` from the spike, `shownPerRun` 10, `maxPerDelivery` 3, `tokensPerDelivery` 300, `tokensPerSession` 1000, `hookLimitMs` 500. `muninn pause` creates the file `~/.muninn/paused`.

#### 12. `src/store/db.ts`, `src/store/migrations/001_initial.sql` (Create)

*   **Type / Scope**: Storage.
*   **Proposed Changes**: Opens the store with write-ahead logging, and a lock wait of 100 ms for hooks and 5,000 ms otherwise. Backs up before migrating and runs numbered migrations. Hooks never migrate: on a schema mismatch they log to the error file in item 26 and exit. The first migration is below. On the fallback, `embedding` is `BLOB` and the vector index is omitted.

```sql
CREATE TABLE repos (id TEXT PRIMARY KEY, paths TEXT NOT NULL, excluded INTEGER NOT NULL DEFAULT 0);
CREATE TABLE lessons (
  id TEXT PRIMARY KEY, repo_id TEXT REFERENCES repos(id),
  scope TEXT NOT NULL CHECK (scope IN ('repo','global')),
  text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('own_words','inferred','manual')),
  news_to_engineer INTEGER,
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
*   **Proposed Changes**: Create, edit, retire, list and find similar. Every change writes a version, and FTS tables are updated in the same transaction. A scan cannot overwrite a lesson with `edited_by_person` set. Transitions:

| From | Action | To | Reviewed? |
|---|---|---|---|
| `proposed` | Shown and kept or edited | `live` | Yes |
| `proposed` | "Later", or never shown | `proposed` | No |
| `proposed` | Rejected | `rejected` | Yes |
| none | `muninn add` | `live` | Yes |
| `live` | `muninn retire` | `retired` | Yes |

Nothing goes live without a decision.

#### 14. `src/repo/identity.ts` (Create)

*   **Type / Scope**: Repo detection.
*   **Proposed Changes**: Turns a directory into a repo identity. Covers worktrees through the shared git folder, SSH and HTTPS forms of one remote, and repos with no remote.

#### 15. `src/logs/types.ts`, `src/logs/discover.ts`, `src/logs/claude-code.ts`, `src/logs/codex.ts` (Create)

*   **Type / Scope**: Log readers.
*   **Proposed Changes**: The common event type (session, time, working directory, typed text) and finding logs for a repo under `~/.claude/projects/` and `~/.codex/sessions/`, or `MUNINN_LOG_ROOT` in tests. One reader per tool. A reader returns text the engineer typed, agent text, and tool calls with their exit status and the last lines of a failed call's output, as far as item 6 found them recorded. Agent text is used only to drop answers pasted between tools, and is not stored. It excludes any hook record type found by M3, skips sessions the logs mark as non-interactive if the spike finds a marker, and counts anything it does not recognise. Use the Memryzed read's notes on transcript line formats as a reference, checking the licence before copying any code.

#### 16. `src/privacy/redact.ts` (Create)

*   **Type / Scope**: Security.
*   **Proposed Changes**: Replaces values that match known key patterns and named assignments (AWS, GitHub, Slack, Stripe, OpenAI, Anthropic, Google, npm, JWTs, PEM keys, and `name=value` for names such as `token` and `password`). It uses no entropy guessing, because that can damage hashes in quotes. This is best effort. Everything written to the store passes through it.

#### 17. `src/embed/model.ts` (Create)

*   **Type / Scope**: Embeddings.
*   **Proposed Changes**: Loads the model on first use, following the spike's decision. If a download is needed, it asks first, stores the file under `MUNINN_HOME` and checks it against a SHA-256 value recorded in this file. If consent is refused, `learn` stops with a message saying what the model is for. Stores the model name in `meta`, so a later model change can start re-embedding.

#### 18. `src/learn/repeats.ts`, `src/learn/corrections.ts`, `src/learn/failures.ts` (Create)

*   **Type / Scope**: Signal detection.
*   **Proposed Changes**: Splits typed text with `Intl.Segmenter` into sentences. Sessions are processed in date order. Excludes fenced code, quoted lines, messages over 2,000 characters or 20 lines, sentences under 2 words, and exact matches in a stop-list (`run the tests`, `commit this`, `continue`, `go ahead`, `looks good`, `fix it`, `push it`). Embeds the rest. A sentence joins the first cluster whose first member is at or above `similarityCutoff`, unless one contains a negation word (`not`, `never`, `don't`, `no`, `avoid`, `stop`, `cannot`, `won't`, `shouldn't`, `without`) and the other does not. Questions and sentences that match agent text in any session of the repo are also excluded. A cluster is a candidate if it appears on at least 3 separate days, or in at least `minSessions` sessions with at least 2 wordings. `corrections.ts`: a typed message right after an agent action, starting with or containing a disagreement (`no`, `don't`, `wrong`, `not that`, `instead`), seen in at least 2 sessions. `failures.ts`: the same command failing at least twice in a session and then succeeding with a change, or the same command and normalised last error line in at least 3 sessions. Item 6 tunes these rules, which are proposed.

#### 19. `src/learn/candidates.ts` (Create)

*   **Type / Scope**: Lesson creation.
*   **Proposed Changes**: Builds candidates with up to 3 redacted quotes. A repeat has source `own_words`, and uses the cluster's longest sentence as the text. The other signals have source `inferred`, and use a template such as "`X` failed with Y, and worked after Z". First match wins: a candidate at 0.98 (proposed) or above to a rejected or retired lesson is dropped; a candidate at or above the cutoff to a `proposed` or `live` lesson, with the same negation, adds evidence; anything else is a new candidate, even if similar to a rejected lesson. Ranks by distinct sessions, then most recent session, with at most 5 of the 10 shown from any one signal, so repeats do not crowd out the rest.

#### 20. `src/commands/learn.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: `muninn learn` says what it found and will read, then re-reads all available logs for the repo. It shows the top `shownPerRun` candidates and asks keep, edit, reject or later, and a kept or edited lesson also asks whether it was news to the engineer, and for always-on, an optional literal trigger, or neither. If neither, it warns that the lesson is searchable but never delivered automatically. Decisions are saved as they are made, so stopping partway changes nothing else. In a non-interactive run, it prints candidates and changes nothing. It records `first_shown_at` and, for `own_words` lessons, a baseline row per lesson and tool, using sessions with a repeat per 10 sessions, unless one exists. It builds the command index once Step 3 exists. It gives clear messages for too few sessions or unknown formats.

#### 21. `src/commands/lessons.ts`, `src/commands/export.ts`, `src/commands/purge.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: `add`, `list`, `show`, `edit` (text, triggers, always-on, global), `retire`, `export` (all lessons to JSONL) and `purge`. `purge` removes muninn's hook entries if present, then the store, backups, model and settings. A lesson is repo-scoped unless the engineer marks it global.

#### 22. `test/fixtures/claude-code/2.1.317.jsonl`, `test/fixtures/codex/0.133.0.jsonl`, `test/fixtures/codex/0.155.0-alpha.2.6.jsonl`, `README.md` (Create)

*   **Type / Scope**: Test data and documentation.
*   **Proposed Changes**: Fixtures copy the record structure of real logs with invented content, including a pasted block, a failed then fixed command, a correction, and a hook-injected record only if M3 found one. Add a new file when a format change is observed. The first README covers install from a tarball made with `npm pack`, first run, what is read and stored, and how to remove it.

#### 23. `test/logs.test.ts`, `test/repo.test.ts`, `test/redact.test.ts`, `test/learn.test.ts`, `test/lessons.test.ts`, `test/store.test.ts` (Create)

*   **Type / Scope**: Unit tests.
*   **Proposed Changes**:
    *   Readers against fixtures, including unknown structures, and injected hook text is not returned as typed text.
    *   Repo identity cases.
    *   Fixture secrets in each listed pattern do not reach the store.
    *   Paraphrased repeats form one candidate, pasted text does not count, "use X" and "never use X" stay separate, and a stop-listed sentence does not form a candidate. A short instruction such as `use caffeinate` forms a candidate when repeated on 3 separate days. Identical text in resumed sessions on one day does not. An agent answer pasted as typed text does not count. "Never use X" does not add evidence to "use X". A rejected lesson's wording does not return as a candidate.
    *   A repeat spread across separate `learn` runs is still found.
    *   A correction, a failed then fixed command, and a mistake across 3 sessions each form an `inferred` candidate. No one signal fills more than 5 of the 10 shown.
    *   Rejected lessons stay rejected, and a person's edit cannot be overwritten.
    *   Every transition in item 13, including that "later" and unshown candidates stay `proposed`, and that a non-interactive run changes nothing.
    *   A lesson with no route gets the warning. The baseline is not overwritten by a later `learn`.
    *   Migrations back up first. `add`, `edit`, `export` and `purge` do what item 21 says.
    *   Consent refusal stops `learn` with its message. A checksum mismatch is refused.

**Gate to Stage 2 (proposed):** the held-out repo from item 5 is not used for tuning. Each judged run starts with a fresh `MUNINN_HOME`, reads the logs saved in item 5, and shows 10 lessons per repo. A lesson counts only if the engineer keeps or edits it and says it was news to them. "Later" and a kept lesson they already knew or had written down count as shown and not counted.

First match applies:

| Result | Action |
|---|---|
| Fewer than 20 lessons shown in total | Inconclusive: the author decides whether to widen with `--all-repos`, and logs why |
| At least 1 in 3 counted in total, and at least 2 of 10 on the held-out repo | Continue |
| Anything else, on the first judged run | One tuning round, then a new judged run |
| Fewer than 1 in 10 counted in total, on the second judged run | Stop and rethink before building Stage 2 |
| Anything else, on the second judged run | The author decides and logs why |

The second judged run has already seen the held-out repo, so it is weaker evidence. With 20 lessons, these rates are rough signals, not measurements. A few other engineers run the tarball on their own repo and report what they kept and whether any of it was news to them. Their feedback goes in the devlog and does not decide the gate.

### Step 2: Stage 2, delivery

Items here depend on `docs/checks/client-live-tests.md`. A client, build or moment that failed its check is not installed or promised. Builds that read the same config file get only what works on all of them.

#### 24. `src/deliver/moments.ts` (Create)

*   **Type / Scope**: Delivery.
*   **Proposed Changes**: Selects lessons per event, for the current repo plus global lessons with status `live`. `SessionStart` with `startup`, `resume` or `clear` selects always-on lessons. `SessionStart` with `compact` selects always-on lessons and resets the once-per-session record. `UserPromptSubmit` selects lessons whose trigger matches the prompt.

#### 25. `src/deliver/match.ts`, `src/deliver/limits.ts` (Create)

*   **Type / Scope**: Delivery.
*   **Proposed Changes**: A trigger matches when its pattern appears in the prompt as a case-insensitive literal bounded by non-word characters. Several triggers on one lesson are alternatives. If more than `maxPerDelivery` lessons match, always-on lessons come first, then the longest pattern, then the newest. Limits are `tokensPerDelivery`, `tokensPerSession` and once per session, counted from `deliveries`. A lesson that would break a limit is logged with outcome `limit` and is not sent. Compaction resets the once-per-session record only, and tokens keep counting. A triggered lesson stays absent after compaction until a prompt matches again.

#### 26. `src/deliver/hook.ts`, `src/deliver/clients/claude-code.ts`, `src/deliver/clients/codex.ts`, `src/store/deliveries.ts` (Create)

*   **Type / Scope**: Delivery.
*   **Proposed Changes**: `muninn hook --client <name>` parses stdin with zod against the fixtures from item 7. If the input has Cursor's signal from test 16a, it logs `unsupported_client` and returns nothing. Otherwise, it checks `paused`, selects, returns the shape from item 7 and writes one `deliveries` row per invocation or lesson, including `no_match`. An internal timer ends the run at `hookLimitMs` with outcome `timeout`. The client's hook timeout, set by `install`, is the hard stop if a native call blocks. If the store cannot be reached, it appends a line to `~/.muninn/hook-errors.log`. It exits 0 in every case.

#### 27. `src/commands/pause.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: `pause` creates `~/.muninn/paused`, and `resume` removes it.

#### 28. `src/commands/install.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: `install` and `uninstall`. Adds entries for `SessionStart` and `UserPromptSubmit` to `~/.claude/settings.json` and `~/.codex/hooks.json`, unless item 7 recorded a different location. The command is the absolute path to `muninn` plus `hook --client <name>`, so upgrades do not change it. It sets a hook timeout of 1 second, or the client's minimum. It appends to each event's list and never replaces entries. It backs up the file first and shows the changes. It prints the observed Codex trust step from test 15. It says hooks in `~/.claude/settings.json` may also run in Cursor, and what test 16a found happens there. `uninstall` removes only muninn's entries and does not restore a backup. Use the Memryzed read's installer notes as a reference, including its overwrite bug.

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

**Gate after delivery (proposed):** the author picks 2 kept lessons whose result shows quickly, preferring ones that were news to them. Before any run, the author writes one fixed prompt per lesson, which does not mention the lesson, and a pass rule, such as "ran X before Y". Each lesson runs in each supported client, 5 times per arm, with the work stopped once the result is clear:

*   **Control arm:** no line, and muninn paused.
*   **Line arm:** the lesson as a line in `AGENTS.md`, and in `CLAUDE.md` if the repo has one, and muninn paused. Remove the line afterwards.
*   **muninn arm:** the lesson delivered as always-on, so the result does not depend on a keyword.

Before each arm, the author removes the lesson's text from auto memory, and records that it did. Scores are out of 10 per client and arm. With this few runs, a difference of up to 2 counts as no difference. First match applies:

| Result | Action |
|---|---|
| The control arm gets 8 or more in every client | Agents already do this. Pick other lessons and repeat. If that keeps happening, bring it to the author |
| muninn arm is 3 or more below the line arm in a client | Stop and bring this to the author |
| muninn arm is under 8 in a client, on the first try | One round of delivery fixes, then repeat |
| muninn arm is under 8 in a client, after that | The author decides whether to narrow to the working client or stop, and logs why |
| muninn arm is within 2 of the line arm in any client | Delivery works, but has not beaten an instruction line there. Record it. The author confirms continuing, with muninn's case resting on finding lessons, sharing them and the delivery log |
| Anything else | Continue to Step 3 |

### Step 3: Stage 2, asking and the UI

Agent use of `muninn ask` depends on M4a and M4b. Where M4a failed, `ask` is for people only.

#### 32. `README.md` (Modify)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Add what each tool and build supports, based on `client-live-tests.md`. Cursor is not supported, and imported hooks return nothing there. Add pausing, uninstalling, troubleshooting, and a line agents can be given about `muninn ask`.

#### 33. Reported measures (recorded in `docs/devlog.md`)

*   **Type / Scope**: Manual check.
*   **Proposed Changes**: Over 2 weeks of the author's use, record `muninn report`. The author judges every delivery as relevant or not, and correct or not, and says the check is self-graded. Starting points to compare with are a 70% drop and 90% relevant, which decide nothing by themselves. Record any missed firing the author notices, because the log cannot show those.

#### 34. `src/index/commands.ts` (Create)

*   **Type / Scope**: Command index.
*   **Proposed Changes**: Collects commands from `package.json` scripts and `Makefile` targets, plus commands that exited 0 in logs if item 6 found exit status recorded, keeping source and date. `learn` calls it. It never runs them. CI files and README blocks are deferred.

#### 35. `src/store/search.ts` (Create)

*   **Type / Scope**: Search.
*   **Proposed Changes**: Combines FTS5 and embedding results by reciprocal rank fusion, using the Memryzed read as a reference. Returns `live` lessons only. Labels results by repo and source, applies the agent search setting and excluded repos, and logs cross-repo results to `search_log`.

#### 36. `src/commands/ask.ts`, `test/search.test.ts`, `test/ask.test.ts` (Create)

*   **Type / Scope**: CLI and tests.
*   **Proposed Changes**: `ask` answers from lessons and the command index, showing source and date. Output marks commands as data from that source, not instructions. It warns if a source's date is over 90 days old. Tests: labels and exclusions, `proposed` and `retired` lessons are not returned, the command index collects each source and ignores failed commands, and the cross-repo log is written.

#### 37. `src/ui/server.ts`, `src/ui/public/index.html`, `src/ui/public/app.js`, `src/ui/public/style.css`, `test/ui.test.ts` (Create)

*   **Type / Scope**: Local web UI.
*   **Proposed Changes**: `muninn ui` starts `node:http` on `127.0.0.1` at a free port and opens a URL with a random token. It checks the token and `Host` on every request. Routes: `GET /api/lessons`, `GET /api/lessons/:id`, `POST /api/lessons/:id` (edit text and triggers, retire), `GET /api/deliveries`, `GET /api/status`. Plain HTML and minimal client-side JavaScript. Tests: refuses requests without the token or with the wrong `Host`, and escapes lesson text.

### Verification Plan

*   **Compilation/Build**: `pnpm build`
*   **Unit Tests**: `pnpm test`
*   **Typecheck**: `pnpm typecheck` (`tsc --noEmit`). No linter in the first version.
*   **Test Coverage Requirement**: No coverage number. Every item under "Proposed Changes" for test files must exist as a named test.
*   **E2E/Integration**: On a throwaway repo with `MUNINN_HOME` set, in Claude Code and the supported Codex builds. `muninn add` two lessons with made-up facts: one always-on, and one with a keyword trigger. Start a new session and ask for the first fact. Then use the keyword in a prompt and ask for the second fact. Force compaction and ask for the first fact again, on the turn recorded by test 6. Check that `status` and the UI show the deliveries. Separately, run `learn` with `MUNINN_LOG_ROOT` pointing at the fixtures, and keep a lesson from them.

--------------------------------------------------------------------------------

*Drafted with EGM*
