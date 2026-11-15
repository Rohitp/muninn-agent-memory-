# muninn — Implementation Plan (Tracker)

Living execution tracker. The spec is `docs/designs/muninn.md`. This file lists its steps with status, and the journal is `docs/devlog.md`.

Status legend: ⬜ todo · 🟦 in progress · ✅ done · ⛔ blocked · ⏭️ deferred

## Current status
- **Step:** 1, Stage 1, the learner
- **Next action:** Author runs `muninn install`, then works normally and judges whether lessons help.
- **Blockers:** none.

## Pre-build — EGM design
- ✅ Upgrade Claude Code to ≥ 2.1.271 (now 2.1.317) — Goldfish isolation requirement
- ✅ Install + enable EGM plugin (`egm@egm`, local marketplace)
- ✅ `/egm:egm-brainstorm` → `concepts_brief.md`, with `docs/checks/`
- ✅ `/egm:egm-draft` → `docs/designs/muninn.md` from `concepts_brief.md`
- ✅ `/egm:egm-review` → reports in `docs/reviews/`. Some findings on lines before the plan stay open

## Done before Stage 1
- ✅ Archive `agents.md`, update tracker and devlog, delete `design_draft.md`, package setup
- ✅ Save logs for the 2 repos used so far, first signal check

## Step 1 — Stage 1, the learner
- 🟦 Items 11-23a
- ✅ Model download prompt: say the size (about 33 MB), where it comes from (Hugging Face, `Xenova/bge-small-en-v1.5`), and show a progress bar while downloading
- ✅ Review prompt: explain the delivery choices with an example, suggest a keyword from the lesson, and say delivery starts in Stage 2
- ✅ Keywords: when choosing one, list the keywords already in use and how many lessons each has. Add `muninn keywords` to show them all
- ✅ Shared keywords: warn when a keyword already has 3 lessons, because only 3 are sent per prompt. Show which ones would be left out
- ✅ Similar lessons: at review, offer to combine lessons that say nearly the same thing, such as "explain clearly" and "I don't understand". Never combine automatically
- ✅ Scope: suggest global for lessons that aren't about the repo, such as shell behaviour
- ✅ Writer: phrase lessons as instructions to the agent ("Keep answers brief"), not as notes about "the user"
- ✅ First real run (cb-ai-agents, 2026-11-06): 4 shown, 4 kept, 2 news to the author, both from failure-then-fix

## Step 2 — Stage 2, delivery
- ✅ Claude Code live checks (`docs/checks/client-live-tests.md`)
- ✅ Delivery hook: session start, prompt keywords, failed commands, subagents, with limits and a log of every outcome
- ✅ `muninn install`, `uninstall`, `status`, `keywords`
- 🟦 Codex: hooks in `~/.codex/hooks.json` (session start, prompts, failed Bash calls through `PostToolUse`, subagents, session end). Built from the docs and tested offline. Needs a live check: trust in `/hooks`, and the real shape of a Bash result (muninn records it in `status`). The Codex writer still needs a working `codex exec`
- ⬜ Interactive-session checks: compaction and subagents
- ✅ Cursor: kept lessons written as `.cursor/rules/muninn*.mdc` per repo with `muninn cursor on`, kept out of git through `.git/info/exclude`, and rewritten when lessons change
- ⬜ Author judges it from real use

- ✅ Duplicates: moments matched to lessons by their quotes before writing; proposed copies folded into the lesson they repeat (2026-11-15)

## Step 3 — Stage 2, asking and the UI
- ✅ Cursor reader: `~/.cursor/projects/*/agent-transcripts`, typed text, agent text and timestamps. No command results, so no command signals from Cursor
- ✅ Notes: long explanations become proposed notes with suggested keywords. The writer's "no" is remembered. At most 30 per run
- ✅ Handoffs: written when a session ends (Claude Code and Codex hooks) and during learn for recent sessions without one (Cursor). Sent at the next fresh start on the same branch, and written to `.cursor/rules/muninn-handoff.mdc`. `muninn handoff [--list]`
- ✅ `muninn report`: sent counts, and whether each kept lesson's moment came back after it was kept
- ✅ `muninn ui`: local page for waiting, kept, handoffs, report and search, on 127.0.0.1 with a per-run token
- ✅ Plain lines and questions: each lesson gets a plain-English line for the engineer and 2-3 questions it answers, written in a separate pass during learn (and after an edit in the UI). Search matches questions to questions. Cards say where each item came from
- ✅ Answer button in the UI: one writer call over the top kept items and recent handoffs, with sources, and "doesn't know" when they don't cover it
- ⬜ More writer providers: an OpenRouter or other API key, and a local model through Ollama for the plain lines and answers. Kept to one place in `writer.ts`
- ⬜ Author tests all of the above from real use
- ⬜ Items 32-37 not covered above
