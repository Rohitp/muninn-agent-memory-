# muninn — Implementation Plan (Tracker)

Living execution tracker. The **spec** (what/why/how) lives in
`docs/designs/muninn.md` once EGM drafting finishes; this file is the ordered
task list with status. The phases below mirror `agents.md` §11 and are
**out of date** until the EGM design doc is reviewed — review may reshape them.

Status legend: ⬜ todo · 🟦 in progress · ✅ done · ⛔ blocked · ⏭️ deferred

## Current status
- **Phase:** Pre-build (EGM design)
- **Next action:** Human review of the changed design doc, then Step 0 of `docs/designs/muninn.md`. The phases below come from `agents.md`, are out of date, and get replaced by Step 0, item 2.
- **Blockers:** none.

## Pre-build — EGM design
- ✅ Upgrade Claude Code to ≥ 2.1.271 (now 2.1.317) — Goldfish isolation requirement
- ✅ Install + enable EGM plugin (`egm@egm`, local marketplace)
- ✅ `/egm:egm-brainstorm` → `concepts_brief.md`, with `docs/checks/`
- ✅ `/egm:egm-draft` → `docs/designs/muninn.md` from `concepts_brief.md`
- ✅ `/egm:egm-review` → Goldfish review, Stage 9 findings resolved 2026-11-03; Stage 7 and 8 findings on lines 1-533 partly open
- ⬜ Human review of the design doc
- ⬜ Reconcile plan phases below against the hardened design doc

## Phase 0 — Spike (gate before any real code)
Acceptance: short scripts prove each; findings + timings written to `docs/spike.md`.
- ⬜ `@libsql/client` on a local file: `F32_BLOB` vector column + vector index; insert; top-k query with a SQL filter in one query
- ⬜ FTS5 works in the same DB file through the same client *(flag with options if not)*
- ⬜ transformers.js (`Xenova/bge-small-en-v1.5`, 384d) embeds locally; measure load time + per-embed latency
- ⬜ Minimal daemon + stdio shim: a Claude Code session calls a dummy tool through the shim; daemon receives correct `cwd`
- ⬜ Write up `docs/spike.md`

## Phase 1 — Core memory
Acceptance: finding saved from Claude Code in repo A branch X is recalled in Codex/Cursor in repo A; not returned in repo B; global findings appear everywhere; tests cover scope isolation + ranking order.
- ⬜ Daemon + shim (auto-start, token, idle exit)
- ⬜ Schema (`findings`, `findings_fts`, `links`, `events`)
- ⬜ Scope resolver (cwd → repo_id → branch → stack tags)
- ⬜ Tools: `recall`, `remember`, `supersede`, `list_findings`
- ⬜ Hybrid ranking (vector + FTS5 + scope/recency/trust boosts), dedupe, events log
- ⬜ `amem init` registers Claude Code / Codex / Cursor + installs rule text
- ⬜ Tests: scope isolation, ranking, dedupe, supersede chains
- ⬜ **Dogfood milestone:** migrate devlog findings into muninn; register muninn MCP with this Claude Code

## Phase 2 — Lifecycle
Acceptance: editing a linked file 5+ times marks finding stale; merging a branch → `pending_promotion`; export→wipe→import round-trips exactly.
- ⬜ Staleness (commits since `anchor_commit`)
- ⬜ post-merge promotion flow (`amem hooks install`, `amem promote`)
- ⬜ `amem export` / `import` (JSONL)
- ⬜ `amem seed` (CLAUDE.md/AGENTS.md/docs/ADRs + git-history mining)

## Phase 3 — Handoff, capture, UI
Acceptance: branch state set in Claude Code returned by `handoff get` in Codex; a lease blocks a second agent until expiry/release; a session produces draft findings in the UI inbox.
- ⬜ `handoff` (branch state + leases with expiry)
- ⬜ Claude Code capture hook (`SessionEnd`/`Stop` → `amem capture`)
- ⬜ Review UI (daemon-served, localhost, token-protected)

## Phase 4 — Understand and check
Acceptance: `understand(file)` returns dependents/co-change/linked findings < 2s after first index; `check(diff)` flags a change matching a recorded failed attempt.
- ⬜ tree-sitter dependency graph (Python, TypeScript, Java)
- ⬜ co-change (git log), hotspots, test map
- ⬜ `understand`, `check` tools; incremental index in the same DB

## Phase 5 — Hosted (later, not now)
- ⏭️ libSQL embedded replica → Turso Cloud; HTTP MCP endpoint with auth

## Quality bar (ongoing)
- ⬜ `recall` p95 < 150 ms on 10k findings (warm); cold-start first call < 5 s
- ⬜ No network calls except one-time model download (+ optional LLM capture)
- ⬜ Clear errors: outside a git repo, missing model, locked DB
- ⬜ README: install, client setup, rule text, troubleshooting
