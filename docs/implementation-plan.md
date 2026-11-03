# muninn — Implementation Plan (Tracker)

Living execution tracker. The spec is `docs/designs/muninn.md`. This file lists its steps with status, and the journal is `docs/devlog.md`.

Status legend: ⬜ todo · 🟦 in progress · ✅ done · ⛔ blocked · ⏭️ deferred

## Current status
- **Step:** 0, clean up, baseline and spike
- **Next action:** Author raises `cleanupPeriodDays` to 365 in Claude Code. Then item 5, saving logs, and item 6, the signal check.
- **Blockers:** none.

## Pre-build — EGM design
- ✅ Upgrade Claude Code to ≥ 2.1.271 (now 2.1.317) — Goldfish isolation requirement
- ✅ Install + enable EGM plugin (`egm@egm`, local marketplace)
- ✅ `/egm:egm-brainstorm` → `concepts_brief.md`, with `docs/checks/`
- ✅ `/egm:egm-draft` → `docs/designs/muninn.md` from `concepts_brief.md`
- ✅ `/egm:egm-review` → reports in `docs/reviews/`. Some findings on lines before the plan stay open

## Step 0 — Clean up, baseline and spike
- ⬜ Author: raise `cleanupPeriodDays` to 365
- ✅ 1. Archive `agents.md`
- ✅ 2. Update tracker and devlog
- ✅ 3. Delete `design_draft.md`
- ✅ 4. Package and build config
- ⬜ 5. Save logs for the 2 gate repos
- ⬜ 6. Signal check: run the rules on real logs, author labels the output
- ⬜ 7. Client checks (`docs/checks/client-live-tests.md`)
- ⬜ 8. libSQL, fallback and hook latency checks
- ⬜ 9. Embedding and matching checks
- ⬜ 10. `docs/spike.md`, then delete the spike scripts
- ⬜ **Gate:** Step 0

## Settle After Step 0
- ⬜ Clear the design's Settle After Step 0 list
- ⬜ Review Steps 1-3 again. They are provisional and not built until then

## Step 1 — Stage 1, the learner (provisional)
- ⬜ Items 11-23
- ⬜ **Gate:** to Stage 2

## Step 2 — Stage 2, delivery (provisional)
- ⬜ Items 24-31
- ⬜ **Gate:** after delivery

## Step 3 — Stage 2, asking and the UI (provisional)
- ⬜ Items 32-37
