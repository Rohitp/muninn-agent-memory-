# What a great muninn experience looks like

Draft for discussion, 2026-11-10. Nothing here is built yet unless it says so.

## The promise

**You never explain the same thing twice, to any agent.**

Today you tell Claude Code how the contract ingestion benchmarks work, then tell Cursor again, then ask both to keep a dev log so next week's session knows where things stand. muninn should make all three of those unnecessary.

## What you actually teach agents

Your sessions contain four kinds of knowledge. muninn handles only the first today.

| Kind | Example | Today |
| --- | --- | --- |
| **Rules**: how to work | "Quote `===` in zsh." "`benchmarks/` is at the repo root." | Built. Learned from repeats, corrections and fixes. |
| **Repo knowledge**: how things here work | "The contract ingestion benchmark loads PDFs from X, scores them against Y, and we care about Z." | Missing. You explain it once, at length, so the repeat signals never fire. |
| **Where we are**: project state | "We moved to the new parser, two of five steps are done, and we chose not to cache because..." | Missing. This is what your dev log and plan do. |
| **About you**: how you like to work | "Lead with the plain answer, keep it short." | Built. Learned as global rules. |

## How others do it, and the gap they leave

These are from our read of Memryzed (`docs/checks/memryzed-read.md`) and from general knowledge of the clients. The client features change often, so check them before relying on any of this.

| Product | How memory gets in | How agents get it | What's missing |
| --- | --- | --- | --- |
| **Claude Code** | You write CLAUDE.md. The agent can also save its own memory files while working. | Loaded at session start. | Claude Code only. The agent decides what's worth saving mid-task, so the result is uneven. |
| **Cursor** | Rules files you write. It has also offered memories generated from chats. | Rules attached by file pattern or by the agent asking. | Cursor only. |
| **Codex** | AGENTS.md you write. | Loaded at session start. | Codex only. Entirely manual. |
| **Mem0, Supermemory, Letta and similar** | The agent calls a "remember" tool. | The agent calls a "recall" tool. | The agent has to remember to ask. Built for chat apps, not for coding. |
| **Memryzed** | Seven regexes over your messages ("remember that...", "I prefer..."). | Tool call only. | Captures only Claude Code. Nearly everything is auto-approved. Nothing is pushed at the right moment. No check that anything helped. |

**Four gaps keep coming up:**

1. **Each tool has its own memory.** What you tell Cursor doesn't reach Claude Code.
2. **The agent decides what to save, while it's busy doing something else.** It saves the wrong things and misses patterns that only show up across sessions.
3. **Getting memory back means the agent has to ask for it.** It often doesn't.
4. **Nobody checks whether it helped.** Memory piles up and goes stale without anyone noticing.

muninn already covers 2, 3 and part of 4. The magic is in covering all four, plus the two missing kinds of knowledge.

## Moments that would make it feel magical

**1. The mirror (first run).**
Right after install, muninn reads your past sessions and shows you what you've been teaching your agents:

> Across 212 sessions in 3 tools, you explained the contract ingestion benchmark 4 times (Claude Code on Oct 3 and Oct 12, Cursor on Oct 20 and Nov 2). Here's one note covering all four. Keep it?

The first real run already got this reaction ("3 and 4 were news to me"). Making the counts and dates visible is what makes it land.

**2. Switch tools and it already knows.**
You open Cursor after a week in Claude Code. The benchmark note and the zsh rule are already there, and you didn't do anything to make that happen.

**3. Pick up where you left off, in any tool.**
When a session ends, muninn writes a short handoff for the repo and branch: what changed, what was decided and why, what's next. The next session gets it at the start, in Claude Code, Cursor or Codex. This replaces asking each agent to keep the dev log and plan up to date.

**4. "You've told me this before."**
You start typing an explanation muninn already has. The agent gets the saved note straight away. If what you said adds something new, muninn offers to update the note rather than make a second one.

**5. Proof that it worked.**
A weekly line: "Agents hit the zsh `===` mistake 0 times this week (5 times in the 2 weeks before). The benchmark note was used in 6 sessions." This is the one thing no one else does, and it's what makes you trust it enough to let it run.

**6. Review takes a minute, not a session.**
A few proposals at a time, each with its evidence and similar ones already merged. Anything stale (it mentions a file or command that no longer exists) is flagged for you to retire.

## What has to be true

- **Notes need to be longer than rules.** A benchmark explanation is a paragraph. It should be delivered when the topic comes up, not every session, or it fills the context window.
- **Cursor needs a reader.** Cursor keeps chats in a local database, not log files. The format isn't documented and may change. Without the reader, moment 1 only sees half the story.
- **The handoff must be honest.** A wrong "where we are" is worse than none. Each line should come from the session itself, and old handoffs should expire.
- **You stay in charge.** Nothing reaches an agent until you approve it. The magic comes from approving being cheap, not from skipping it.

## Risks and counter-arguments

- **The clients may build this themselves.** Claude Code, Cursor and Codex are all adding memory. But each will stay inside its own tool. Working across tools, and checking whether lessons helped, are the lasting edges.
- **Handoffs overlap with your repo dev log.** The dev log is shared, reviewed and in git. muninn's handoff is personal and automatic. One option is for muninn to suggest dev log entries rather than replace the file.
- **More kinds of knowledge means more review.** If notes and handoffs flood the review queue, it stops feeling magical. Handoffs probably shouldn't need review at all, since they're short-lived. Notes should.
- **Reading every chat from every tool is a lot of access.** Keep it local and redacted, and make it easy to see exactly what was read.

## Suggested build order

1. **Notes**: an "explained at length" signal, plus delivery on topic match. This solves the benchmark case.
2. **Cursor reader**, so explanations given in Cursor count too.
3. **Session handoff** across tools.
4. **"It worked" report** from delivery and outcome data.
5. **Weekly digest** for review, with merging and staleness flags.

## Questions for you

1. Should the handoff live only inside muninn, or should muninn also propose updates to `docs/devlog.md` and the plan in the repo?
2. Is this just for you for now, or should notes be shareable with your team in the same repo later on?
