# muninn

**Your coding agents forget everything between sessions. muninn remembers for them.**

muninn reads your past Claude Code, Codex and Cursor sessions, notices what you keep teaching your agents, and tells them at the right moment, so you stop repeating yourself.

> In Norse myth, Muninn ("memory") is one of Odin's two ravens. Each day it flies out over the world and comes back to tell him what it saw.

## What it does

You tell an agent the same things over and over: "explain it step by step", "the benchmarks folder is at the repo root", "use `poetry run python`, not bare `python`". Next session, it's forgotten. muninn fixes that in three steps:

1. **It learns from your sessions.** After you work, muninn looks through the session logs on your machine for:
   - things you said more than once
   - corrections you made to an agent
   - commands that failed and were then fixed
   - long explanations you gave

   Your own Claude (or Codex) turns each one into a short lesson.
2. **You decide what's kept.** Lessons arrive as suggestions. Nothing reaches an agent until you add it.
3. **It tells your agents when it matters.** At the start of a session, when a word you chose comes up, or when a command fails the way it has before. It also hands the next session a short note of where you left off.

## What it looks like

`muninn ui` opens one page in your browser, **"What your agents know"**:

- **Suggested from your sessions:** add a suggestion, or dismiss it.
- **Your lessons:** an on/off switch each. Off means agents aren't told it.
- **Settings:** whether muninn speaks up only when a session starts, or mid-task too.

In Claude Code, an optional side panel (`mods/muninn-panel`) shows what muninn told your agent in this session, and why.

## How agents are told

| Tool | How |
|---|---|
| Claude Code (terminal and desktop app) | Hooks: session start, your prompt, failed commands, subagents |
| Codex | The same hooks, in `~/.codex/hooks.json`. Built from Codex's documentation, not yet tested live |
| Cursor | Rules files in `.cursor/rules/` in each repo where you switch it on |
| Any agent | `muninn ask "how do the benchmarks run?"` searches what you've kept |

## Privacy

- Everything stays on your machine, in `~/.muninn`.
- To write lessons, muninn sends **redacted** excerpts of your sessions to **your own** Claude Code (or Codex) login. It has no server, and makes no other network calls apart from a one-time download of a small local model (about 33 MB) used to compare text.
- It reads session logs only. It never reads your code unless a session quoted it.

## Install

muninn isn't on npm yet. From source, with Node 22 or later and pnpm:

```sh
git clone <this repo> && cd muninn
pnpm install && pnpm build
npm link            # puts `muninn` on your PATH
muninn setup        # installs the hooks, scans your past sessions, opens the page
```

After that you don't need any commands. muninn checks for new lessons on its own after your sessions end, and the page has a **Check now** button.

## Commands

| Command | What it does |
|---|---|
| `muninn setup` | Set everything up and take a first look |
| `muninn ui` | Open the page |
| `muninn learn` | Look for new lessons now (also runs on its own) |
| `muninn ask "question"` | Search what you've kept |
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
pnpm test        # 95 tests
pnpm typecheck
```
