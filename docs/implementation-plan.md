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
- ⬜ Codex: needs a working `codex exec`, then live checks and hooks
- ⬜ Interactive-session checks: compaction and subagents
- ✅ Cursor: kept lessons written as `.cursor/rules/muninn*.mdc` per repo with `muninn cursor on`, kept out of git through `.git/info/exclude`, and rewritten when lessons change
- ⬜ Author judges it from real use

## Step 3 — Stage 2, asking and the UI
- ⬜ Items 32-37
