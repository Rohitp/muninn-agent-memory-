# Agent Memory — Build Spec

> **For Claude Code:** Build this in the phases below. Stop at the end of each phase, show what works, and wait for review before starting the next. If anything in this spec is unclear or turns out to be wrong in practice (library limits, client config formats), flag it instead of guessing.

---

## 1. What this is

A local, shared memory for coding agents. Claude Code, Codex, Cursor (and later chat apps) all read and write the same store through one MCP server, regardless of which tool or account is in use.

It stores **findings**: decisions, gotchas, failed attempts, workflows and preferences. Each one is scoped to global, tech stack, repo or branch. Agents recall relevant findings before work and save new ones after.

On top of memory, it gives agents a few extra tools: code understanding (dependency graph, blast radius, the "why" behind code), plan checks, and branch handoff between agents.

### Goals
- One memory shared across all agents and accounts on this machine
- Scope is detected automatically from where the agent is running (repo, branch, stack)
- Fast, small results: agents get a few relevant findings, not a dump
- Findings carry their reason and evidence, and are replaced rather than deleted
- Works for new and existing projects
- Fits with grill-me and Elephant-Goldfish (EGM) workflows

### Non-goals (for now)
- Team or multi-user sharing
- Hosted or cloud version (Phase 5, later)
- Replacing CLAUDE.md / AGENTS.md: those stay for stable rules; memory is for evolving knowledge

---

## 2. Stack

| Part | Choice | Notes |
|---|---|---|
| Language | TypeScript, Node 20+ | pnpm workspace; published to npm so clients can run it with `npx`. CLI entry point `amem` |
| MCP | `@modelcontextprotocol/sdk` | Daemon serves Streamable HTTP on localhost; a thin stdio shim is what clients launch (see section 2a) |
| Database | **libSQL** via `@libsql/client`, local file | Native vector column (`F32_BLOB`) + vector index |
| Keyword search | FTS5 | **Verify in Phase 0** that FTS5 is available through `@libsql/client` on a local file. If not, flag it with options |
| Embeddings | Local ONNX model via `@huggingface/transformers` (e.g. `Xenova/bge-small-en-v1.5`, 384 dims) | No API keys; nothing leaves the machine. Store model name per row. `fastembed` (npm) is the fallback if transformers.js disappoints |
| Code parsing | `web-tree-sitter` (WASM grammars: Python, TypeScript, Java first) | WASM avoids native build problems. Phase 4 |
| Review UI | Small page served by the daemon (plain HTML + a little JS, or Hono + htmx) | Phase 3 |
| Tests | Vitest | |
| Validation | zod for tool inputs | |

Data lives in `~/.agent-memory/` (DB file, config, exports, logs, model cache, daemon pid/port file). Override with `AMEM_HOME`.

### 2a. Process architecture

One **long-lived daemon** owns the database and the embedding model. Agents never open the DB directly.

```
Claude Code ─┐                                   ┌─ libSQL file
Codex ───────┼─ amem serve (stdio shim, per session) ─► amem daemon (localhost) ─┼─ embedding model (loaded once)
Cursor ──────┘                                   └─ review UI, git-hook endpoints
```

- **`amem daemon`**: a single process that loads the model once, holds the only DB connection (so there's a single writer and no lock fights), and exposes MCP over Streamable HTTP on `127.0.0.1` at a random free port. It writes `{port, token, pid}` to `~/.agent-memory/daemon.json` (file mode 600). Requests must carry the token. It never binds to non-loopback addresses.
- **`amem serve`**: the stdio MCP server that clients launch. It does three jobs:
  1. auto-starts the daemon if it isn't running, and waits for it to be ready
  2. forwards tool calls to the daemon
  3. **injects its own working directory** into every call as `cwd`, so the daemon can resolve repo, branch and stack. This is why clients go through the shim and not straight to the daemon over HTTP.
- CLI commands and git hooks talk to the same daemon, starting it if needed.
- The daemon exits after a configurable idle period (default 2 h) and restarts on the next call.
- `amem daemon status|stop|restart|logs` for control.

---

## 3. Data model

### `findings`
| Column | Type | Notes |
|---|---|---|
| id | TEXT (ULID) | |
| type | TEXT | `decision` \| `gotcha` \| `failed_attempt` \| `workflow` \| `preference` \| `run_fact` |
| scope | TEXT | `global` \| `stack` \| `repo` \| `branch` |
| repo_id | TEXT NULL | Normalised git remote URL, else absolute repo path |
| branch | TEXT NULL | Only for `branch` scope |
| stack_tags | TEXT (JSON array) | e.g. `["python","fastapi"]` |
| title | TEXT | One line |
| body | TEXT | What, why, and (for failures) what was tried and why it failed |
| status | TEXT | `draft` \| `active` \| `superseded` \| `archived` \| `pending_promotion` |
| trust | TEXT | `confirmed` (human or explicit agent save) \| `auto` (captured by hooks) |
| source_agent | TEXT | `claude-code` \| `codex` \| `cursor` \| `cli` \| `seed` … |
| source_session | TEXT NULL | |
| superseded_by | TEXT NULL | id of replacement |
| embedding | F32_BLOB(384) | libSQL vector column |
| embed_model | TEXT | |
| created_at / updated_at | TEXT (ISO) | |

Indexes: libSQL vector index on `embedding`; normal indexes on `(repo_id, branch, status)`, `(scope, status)`, `type`.

### `findings_fts`
FTS5 table over `title` and `body`, kept in sync with `findings`.

### `links`
| finding_id | kind (`file` \| `symbol` \| `commit` \| `spec` \| `finding` \| `url`) | target | anchor_commit (commit hash when linked; used for staleness) |

### `events`
Append-only history: `id, ts, actor, action (create|update|supersede|promote|archive|delete), finding_id, before_json, after_json`.

### `branch_state` (Phase 3)
`repo_id, branch, done, in_progress, blocked, next_step, updated_by, updated_at`.

### `leases` (Phase 3)
`resource (file path or task key), repo_id, holder (agent + session), expires_at`.

---

## 4. Scope resolution

Every tool call resolves context automatically:

1. Working directory: the `cwd` injected by the stdio shim (an explicit `cwd` argument from the agent overrides it).
2. `git rev-parse --show-toplevel` gives the repo root. Outside a repo → global only.
3. `repo_id` = normalised `origin` remote URL (strip protocol, `.git`, credentials), else the repo root path.
4. Branch = `git rev-parse --abbrev-ref HEAD`.
5. Stack tags = detected from manifests (`pyproject.toml`, `package.json`, `pom.xml`, `build.gradle`, `go.mod`, `Cargo.toml`) plus key dependencies (e.g. fastapi, react-native, spring). Cache per repo, refresh when a manifest changes.

When saving, agents may pass a scope. If they don't, the default is `repo` (or `global` outside a repo). `branch` scope only when explicitly asked or for branch handoff and in-progress notes.

---

## 5. MCP tools

Keep the tool list small. Agents choose worse as it grows. Descriptions should be short and say *when* to use each tool.

### Memory (Phase 1)

**`recall(query, types?, scope?, limit=5, cwd?)`**
Use at the start of a task and when stuck.
- Candidates: findings with status `active` (and `draft`, marked as unconfirmed) on the scope ladder: current branch → repo → matching stack tags → global. Never other repos' repo- or branch-scoped findings.
- Rank by hybrid score: vector similarity + FTS5 relevance + scope boost (closer scope ranks higher) + small recency and trust boosts. Weights in config.
- Return: id, type, scope, title, short body, date, trust, a `stale` flag (Phase 2), and a one-line "why matched".
- Keep the total response under a configurable token budget (default ~1,500 tokens).

**`remember(type, title, body, scope?, links?, tags?, cwd?)`**
Use after resolving a non-trivial bug, rejecting an approach, making a decision or learning a workflow.
- Dedupe: if a finding in the same scope and type is very similar (cosine ≥ threshold, default 0.90), don't create a new one. Return the existing one and suggest `supersede`.
- Links to files get `anchor_commit` = current HEAD.

**`supersede(id, new_body, reason, cwd?)`**
Creates the replacement finding, marks the old one `superseded`, and links the two.

**`list_findings(filters…)`**
For browsing and review: by scope, type, status, repo, branch, date.

### Grouped extra tools (Phases 3–4)

**`handoff(action, …)`**: `get` / `set` branch state; `lease` / `release` a file or task.

**`understand(target, cwd?)`**: for a file, symbol or path, returns:
- dependency info: what it imports or calls, and what depends on it
- blast radius: things likely affected by changing it
- co-change: files that usually change with it (from git history)
- hotspot flag: high churn × size or complexity
- **why**: decisions, failed attempts, gotchas and specs linked to it (from memory `links`), plus recent relevant commit messages

**`check(plan_or_diff, cwd?)`**: before building or committing:
- matches against `failed_attempt` and rejected-approach findings ("this looks like X, which failed because Y")
- flags touched hotspots, and co-change files that are missing from the change
- lists tests that cover the touched files (test map)
- returns repo conventions from memory that apply

---

## 6. Lifecycle

### Capture
- **Explicit:** agents call `remember` (trust `confirmed`).
- **Claude Code hook (Phase 3):** a `SessionEnd` / `Stop` hook runs `amem capture --transcript <path>`. It extracts candidate findings as `draft` / `auto`. Extraction needs an LLM: use `claude -p` (headless) if available, else an API key from config, else just queue the transcript for manual review. Make it optional.
- Codex and Cursor rely on the instruction rule (section 8).

### Staleness (Phase 2)
For findings linked to files, count commits that touched the file since `anchor_commit`. Above a threshold (default 5), or if the file was deleted or renamed, set `stale: true` in recall results with a hint: "predates N commits to X — confirm or supersede". Never auto-delete.

### Branch merge (Phase 2)
`amem hooks install` adds a git `post-merge` hook. After a merge into the default branch, the merged branch's findings are marked `pending_promotion`. `amem promote` (interactive CLI) lets you promote each one to repo scope or archive it. Agents can do the same via `list_findings` + `supersede`.

### Export (Phase 2)
`amem export` writes JSONL (one finding per line, plus links) to `~/.agent-memory/export/`, suitable for committing to a private git repo. `amem import` restores from it. The DB stays the source of truth.

### Seeding an existing project (Phase 2)
`amem seed` in a repo:
- imports stable statements from CLAUDE.md, AGENTS.md, `docs/`, ADRs and `docs/designs/` (EGM specs) as `draft` findings with links to their source files
- mines git history for reverts, "fix"/"revert"/"hotfix" commits and high-churn files, creating draft gotchas and hotspot notes
- everything lands as `draft` for human confirmation in the review UI or CLI

---

## 7. Workflow integrations

### grill-me
grill-me is stateless by design. Provide a skill, `memory-grill`, that wraps it:
1. Before the interview: `recall` decisions and preferences for this repo and stack, and present them as "confirm or challenge" with their dates. Never present them as settled.
2. After: save each settled answer with `remember(type=decision)`; replaced decisions go through `supersede`.

### Elephant-Goldfish (EGM)
- **Elephant (drafting agent):** must `recall` before brainstorm and draft.
- **Goldfish (fresh reviewers):** must **not** use memory tools. Their value comes from having no context. The integration skill tells reviewers explicitly not to call `recall`.
- **Optional "history reviewer":** a separate reviewer that gets only the draft plus `failed_attempt` findings, and checks whether you're repeating past failures. It runs in addition to the normal goldfish, never instead of them.
- **After Resolve:** accepted findings → `decision`; rejected → `decision` recording the rejected approach and the reason. Link to the spec file in `docs/designs/`.
- Reuse the Phase 2 staleness logic alongside EGM's drift report: same idea (does this still match the code?), one mechanism.

Ship these as skill files in `integrations/` with install instructions for Claude Code and Codex.

---

## 8. Setup and agent instructions

**`amem init`** (one-time, global):
- creates `~/.agent-memory/`, the DB and default config, downloads the embedding model, and starts the daemon once to verify it
- registers the stdio shim (`npx -y amem serve`, or the global `amem serve` if installed) with each client:
  - Claude Code: `claude mcp add --scope user amem -- amem serve`
  - Codex: adds `[mcp_servers.amem]` to `~/.codex/config.toml`
  - Cursor: adds to `~/.cursor/mcp.json`
  - Verify each format against current docs. Print a manual snippet for anything it can't write safely.
- adds the rule below to `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` (inside marked blocks, idempotent), and prints it for pasting into Cursor user rules

**`amem init --repo`** (per repo, optional): installs git hooks, detects the stack, and offers `amem seed`.

**Rule text:**
```
## Shared memory (amem)
- Before starting a task, call `recall` with a short description of the task.
- Treat recalled decisions as context to confirm or challenge, not as fixed rules. Respect findings marked failed_attempt.
- After resolving a non-trivial bug, rejecting an approach, making a design decision, or learning how to run/test something, call `remember` with what happened, why, and what worked.
- If a recalled finding is wrong or outdated, call `supersede`.
- When switching off a branch or ending a session mid-task, call `handoff` with action=set.
```

---

## 9. CLI

`amem serve` (stdio shim) · `daemon start|stop|status|restart|logs` · `init` · `init --repo` · `recall "<query>"` · `remember` (interactive) · `list` · `show <id>` · `supersede <id>` · `promote` · `seed` · `capture` · `export` / `import` · `hooks install` · `doctor` (checks DB, model, client registrations, hooks) · `ui` (Phase 3).

---

## 10. Review UI (Phase 3)

A page served by the daemon (`amem ui` opens it; localhost only, token-protected) with:
- an inbox of `draft` and `pending_promotion` findings: confirm, edit, promote, archive
- a stale list
- search and browse by repo, branch, type and scope
- a finding detail page: history from `events`, links, superseded chain

---

## 11. Phases and acceptance criteria

### Phase 0 — Spike
- `@libsql/client` on a local file: create a table with an `F32_BLOB` vector column and vector index, insert, top-k query with a SQL filter in the same query
- FTS5 works in the same DB file through the same client
- transformers.js produces embeddings locally; measure model load time and per-embedding latency
- Minimal daemon + stdio shim: a Claude Code session calls a dummy tool through the shim, and the daemon receives the correct `cwd`
- **Done when:** short scripts demonstrate all of the above; findings and timings are written up in `docs/spike.md`

### Phase 1 — Core memory
- Daemon + shim (auto-start, token, idle exit), schema, scope resolver, `recall` / `remember` / `supersede` / `list_findings`, hybrid ranking, dedupe, events log
- `amem init` registers with Claude Code, Codex and Cursor, and installs the rule text
- **Done when:** a finding saved from Claude Code in repo A on branch X is recalled in Codex and Cursor in repo A; it is *not* returned in repo B; global findings appear everywhere; tests cover scope isolation and the ranking order

### Phase 2 — Lifecycle
- Staleness, post-merge promotion flow, export/import, `amem seed`
- **Done when:** editing a linked file 5+ times marks the finding stale; merging a branch puts its findings in `pending_promotion`; export→wipe→import round-trips exactly

### Phase 3 — Handoff, capture, UI
- `handoff` (branch state + leases with expiry), Claude Code capture hook, review UI
- **Done when:** branch state set in Claude Code is returned by `handoff get` in Codex; a lease blocks a second agent until it expires or is released; a session produces draft findings that show up in the UI inbox

### Phase 4 — Understand and check
- tree-sitter dependency graph for Python, TypeScript and Java (imports + calls, best effort); co-change from `git log`; hotspots; test map (by naming convention + imports); `understand` and `check` tools
- Index incrementally, with the cache stored in the same DB
- **Done when:** on a real repo, `understand(file)` returns dependents, co-change files and linked findings in under 2 s after the first index; `check(diff)` flags a change that matches a recorded failed attempt

### Phase 5 — Hosted (later, not now)
libSQL embedded replica syncing to Turso Cloud, plus an HTTP MCP endpoint with auth so claude.ai and other chat apps can use the same memory.

---

## 12. Quality bar

- Tests for: scope isolation, ranking, dedupe, supersede chains, staleness, the merge flow, several shims calling at once, daemon auto-start and restart
- `recall` p95 under 150 ms on 10k findings with a warm daemon; first call after a cold daemon start under 5 s
- No network calls except the one-time model download (and the optional LLM call for capture)
- Clear errors when run outside a git repo, with a missing model, or with a locked DB
- README with install, client setup, the rule text and troubleshooting

---

## 13. Open questions (decide during build)

1. Ranking weights: start simple and tune using a small hand-made eval set of queries.
2. Should `draft` findings appear in `recall` by default (marked) or only on request? Default: shown, marked, ranked lower.
3. Lease expiry default (proposed 30 min, renewed on activity).
4. Whether `understand` should also cover Cursor/Codex session logs as a "why" source.
5. Project name: `amem` is a placeholder.
---

> **Archived 2026-11-03.** `docs/designs/muninn.md` replaces this build spec. It is kept for history, and nothing here is the plan.
