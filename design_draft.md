# muninn: Lessons That Carry Across Coding Sessions

*   **Author:** Rohit
*   **Status:** Draft
*   **Date:** 2026-11-03

--------------------------------------------------------------------------------

## Overview

muninn is a local tool for individual engineers who use coding agents. It reads
their coding sessions, proposes lessons from what happened, and gets the lessons
they keep to the agent at the moment they apply. Engineers can search and edit
those lessons in a UI, and can ask how to run something in any repo.

The author is the first user. The goal is a public release that any engineer can
install, whoever employs them, so muninn makes no assumptions about a company. It
runs on the engineer's machine and sends nothing off it by default.

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

*   **Instruction files (`CLAUDE.md`, `AGENTS.md`)** do not learn on their own,
    have no search or UI, and are kept separately unless the engineer links them.
*   **Built-in memory** belongs to one tool. Claude Code's auto memory is on by
    default. Codex Memories is off by default. Neither moves lessons between tools.
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
*   **Approval by risk.** A lesson made from the engineer's own repeated words can go
    live without review, and is shown as not yet reviewed. Anything inferred, including
    from failures, tool output or an agent's own save, waits for approval.
*   **Delivery at the moment it applies.** A live lesson reaches the agent before the
    action it concerns, where the tool allows it, and returns after compaction where
    the tool allows it. Where a tool cannot do this, muninn says so.
*   **"How do I run X?"** The engineer gets the command, its source and its date,
    without opening a README in another repo.
*   **A UI for what has been learned.** The engineer can browse, search and edit
    lessons, and see what was delivered to which agent. Its visual design will come
    from Claude Design later.
*   **Every delivery is logged from the start.** Past deliveries cannot be rebuilt,
    and later stages depend on this record.

### Success measures

*   **Lessons:** the share of proposed lessons that the engineer keeps.
*   **Repeats:** how often covered instructions are still repeated, compared with a
    baseline taken before delivery starts, and compared with what instruction files
    alone achieve.
*   **Wrong or irrelevant lessons:** the share of delivered lessons judged relevant
    in a sampled check.
*   **Adoption:** whether a second person keeps lessons and runs it again.

The target numbers are open. See Open Questions.

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
*   **The remaining `agents.md` tools in the first version:** `understand`, `check`,
    the code graph, blast radius, leases, branch handoff and merge promotion.

## Open Questions

*   **Target numbers:** The stage gates in the Detailed Implementation Plan use proposed
    numbers with no evidence behind them yet. They should be confirmed in review, and
    revised once the spike and first real runs report.
*   **Crossing repos:** The first version lets agents search all repos, with labelled
    results. The author chose this provisionally and expects to iterate. What should
    the default be for other engineers, whose logs may mix employers?
*   **Searching by meaning in hooks:** Automatic delivery uses simple triggers only,
    because no background program holds the model. How many real cases does this miss?
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
*   **When**: They ask through `muninn ask` or the UI, or their agent asks through a tool.
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
| Storage | libSQL file with vector columns | Author. Fallback is plain SQLite if the spike fails. |
| Embedding model | Local; shipped or downloaded once | Author. The spike decides which. |
| Background program | None | Author |
| Approval | Own repeated words can go live; inferred lessons wait | Author |
| Across repos | Agents search all repos, labelled | Author, provisional |
| Tools | Claude Code and Codex | Author, for the learner. Applied here to Stage 2 too. |
| Extraction | Rules plus embeddings, no LLM | Proposed in this draft |
| Language | TypeScript on Node 22, published to npm | From `agents.md` |

### Overview

muninn is a command-line program with no long-running process. Each entry point opens
the same store, does its work and exits. The exceptions are the MCP server, which lives
as long as its agent session, and the UI, which runs only while it is open.

```text
 Claude Code logs ─┐
                   ├─► log readers ─► signal detectors ─► candidate lessons
 Codex logs ───────┘                  (with embeddings)          │
                                                                 ▼
 repo manifests, READMEs ─► command index ─────────►  store: one libSQL file
                                                      ~/.muninn/muninn.db
                                                       ▲    ▲    ▲     ▲
              ┌────────────────────────────────────────┘    │    │     │
              │                  ┌──────────────────────────┘    │     │
          muninn CLI          muninn ui                muninn mcp   muninn hook
       (learn, ask, status)   (browse, edit)         (agent search) (trigger match
                                                                     and delivery)
                                                          │               │
                                                          └─► agent ◄─────┘
```

### Stage 1: the learner

**Log readers.** One reader for each tool turns its log into a common list of events:
session, time, working directory, branch, what the engineer typed, tool calls and tool
results. Both vendors say their formats are not stable, so each reader checks the
structure and counts anything it does not recognise. Those counts appear in the output.
Readers are tested against saved sample logs, with one sample per client version seen.

**Which repo a session belongs to.** The reader takes the working directory from the log
and asks git for the repo. Worktrees resolve to one repo through the shared git folder.
The repo's identity is its cleaned-up `origin` URL, or its path if it has no remote.
Sessions whose folder no longer exists are counted and reported.

**Signals.** Rules look for three things:

*   **Repeated instructions:** what the engineer typed is split into sentences and
    embedded. Sentences with similar meaning, in at least 3 different sessions, form a
    candidate. Pasted blocks are excluded, because the engineer did not write them.
*   **Corrections:** an engineer's message right after an agent action that disagrees with
    or redirects it, such as "no", "don't" or "use X instead".
*   **Failure then fix:** the same command failing more than once, then succeeding with a
    change. This relies on tool output.

The repeated-instruction signal is the main one: it is the only signal that fits the
token example. The thresholds are starting values to be tuned on real logs.

**Candidates.** Each candidate holds the wording, the evidence, a source (`own_words` or
`inferred`), suggested triggers, and a note if it looks specific to one operating system.
A repeated instruction uses the engineer's own words as the lesson text. A new candidate
similar to an existing lesson or to a rejected one is attached to it or dropped. It is
never merged automatically, because similar text can have the opposite meaning, such as
"use X" and "never use X".

**Suggested triggers.** Because hooks cannot search by meaning, the intelligence is applied
here. For each candidate, muninn looks at what happened around the evidence: commands run
next, files touched, words used. It proposes triggers from them, such as the script's
command for the token lesson. Lessons that end up without a trigger are still searchable
and appear in session-start delivery only if marked always-on.

**Review.** `muninn learn` lists candidates in the terminal, and the engineer keeps, edits or
rejects each one. Output is limited to the strongest few, because a stranger who sees junk
will not run it twice. The same run records the repeat counts that become the baseline.

**Privacy.** Secrets are removed before anything is stored, using known key patterns and
high-entropy checks. Only short evidence quotes are stored and raw logs are not copied. This
means evidence outlives Claude Code's 30-day log retention, and the store never holds a full
transcript. Nothing goes over the network except the optional one-time model download.

### Stage 2: use

**Delivery.** `muninn install` adds hooks to Claude Code and Codex, keeping any existing
hooks, and shows what it changed. Codex asks the engineer to trust each hook, so install says
so. Each hook starts `muninn hook`, which matches simple triggers and returns text to the agent:

| Moment | Hook | What is delivered |
| --- | --- | --- |
| Session start | `SessionStart` | Always-on lessons for this repo, plus global ones |
| After compaction | `SessionStart` with `compact` | The same, plus lessons already delivered this session |
| Prompt submitted | `UserPromptSubmit` | Lessons whose keyword or command triggers match the prompt |
| After a tool call | `PostToolUse` | Lessons whose path or command triggers match the call |

Claude Code documents that `PreToolUse` text arrives with the tool result, too late to stop
that call. Refusing the call with a reason may be the only way to intervene before a long
run. This plan does not use it until a hands-on test confirms the behaviour, and then only
for lessons the engineer has marked as blocking.

**Limits on delivery.** Starting values are at most 3 lessons and 300 tokens per delivery,
1,000 tokens per session, and each lesson once per session plus once after compaction. A hook
gives up after 500 ms and lets the session continue without delivery, and logs that it did.
Any hook failure must never interrupt the agent. `muninn pause` stops all delivery.

**Delivery log.** Every delivery, skip and timeout is recorded: lesson version, trigger, tool,
session, reason and tokens. The log is append-only. Later stages rely on it, and it is what
the UI shows. It can only prove what muninn sent. It cannot prove what stayed in context.

**Approval.** An `own_words` lesson goes live automatically, marked as not yet reviewed, and
this can be turned off. Lessons from any other source wait. Agent saves count as `inferred`,
so an agent cannot make its own lesson live. Lessons edited by a person cannot be overwritten
by an agent or by a later scan.

**Search.** Search combines keyword matching with embeddings, and each result shows its repo
and date. The MCP server holds the model after its first use for the rest of its session, so
only an agent's first search pays the load cost. `muninn ask` loads it each time. Vague
questions rely on two steps: embeddings produce a shortlist, and the agent reading it decides
what is relevant. muninn itself does not run an LLM.

**Across repos.** Agents' searches cover all scanned repos, and results are labelled by repo.
Automatic delivery only uses the current repo and global lessons. A setting limits agent search
to the current repo, and individual repos can be excluded. Cross-repo results are logged, so the
choice can be judged and revised.

**"How do I run X?"** A command index is built from `package.json` scripts, Makefiles, CI files and
README code blocks, plus commands seen to succeed in logs. Each entry keeps its source and the date
last seen. Answers show both, because a README can be wrong, and muninn never runs the command.

**MCP tools.** A small set: `search_lessons`, `find_command` and `save_lesson`. The server finds the
project through `CLAUDE_PROJECT_DIR` in Claude Code and through its working directory in Codex.
Whether that holds for the Codex desktop app needs a hands-on test.

**UI.** `muninn ui` starts a local web page, which stops when closed. It has lessons (browse, search,
edit, retire, approve), the delivery log, and status per tool. It accepts connections from this
machine only, needs a random token, and checks the `Host` header to block requests from web pages.
All lesson text is escaped, since it comes from logs. The layout is functional, and Claude Design will
design the visuals later.

### Data model

Every table sits in one file, `~/.muninn/muninn.db`, whose folder only the owner can read. Multiple
short-lived processes write to it, relying on write-ahead logging and a wait on locks. The spike must
confirm libSQL handles this.

| Table | Holds |
| --- | --- |
| `repos` | Identity, known paths, excluded flag |
| `lessons` | Current text, scope (repo or global), source, status, reviewed date, always-on and blocking flags, embedding, model name |
| `lesson_versions` | Every past text and who changed it |
| `triggers` | Lesson, kind (keyword, command, path), pattern, who proposed it |
| `evidence` | Lesson, tool, session, date, redacted quote |
| `commands` | Repo, command, source, date last seen, embedding |
| `deliveries` | Append-only delivery log |
| `scan_state` | Per log file: how far it was read, unknown structure counts |
| `meta` | Schema version, model name |

Status is one of `proposed`, `live`, `rejected` or `retired`. Rejected lessons are kept so they are not
proposed again. Every upgrade backs up the file first and applies numbered migrations.
`muninn export` writes all lessons to JSONL, and `muninn purge` deletes the whole store.

### Commands

`learn` (`--all-repos` to widen) · `ask` · `list` · `show` · `edit` · `retire` · `ui` · `mcp` · `hook` ·
`install` · `uninstall` · `pause` / `resume` · `status` · `export` · `import` · `purge`

### What the spike must prove before Stage 1 code

1.  libSQL through `@libsql/client`: vector columns, FTS5, several processes writing at once, and clean
    installs on macOS and Linux.
2.  The embedding model: size, load time and time per embedding, which decides shipped or downloaded.
3.  Node start-up plus opening the store within the hook's 500 ms limit.
4.  First-run time: how long embedding a real repo's logs takes.
5.  About 20 real repeated instructions: how many keyword matching and embeddings each catch.
6.  About 20 vague questions: whether the right lesson makes the shortlist.

Hands-on client tests come before Stage 2, from `docs/checks/client-capabilities.md`.

## Alternatives Considered

### Rejected by the author

#### Instruction files as the product

*   **Pros**: Nothing to build. Stable facts such as the token reminder may be served well.
*   **Cons**: No learning, search or UI, and lessons do not move between tools by default.
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

*   **Security and privacy:** Nothing leaves the machine except the optional model download. The
    store holds redacted quotes only, and only its owner can read it. Text from logs is treated as
    untrusted: it is escaped in the UI, and anything not typed by the engineer waits for approval.
    `npx` instructions pin an exact version. `muninn purge` removes lessons, evidence, history and
    backups.
*   **Performance:** Hooks give up after 500 ms and never block the agent. The aim is under 100 ms at
    p95, to be measured. First-run time is measured in the spike and reported in `docs/spike.md`.
*   **Token use:** Delivery limits are listed in the Technical Plan. Each delivery's tokens are logged,
    because injected text is re-read on every later turn of a session.
*   **Rollout and rollback:** `muninn pause` stops delivery at once. `muninn uninstall` removes hooks and
    MCP entries, keeping the store. Each upgrade backs up the store before migrating. The data format
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

--------------------------------------------------------------------------------

## Detailed Implementation Plan

Work happens in order, and each step ends at a gate. Files are relative to the repo root. It is a single
npm package using pnpm, TypeScript and Vitest, with zod for validating inputs.

### Step 0: Clean up and spike

Spike scripts are throwaway, but their results decide choices in the steps below.

#### 1. `agents.md` (Move to `docs/archive/original-build-spec.md`)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Move the file and add a note that this design replaces it. On a macOS disk that
    ignores case, Codex may read `agents.md` as its instructions file, and would then follow an outdated
    build spec with the name `amem`. Whether that happens has not been tested.

#### 2. `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` (Create)

*   **Type / Scope**: Build configuration.
*   **Proposed Changes**: Package with a `muninn` command, Node 22 or later, and dependencies
    `@libsql/client`, `@huggingface/transformers`, `@modelcontextprotocol/sdk` and `zod`. Ignore build output,
    the spike's data, and any real logs.

#### 3. `scripts/spike/libsql-check.ts` (Create)

*   **Type / Scope**: Throwaway script.
*   **Proposed Changes**: Tests vector columns, FTS5, and several processes writing at once. Needed because the
    storage choice rests on these being unverified.

#### 4. `scripts/spike/embed-check.ts` (Create)

*   **Type / Scope**: Throwaway script.
*   **Proposed Changes**: Measures `Xenova/bge-small-en-v1.5` size, load time and time per embedding, plus time to
    embed one real repo's logs. Decides whether the model is shipped or downloaded.

#### 5. `scripts/spike/hook-latency.ts` (Create)

*   **Type / Scope**: Throwaway script.
*   **Proposed Changes**: Measures Node start-up, opening the store, and matching triggers. Tests whether the 500 ms
    limit can be met with no background program.

#### 6. `scripts/spike/match-check.ts` (Create)

*   **Type / Scope**: Throwaway script.
*   **Proposed Changes**: Takes about 20 real repeated instructions and about 20 vague questions from a local file
    that is never committed, and compares what keyword search and embeddings find. This tests the product's main bet.

#### 7. `docs/spike.md` (Create)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Results and timings of the above, the shipped-or-downloaded decision, and whether libSQL stays.

**Gate:** if FTS5, concurrent writes or installs fail, switch to plain SQLite and tell the author. If embeddings catch
no more than keyword search, bring that back to the author before continuing.

### Step 1: Stage 1, the learner

#### 8. `src/cli.ts` (Create)

*   **Type / Scope**: Entry point.
*   **Proposed Changes**: Routes commands. Loads heavy modules only when needed, so hooks stay fast.

#### 9. `src/config.ts` (Create)

*   **Type / Scope**: Settings.
*   **Proposed Changes**: Finds `~/.muninn` or `MUNINN_HOME`, and reads settings with their defaults: delivery limits,
    signal thresholds, agent search scope, automatic delivery of `own_words` lessons.

#### 10. `src/store/db.ts` and `src/store/migrations/001_initial.sql` (Create)

*   **Type / Scope**: Storage.
*   **Proposed Changes**: Opens the store with write-ahead logging and a lock wait, backs up before migrating, and runs
    numbered migrations. The first migration creates the tables in the Data model section.

#### 11. `src/store/lessons.ts` (Create)

*   **Type / Scope**: Storage.
*   **Proposed Changes**: Create, edit, retire, approve, list and find similar. Every change writes a version. Enforces
    that agents and scans cannot overwrite a person's edit, and that only `own_words` lessons can go live unreviewed.

#### 12. `src/store/scan-state.ts` (Create)

*   **Type / Scope**: Storage.
*   **Proposed Changes**: Records how far each log has been read, and unknown structure counts, so reruns only read new
    content and problems can be reported.

#### 13. `src/logs/types.ts`, `src/logs/discover.ts`, `src/logs/claude-code.ts`, `src/logs/codex.ts` (Create)

*   **Type / Scope**: Log readers.
*   **Proposed Changes**: The common event type, finding logs for a repo, and one reader per tool. Readers separate what the
    engineer typed from pasted blocks and tool output, and count what they do not recognise.

#### 14. `src/repo/identity.ts` (Create)

*   **Type / Scope**: Repo detection.
*   **Proposed Changes**: Turns a directory into a repo identity. Covers worktrees, SSH and HTTPS forms of one remote, and
    repos with no remote.

#### 15. `src/privacy/redact.ts` (Create)

*   **Type / Scope**: Security.
*   **Proposed Changes**: Removes secrets before storage, using key patterns and high-entropy checks. Everything written to the
    store passes through it.

#### 16. `src/embed/model.ts` (Create)

*   **Type / Scope**: Embeddings.
*   **Proposed Changes**: Loads the model on first use, following the spike's decision. If a download is needed, it asks first
    and verifies the file. Stores the model name so a later model change can trigger re-embedding.

#### 17. `src/learn/repeats.ts`, `src/learn/corrections.ts`, `src/learn/failures.ts` (Create)

*   **Type / Scope**: Signal detection.
*   **Proposed Changes**: The three signals in the Technical Plan, with thresholds from settings.

#### 18. `src/learn/candidates.ts` and `src/learn/triggers.ts` (Create)

*   **Type / Scope**: Lesson creation.
*   **Proposed Changes**: Builds candidates with evidence and source, attaches or drops those similar to existing or rejected
    lessons, ranks them, and suggests triggers from the commands, files and words around the evidence.

#### 19. `src/commands/learn.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: `muninn learn`: says what it found and will read, runs the pipeline, shows the strongest candidates for
    keep, edit or reject, records the baseline, and gives clear messages for too few sessions or unknown formats.

#### 20. `src/commands/lessons.ts`, `src/commands/export.ts`, `src/commands/purge.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: `list`, `show`, `edit`, `retire`, `export`, `import` and `purge`, so an engineer can correct and remove
    everything from the first version.

#### 21. `test/fixtures/claude-code/`, `test/fixtures/codex/` (Create)

*   **Type / Scope**: Test data.
*   **Proposed Changes**: Small hand-written logs, one per client version seen, containing no real content. Needed because the
    formats are not stable.

#### 22. `test/logs.test.ts`, `test/repo.test.ts`, `test/redact.test.ts`, `test/learn.test.ts`, `test/lessons.test.ts` (Create)

*   **Type / Scope**: Unit tests.
*   **Proposed Changes**: Readers against fixtures, including unknown structures. Repo identity cases. Secrets never reach the store.
    Paraphrased repeats form one candidate, pasted text does not count, and "use X" and "never use X" stay separate. Rejected lessons
    stay rejected, and a person's edit cannot be overwritten.

**Gate to Stage 2 (proposed):** the author runs `muninn learn` on 3 of their own repos and keeps at least half of the lessons shown, and
it finds the token lesson. At least 2 other engineers run it on their own repo, and at least 1 of them keeps a lesson and runs it again.
If fewer than 1 in 4 shown lessons are kept after tuning, stop and rethink before building Stage 2.

### Step 2: Stage 2, use

#### 23. `docs/checks/client-live-tests.md` (Create)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Results of the delivery, compaction, MCP and install tests listed in `docs/checks/client-capabilities.md`, using
    hooks that return a made-up fact. If a test fails, the matching part of this plan changes before it is built.

#### 24. `src/deliver/match.ts` and `src/deliver/limits.ts` (Create)

*   **Type / Scope**: Delivery.
*   **Proposed Changes**: Matches keyword, command and path triggers against a hook's input. Applies the token and frequency limits.

#### 25. `src/deliver/hook.ts`, `src/deliver/clients/claude-code.ts`, `src/deliver/clients/codex.ts` (Create)

*   **Type / Scope**: Delivery.
*   **Proposed Changes**: `muninn hook` reads the hook's input, matches, returns text in that tool's format, and logs the result. It stops
    itself at the time limit, and exits without error on any failure.

#### 26. `src/store/deliveries.ts` (Create)

*   **Type / Scope**: Storage.
*   **Proposed Changes**: Append-only delivery log. Includes reading back what a session already received, for re-delivery after compaction.

#### 27. `src/commands/install.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: `install`, `uninstall`, `pause` and `resume`. Adds hooks and MCP entries to each tool's config, keeps other tools'
    hooks, backs up the file first, shows the changes, and explains Codex's trust step.

#### 28. `src/index/commands.ts` (Create)

*   **Type / Scope**: Command index.
*   **Proposed Changes**: Collects commands from manifests, Makefiles, CI files, README code blocks and successful commands in logs, keeping
    source and date. Never runs them.

#### 29. `src/store/search.ts` (Create)

*   **Type / Scope**: Search.
*   **Proposed Changes**: Combines keyword and embedding results, labels them by repo, applies the agent search setting and excluded repos, and
    logs cross-repo results.

#### 30. `src/commands/ask.ts` and `src/commands/status.ts` (Create)

*   **Type / Scope**: CLI.
*   **Proposed Changes**: `ask` answers from lessons and the command index, showing source and date. `status` shows last capture and last delivery
    per tool, hook health and unknown formats.

#### 31. `src/mcp/server.ts` (Create)

*   **Type / Scope**: MCP server.
*   **Proposed Changes**: `search_lessons`, `find_command` and `save_lesson`, with short descriptions of when to use each. Saves are always
    `inferred`. Finds the project as described in the Technical Plan, and holds the model after first use.

#### 32. `src/ui/server.ts`, `src/ui/public/index.html`, `src/ui/public/app.js`, `src/ui/public/style.css` (Create)

*   **Type / Scope**: Local web UI.
*   **Proposed Changes**: Local server with a random token and a `Host` check, serving plain HTML and a little JavaScript. Screens for lessons, the
    delivery log and status. Layout is functional, ready for Claude Design later.

#### 33. `test/deliver.test.ts`, `test/search.test.ts`, `test/install.test.ts`, `test/concurrency.test.ts`, `test/ui.test.ts` (Create)

*   **Type / Scope**: Unit and integration tests.
*   **Proposed Changes**: Trigger matching and limits. Hook timeouts and failures leave the session unaffected. Search labels and exclusions. Install
    keeps other hooks and uninstall restores them. Several processes write without losing data. The UI refuses requests without the token or with the
    wrong `Host`, and escapes lesson text.

#### 34. `README.md` (Create)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Install, first run, what is read and stored, what each tool supports (a plain table showing Cursor as unsupported), pausing,
    uninstalling and troubleshooting.

#### 35. `docs/implementation-plan.md` and `docs/devlog.md` (Modify)

*   **Type / Scope**: Documentation.
*   **Proposed Changes**: Replace the phases from `agents.md` with the steps here. Log results at each gate.

#### 36. `design_draft.md` (Delete)

*   **Type / Scope**: Working file.
*   **Proposed Changes**: Removed once this design is saved to `docs/designs/muninn.md`, so only one copy remains.

### Verification Plan

*   **Compilation/Build**: `pnpm build`
*   **Unit Tests**: `pnpm test`
*   **Static Analysis & Linting**: `pnpm typecheck` (`tsc --noEmit`)
*   **Test Coverage Requirement**: No coverage number. Every item under "Proposed Changes" for test files must exist as a named test.
*   **E2E/Integration**: In Claude Code and Codex on a throwaway repo: run `learn`, keep a lesson, start a new session, and ask the agent for the lesson's
    fact without mentioning it. Repeat after forcing compaction. Check that `status` and the UI show the delivery.
*   **Stage 2 success (proposed):** over 2 weeks of the author's use, covered repeats drop by at least 70% from the baseline, and at least 90% of a sampled
    set of deliveries are judged relevant. Repeats are also compared with a period using instruction files alone, so that muninn is measured against that
    option.

--------------------------------------------------------------------------------

*Drafted with EGM*

