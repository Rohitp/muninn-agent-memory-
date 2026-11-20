# secondnature

**Your coding agents forget everything between sessions. Teach them once, and it becomes second nature.**

secondnature reads your past Claude Code, Codex and Cursor sessions, notices what you keep teaching your agents, and tells them at the right moment, so you stop repeating yourself.

Inside, it goes by its code name, **muninn**, and so does its command: `muninn` is short to type, and `secondnature` works too.

> In Norse myth, Muninn ("memory") is one of Odin's two ravens. Each day it flies out over the world and comes back to tell him what it saw.

## What it does

You tell an agent the same things over and over: "explain it step by step", "the benchmarks folder is at the repo root", "use `poetry run python`, not bare `python`". Next session, it's forgotten. muninn fixes that in three steps:

1. **It learns from your sessions.** After you work, muninn looks through the session logs on your machine for:
   - things you said more than once
   - corrections you made to an agent
   - commands that failed and were then fixed
   - paths agents keep looking for in the wrong place, matched to where the file really is
   - long answers you keep skimming or stopping (measured from how fast you reply, never applied without you)
   - long explanations you gave

   Your own Claude (or Codex) turns each one into a short lesson.
2. **You decide what's kept.** Lessons arrive as suggestions. Nothing reaches an agent until you add it.
3. **It tells your agents when it matters.** At the start of a session, when a word you chose comes up, or when a command fails the way it has before. It also hands the next session a short note of where you left off, and keeps a running plan for each branch you work on (goal, what's open, decisions, what's done) that you can edit and, if you like, keep in the repo as `PLAN.md`.

It also proposes changes to what your agents read, each one waiting for you to apply or dismiss, and undoable:

- **Ask-first rules.** A command you keep stopping before it runs (say `git push --force`) becomes a rule that makes Claude Code ask you first, in every mode including auto mode. It's saved in the repo's `.claude/settings.local.json`, on this machine only.
- **Skills.** The same steps run in the same order across sessions become a drafted Claude Code skill, so the agent follows them in one go.
- **Edits to CLAUDE.md, AGENTS.md and skills.** On request, your Claude reviews those files against your sessions and proposes a few exact edits.

And two things for you rather than your agents: `muninn pr` writes the "why" for a branch's pull request (what was tried, what was decided, how to test) from your sessions, and `muninn insights` shows your week: where agents wasted effort, and whether lessons helped.

## What it looks like

`muninn ui` opens one page in your browser, **"What your agents know"**:

- **Suggested from your sessions:** add a suggestion, or dismiss it.
- **Your lessons:** an on/off switch each. Off means agents aren't told it.
- **Settings:** whether muninn speaks up only when a session starts, or mid-task too.

In Claude Code, an optional side panel shows what muninn told your agent in this session, and why. To add it, run these in a terminal, then open it in a new session with `/muninn`:

```sh
claude plugin marketplace add Rohitp/secondnature
claude plugin install muninn-panel@muninn
```

## How agents are told

| Tool | How |
|---|---|
| Claude Code (terminal and desktop app) | Hooks: session start, your prompt, failed commands, subagents |
| Codex | The same hooks, in `~/.codex/hooks.json`. Built from Codex's documentation, not yet tested live |
| Cursor | Rules files in `.cursor/rules/` in each repo where you switch it on |
| Claude Code, without hooks | Optional, per repo: always-on lessons in `CLAUDE.local.md`, for this machine only and ignored by git (`muninn local-file on`, or the switch on the page) |
| Any agent | `muninn ask "how do the benchmarks run?"` searches what you've kept |

## Privacy

- Everything stays on your machine, in `~/.muninn`.
- To write lessons, muninn sends **redacted** excerpts of your sessions to **your own** Claude Code (or Codex) login. It has no server, and makes no other network calls apart from a one-time download of a small local model (about 33 MB) used to compare text.
- It reads session logs only. It never reads your code unless a session quoted it.

## Install

You need **Node 22 or later** (check with `node --version`).

```sh
npm install -g secondnature
muninn setup        # installs the hooks, scans your past sessions, opens the page
```

From source instead: the repo pins its pnpm version, and `corepack enable` sets it up.

```sh
git clone https://github.com/Rohitp/secondnature.git && cd secondnature
corepack enable
pnpm install && pnpm build
npm link            # puts `muninn` and `secondnature` on your PATH
muninn setup
```

After that you don't need any commands. muninn checks for new lessons on its own after your sessions end, and the page has a **Check now** button.

## Commands

| Command | What it does |
|---|---|
| `muninn setup` | Set everything up and take a first look |
| `muninn ui` | Open the page |
| `muninn learn` | Look for new lessons now (also runs on its own) |
| `muninn ask "question"` | Search what you've kept |
| `muninn changes` | Proposed rules, skills and instruction edits; `check` reviews CLAUDE.md now |
| `muninn pr [--apply]` | Write the "why" for this branch's pull request |
| `muninn insights` | Your week with coding agents |
| `muninn status` | Check everything is working |
| `muninn pause` / `resume` | Stop or restart muninn |
| `muninn uninstall` | Remove muninn's hooks. Your lessons are kept |

Run `muninn` with no arguments for the full list.

## Status

Early, and built for one person's daily use first. It works day to day with Claude Code. Codex delivery hasn't been tested live yet, and Cursor's chats are read but only through an undocumented format.

## For contributors

- `docs/designs/muninn.md`: the design
- `docs/design-language.md`: how the interface should look and sound
- `docs/implementation-plan.md`: what's done and what's next
- `docs/devlog.md`: decisions and findings along the way

```sh
pnpm test        # 148 tests
pnpm typecheck
```

To publish a new version, run one command in a terminal on `main`:

```sh
pnpm release patch     # fixes: 0.1.0 → 0.1.1 (minor for new features, or an exact version)
```

It checks the repo is committed and up to date with GitHub, runs the types and tests, builds, and publishes to npm (which asks for your authenticator code). Only once npm accepts it does it commit the version, tag it, push, and create the GitHub release with what changed. If anything fails, nothing is released and the version is left as it was. Add `--dry-run` to see all of it without publishing.

## License

MIT. See [LICENSE](LICENSE).
