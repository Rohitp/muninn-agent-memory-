# Client capabilities: Claude Code, Codex CLI, Cursor

Checked 2026-11-03. All web sources were accessed on that date. Nothing here was tested live: no hook was installed and no headless run was started, so that this check stayed read-only. A "documented" label means the vendor says so, not that it was seen working.

**Installed versions**

| Client | Version | How read |
|---|---|---|
| Claude Code | 2.1.317 | `claude --version` |
| Codex CLI | codex-cli 0.133.0 | `codex --version` |
| Cursor | 3.25.9 (VS Code 1.128.0, built 2026-10-15) | `cursor --version`, and `product.json` in the app bundle |

Two gaps affect how to read the table:

- **Codex CLI is old here.** 0.133.0 was released 2026-05-21, and npm reports 0.163.0 (a package filter on this machine may hide newer ones). The ChatGPT desktop app ships its own Codex, 0.155.0-alpha.2.6, and 180 of the 185 threads recorded on this machine match that version. The Codex docs describe a newer product than the CLI on the PATH.
- **The Cursor CLI is not installed on the PATH.** `agent` and `cursor-agent` were not found. All Cursor local evidence comes from the desktop app.

## Comparison

Labels: **Doc** = documented, **Seen** = observed locally, **Unknown** = no documentation or observation found. Code findings are labelled Seen and say that they come from code. They show what the code contains, not that the behaviour reaches the model. How each was seen is in the notes.

| Row | Claude Code 2.1.317 | Codex CLI 0.133.0 | Cursor 3.25.9 |
|---|---|---|---|
| **1. Hooks** | **Doc:** 33 events, including `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Stop`, `SessionEnd`, `PreCompact`, `PostCompact`. [hooks](https://code.claude.com/docs/en/hooks) | **Doc:** 14 events, including `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `SessionEnd`, `PreCompact`, `PostCompact`, on by default, but each hook must be reviewed and trusted first. [hooks](https://learn.chatgpt.com/docs/hooks) **Seen:** `codex features list` shows `hooks` stable and on. Some documented items are not in 0.133.0. | **Doc:** 21 events, including `sessionStart`, `beforeSubmitPrompt`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `stop`, `sessionEnd`, `preCompact`. [hooks](https://cursor.com/docs/hooks) **Doc:** also runs Claude Code hooks by default. [third-party hooks](https://cursor.com/docs/reference/third-party-hooks) |
| **2a. Add text to context: from which events** | **Doc:** `SessionStart`, `SubagentStart`, `UserPromptSubmit`, `UserPromptExpansion`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Stop`, `SubagentStop`, `PostModelSwitch`. `PreToolUse` text arrives alongside the tool result, so after the call was made. [hooks](https://code.claude.com/docs/en/hooks) | **Doc:** `SessionStart`, `UserPromptSubmit`, `SubagentStart`, `PreToolUse`, `PostToolUse`. [hooks](https://learn.chatgpt.com/docs/hooks) **Seen (source at the 0.133.0 tag):** `PreToolUse` and `PostToolUse` parse the field. | **Doc:** `sessionStart`, `postToolUse`, `postToolUseFailure` only. [hooks](https://cursor.com/docs/hooks) **Seen (app code):** also passed through for `beforeSubmitPrompt` and `preToolUse`. **Unknown:** whether those two reach the model. |
| **2b. Size limit** | **Doc:** 10,000 characters. Longer text is saved to a file and replaced by the path and a 2,000-character preview. No setting raises it. [hooks](https://code.claude.com/docs/en/hooks) | **Doc:** about 2,500 tokens per message, longer text saved to a temp file with a preview; `additionalContextLimit` changes it. [hooks](https://learn.chatgpt.com/docs/hooks) **Seen:** 0.133.0 has the 2,500 cap in source but not the setting. | **Doc:** none stated. **Seen (app code):** 10,000 characters, and over-limit text is dropped entirely with a log warning, on at least the code path checked. |
| **3a. Compaction signal** | **Doc:** `PreCompact` (can block) and `PostCompact` (receives the summary, cannot affect the result). [hooks](https://code.claude.com/docs/en/hooks) | **Doc:** `PreCompact` and `PostCompact`, `continue: false` stops it, stdout ignored. [hooks](https://learn.chatgpt.com/docs/hooks) **Seen:** both in 0.133.0 source. | **Doc:** `preCompact` only, observe-only, can show a message to the user. No post-compaction event listed. [hooks](https://cursor.com/docs/hooks) |
| **3b. Add context after compaction** | **Doc:** yes. `SessionStart` hooks matching `compact` run and their output is added to the compacted context. Text that hooks added earlier is summarised away. [context window](https://code.claude.com/docs/en/context-window) | **Doc:** `SessionStart` has a `compact` matcher. [hooks](https://learn.chatgpt.com/docs/hooks) **Seen (source at tag):** compaction queues that hook, and it runs on a later turn. Not seen delivering. | **Unknown:** no documented way. `sessionStart` is documented only for a new conversation. |
| **4a. Transcript location** | **Doc:** `~/.claude/projects/<project>/<session-id>.jsonl`, 30-day default retention. [sessions](https://code.claude.com/docs/en/sessions) | **Doc:** hooks receive `transcript_path`. [hooks](https://learn.chatgpt.com/docs/hooks) **Seen:** `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (185 files). Retention **unknown**. | **Doc:** hooks receive `transcript_path`, null if transcripts are off. [hooks](https://cursor.com/docs/hooks) **Seen:** `~/.cursor/projects/<slug>/agent-transcripts/<id>/<id>.jsonl` (22 files). Retention **unknown**. |
| **4b. Format documented or stable** | **Doc:** explicitly not. "Internal", "changes between versions", can break on any release. Use `/export`, `claude -p`, or hook `transcript_path`. [sessions](https://code.claude.com/docs/en/sessions) | **Doc:** explicitly not stable for hooks. [hooks](https://learn.chatgpt.com/docs/hooks) **Seen:** the shape differs between versions recorded here. | **Unknown:** no format documentation found. |
| **4c. Transcript contents** (structure scan only) | **Seen:** tool calls yes, tool output yes, working directory yes, branch yes, model yes, token counts yes. | **Seen:** tool calls yes, tool output yes, working directory yes, branch yes, model yes (in `turn_context`, absent from one sampled file), token counts yes. | **Seen:** tool calls yes, tool output **no**, working directory no, branch no, model no, token counts no. Tool results and tokens do exist in undocumented local databases. |
| **5a. MCP stdio working directory** | **Doc:** not stated. **Seen:** two live servers ran in the same directory as their client, a project folder. | **Doc:** `cwd` is an option, default not stated. [MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) **Seen (source at tag):** with no `cwd`, falls back to the turn's working directory. No live server seen. | **Doc:** not stated, and `cwd` is not listed as a field. [MCP](https://cursor.com/docs/mcp) **Seen:** one live server ran in the home directory while Cursor's process was at `/`. App code also accepts a `cwd` field. |
| **5b. Can it find the project** | **Doc:** yes, two ways. `CLAUDE_PROJECT_DIR` in the server's environment, and `roots/list` (launch directory plus added directories, with change notifications). [MCP](https://code.claude.com/docs/en/mcp) | **Doc:** roots not mentioned. **Seen (source at tag):** client declares `roots: None`. Newer versions **unknown**. A project-scoped server can be set in `.codex/config.toml`. | **Doc:** Roots "Supported", and `${workspaceFolder}` in config. [MCP](https://cursor.com/docs/mcp) **Seen (app code):** roots returns the open workspace folders, with `listChanged: false`, so no change notification. |
| **5c. Per session or workspace** | **Doc:** local, project and user scopes. [MCP](https://code.claude.com/docs/en/mcp) **Unknown:** process lifetime. | **Doc:** project scoping for trusted projects only. **Unknown:** process lifetime, including whether the desktop app shares a server across projects. | **Doc:** project `.cursor/mcp.json` and global `~/.cursor/mcp.json`. **Unknown:** process lifetime, and what `${workspaceFolder}` means in the global file. |
| **6a. One-off prompt from a script** | **Doc:** `claude -p`, with JSON output including usage and cost. [headless](https://code.claude.com/docs/en/headless) | **Doc:** `codex exec`, with `--json` and token usage on `turn.completed`, `--ephemeral` to skip saving. [non-interactive](https://learn.chatgpt.com/docs/non-interactive-mode) | **Doc:** `agent -p`, `--model`, `CURSOR_API_KEY`. [headless](https://cursor.com/docs/cli/headless), [parameters](https://cursor.com/docs/cli/reference/parameters) **Seen:** CLI not on PATH here. |
| **6b. Does that fire the client's hooks** | **Doc:** yes, unless `--bare`. `--bare` skips hooks but also the subscription login, and will become the default for `-p`. `--settings '{"disableAllHooks": true}'` turns hooks off for a run. [headless](https://code.claude.com/docs/en/headless), [hooks](https://code.claude.com/docs/en/hooks) | **Doc:** not addressed. **Seen:** `codex exec --help` offers `--dangerously-bypass-hook-trust`, and exec source handles hook events. Not seen firing. | **Unknown:** not addressed in the headless docs. A forum post says some hooks fire in the CLI and some do not. |
| **7. Built-in memory** | **Doc:** `CLAUDE.md`, rules, `AGENTS.md` when there is no `CLAUDE.md`; auto memory on by default, first 200 lines or 25KB loaded each session, both re-injected after compaction. [memory](https://code.claude.com/docs/en/memory), [context window](https://code.claude.com/docs/en/context-window) | **Doc:** `AGENTS.md` chain built once per run; Memories off by default, generated in the background from past chats. [memories](https://learn.chatgpt.com/docs/customization/memories?surface=cli) **Seen:** `memories` experimental and off; store empty. | **Doc:** rules (always, description, globs, manual), `AGENTS.md`; CLI also reads `CLAUDE.md`. [rules](https://cursor.com/docs/rules), [CLI](https://cursor.com/docs/cli/using) **Unknown:** whether the Memories feature still exists. |

## Prior notes: confirmed or refuted

| Prior note | Result |
|---|---|
| Claude Code shows additional context for `UserPromptSubmit`, `SessionStart`, `PostToolUse`, not clearly `PreToolUse` | **Partly refuted.** `PreToolUse` is documented too, but the text arrives alongside the tool result. It cannot influence the call it fires on. |
| Claude Code `SessionStart` has a `compact` source | **Confirmed**, and documented as the way to re-add context. |
| Codex: no evidence of hooks in `~/.codex/config.toml` | **True of this config, wrong as a conclusion.** The config has no `hooks` or `features` table and there is no `~/.codex/hooks.json`, so no hooks are set up. But hooks exist, are documented, and are on by default. |
| Cursor: minified code handles `additional_context` for `beforeSubmitPrompt` and `sessionStart` | **Confirmed and extended.** Code also covers `preToolUse`, `postToolUse` and `postToolUseFailure`. The docs do not list `beforeSubmitPrompt` or `preToolUse`, so those two are undocumented. |
| Cursor: sampled logs have few fields and no tool output | **Confirmed for the transcripts:** 8,357 tool calls and 0 tool results across all 22 files. Not the whole picture, as other local stores and hooks do carry tool output. |

## Notes

### How this was checked

- **Privacy.** Session logs were read by scripts that print only key names, JSON types and counts. Record types were matched against a fixed list, and anything else was counted as "other". SQLite files were opened in immutable mode, and only table names, column names and counts were read. `~/.claude/history.jsonl` and `~/.codex/auth.json` were not opened. Nothing in this report comes from message content.
- **Sample sizes.** Claude Code: 8 newest transcripts outside this project for shape, 46 of the 47 for counts (this session excluded). Codex: 10 newest rollouts for shape, plus one per version for comparison. Cursor: all 22 transcripts.
- **Doc reading.** Several long pages were read through a summarising fetch tool, which can misquote. The Cursor hooks page and Claude Code's sessions, headless and context-window pages were read as raw text. The Claude Code hooks page and all OpenAI pages were read through the summariser, so check the exact wording before relying on it.
- **Code evidence.** Cursor code was read from the minified bundle in `/Applications/Cursor.app/Contents/Resources/app/extensions/`. Codex source was read from GitHub at tag `rust-v0.133.0`. Reading code shows what exists at that version, not what happens at run time.
- **Redirect.** `developers.openai.com/codex/...` pages now redirect to `learn.chatgpt.com/docs/...`. The redirect targets are cited.

### Claude Code

- **Injection formats.** `hookSpecificOutput.additionalContext`, or plain stdout on `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart` and `PostModelSwitch`. Source: https://code.claude.com/docs/en/hooks
- **Delivered text is recorded.** The docs say injected context produces no "visible transcript entry". Locally, the transcripts held 4 attachment records of a hook-context type, with keys `content`, `hookEvent`, `hookName` and `toolUseID`. This could support measuring delivery, but it is an internal format.
- **Compaction detail.** Locally, 2 `compact_boundary` records were found across the transcripts, carrying `preTokens`, `postTokens` and `trigger`. Project-root `CLAUDE.md` and auto memory are re-injected. Path-scoped rules and earlier hook text are not. Source: https://code.claude.com/docs/en/context-window
- **Retention.** Transcripts are removed after 30 days by default (`cleanupPeriodDays`). Anything learned from transcripts has to be read before then. Source: https://code.claude.com/docs/en/sessions
- **Hooks in `-p`.** "Without `--bare`, a `-p` session runs the hooks in a project's `.claude/settings.json`", with no trust prompt. `--bare` never reads OAuth credentials and needs an API key, and is "the recommended mode" that "will become the default for `-p` in a future release". A script relying on subscription login would then need different flags. `-p` runs also write transcripts unless `--no-session-persistence` is set. Source: https://code.claude.com/docs/en/headless
- **Installed binary check.** Strings in the 2.1.317 binary include `PostCompact`, `PostToolBatch`, `hook_additional_context`, `roots/list` and `CLAUDE_PROJECT_DIR`. This matches the docs but is not a run-time test.
- **Other copies.** The desktop app has its own Claude Code (a 2.1.309 process was running). Only one `claude` is on the PATH. Other installs noted in `docs/devlog.md` were not rechecked.
- **Competing feature.** Auto memory already saves corrections and project notes, and loads them each session. Store: `~/.claude/projects/<project>/memory/`; 4 such directories exist here. Source: https://code.claude.com/docs/en/memory

### Codex

- **Trust.** Non-managed hooks must be reviewed and trusted, and trust is recorded against the hook's current hash, so a changed hook needs review again. Project hooks load only from trusted projects. `/hooks` manages this. Source: https://learn.chatgpt.com/docs/hooks
- **Docs ahead of 0.133.0.** Not in the installed binary: `PreModelRequest`, `additionalContextLimit`. The `fork` source for `SessionStart` is documented but not in the 0.133.0 source enum. Present: `PreCompact`, `PostCompact`, `SessionStart`, `additionalContext`. How read: string search of the binary, source at the tag.
- **Old conflicting reports.** Issue [#19385](https://github.com/openai/codex/issues/19385) (`PreToolUse` rejects the field, filed on 0.124.0) is closed as implemented, and the 0.133.0 source parses it. Issue [#45999](https://github.com/openai/codex/issues/45999) (`SessionStart` rejects it) was withdrawn by its author, who found the failure came from another hook and a wrong output shape. The field must sit inside `hookSpecificOutput`. That author's measurements were on `codex exec` at 0.154.0 and show a `SessionStart` hook injecting there. This is third-party evidence, not documentation.
- **Unclear failure messages.** The same issue reports a failure message naming neither the hook nor the rejected field.
- **Transcript shape.** Rollouts have record types `session_meta` (with `cwd`, `git.branch`, `cli_version`), `turn_context` (with `model`), `response_item` (tool calls and outputs), `event_msg` (with token counts) and `compacted`. `turn_context` had 7 keys in the 0.94.0 sample and 13 in 0.130.0 and 0.133.0, and the one 0.155 sample had none, though other recent rollouts do.
- **Undocumented index.** `~/.codex/state_5.sqlite` has a `threads` table with `rollout_path`, `cwd`, `git_branch`, `model`, `tokens_used`. Of 185 rows, 113 have a branch, 122 a model and 105 a token count above zero. No documentation for this table was found.
- **MCP.** Config keys `mcp_servers.<id>.cwd`, `env` and `env_vars`. Source: https://learn.chatgpt.com/docs/config-file/config-reference. The roots finding comes from `codex-rs/codex-mcp/src/rmcp_client.rs` at the tag. Newer versions could not be confirmed, as the check of that file at 0.163.0 returned nothing.
- **`AGENTS.md`.** One file per directory from the project root down to the working directory, built once per run, capped by `project_doc_max_bytes`. Source: https://developers.openai.com/codex/agent-configuration/agents-md (via search result).
- **Memories.** Controlled by `features.memories` and `memories.use_memories`. `~/.codex/memories` is empty here and the `stage1_outputs` table has 0 rows. How much is injected is not stated. Source: https://learn.chatgpt.com/docs/customization/memories?surface=cli

### Cursor

- **Claude Code hook import.** On by default ("Include Third-Party Plugins, Skills, and Other Configs"). It reads `.claude/settings.local.json`, `.claude/settings.json` and `~/.claude/settings.json`, and maps 8 events, including `SessionStart`, `PreCompact`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit`. `PostCompact` is not on the list. A tool installing hooks for both clients could run twice in Cursor. Source: https://cursor.com/docs/reference/third-party-hooks
- **A doc tension in `sessionStart`.** It "runs as fire-and-forget; the agent loop does not wait", yet its `additional_context` goes into "the conversation's initial system context". If the hook is slow, the text could miss the first request. Source: https://cursor.com/docs/hooks
- **Tool output through hooks.** `postToolUse` input documents `tool_output` and `cwd`, so a hook can capture what the transcript leaves out. All hooks get `conversation_id`, `model`, `workspace_roots`, `transcript_path`. Only `subagentStart` lists `git_branch`. Source: https://cursor.com/docs/hooks
- **App code on context.** `extensions/cursor-agent-host/dist/main.js` has an internal list `HOOK_STEPS_SUPPORTING_ADDITIONAL_CONTEXT` with `sessionStart`, `beforeSubmitPrompt`, `preToolUse`, `postToolUse`, `postToolUseFailure`, and a 10,000-character check that drops over-limit text. This is undocumented and could change without notice.
- **Other local stores.** All undocumented, and all structure-only here.
  - `state.vscdb`, table `cursorDiskKV`: message records with key names including `toolFormerData.result`, `tokenCount.inputTokens`, `modelInfo.modelName`.
  - `~/.cursor/ai-tracking/ai-code-tracking.db`: tables including `scored_commits` (with `branchName`) and `conversation_summaries`.
  - `agent-transcripts/<id>/compaction/`: about 8.3MB of Markdown segments. Their contents were not examined.
- **Roots.** The docs list Roots as supported. Source: https://cursor.com/docs/mcp. `${workspaceFolder}` is defined as "the folder that contains `.cursor/mcp.json`", which does not settle what it means for a global server.
- **CLI hook coverage.** A [forum post](https://forum.cursor.com/t/cursor-cli-doesnt-send-all-events-defined-in-hooks/148316/9) from April 2026, no version given, says `sessionStart`, `postToolUse`, `stop` and shell and edit hooks fire in the CLI, and `afterAgentResponse` and `afterAgentThought` do not. The page does not establish the author as staff.
- **Headless docs disagree.** The headless page says that without `--force`, changes are only proposed. The parameters page says `-p` "has access to all tools, including write and shell". Sources: https://cursor.com/docs/cli/headless, https://cursor.com/docs/cli/reference/parameters
- **Memories.** The [1.0 changelog](https://cursor.com/changelog/1-0) introduced them. A [forum reply](https://forum.cursor.com/t/are-my-memories-gone/144057) says they were removed in 2.1.x. `cursor.com/docs/context/memories` now lands on the rules page. Five search terms for the feature had no hits in the two 3.25.9 bundles searched, which is weak evidence, so this stays unknown. `cursor.com/docs/agent-sdk/reference/memory.md` is a separate SDK topic and its package name is not Cursor's, so it was not relied on.

### Local process check (row 5)

`lsof` compared each server's working directory with its client's, for processes with "mcp" in their command line whose parent was a client. Results: Claude Code 2 of 2 same as client, Cursor 1 server in the home directory. No Codex CLI servers were running. Samples are very small.

## What still needs a live hands-on test

Each test should use a throwaway project and a hook that returns a unique made-up fact, then ask the model for that fact. That proves delivery instead of trusting a status message.

**Delivery**

1. **Cursor `beforeSubmitPrompt` and `preToolUse` context.** Does undocumented `additional_context` reach the model? This decides whether Cursor has prompt-time delivery.
2. **Cursor `sessionStart` timing.** With a hook that sleeps 0, 2 and 10 seconds, does the text reach the first request?
3. **Pre-tool timing on all three.** Does `PreToolUse` text arrive before the model next acts, or only with the result? Claude Code documents the latter. Codex and Cursor are not clear. Is deny-with-reason the only way to steer the current call?
4. **Injection size.** Cursor at 9,999 and 10,001 characters. Claude Code and Codex above their caps: does the model actually open the saved file?
5. **Delivery in subagents.** Does each client's hook text reach subagents, and do their tool calls fire the hooks?

**Compaction**

6. **Claude Code and Codex `SessionStart` with `compact`.** Force compaction, then ask for the fact. For Codex, test both 0.133.0 and the app's 0.155 build, and note which turn the text arrives on.
7. **Cursor after compaction.** Does `sessionStart` fire again? If not, can `preCompact` set a flag so that a later `postToolUse` re-adds the text?
8. **Cursor's `preCompact` on a Claude-format hook.** Does a `matcher` of `auto` or `manual` work through the import?

**MCP and project detection**

9. **Working directory and roots per client.** A logging server that records its directory, environment, `roots/list` result and process ID, launched from user-level config, across two projects open at once. Include the Codex desktop app, whose main process runs at `/`.
10. **Mid-session changes.** A `cd`, a worktree, adding a workspace folder, Claude Code's `/cd`. Does the server's view of the project follow, especially in Cursor with `listChanged: false`?
11. **Agent CLI vs desktop.** Repeat 9 under `agent` once installed. Whether it shares the desktop's MCP behaviour is unknown.

**Headless**

12. **Do hooks fire?** `codex exec` and `agent -p`, with a hook that logs each event. For `claude -p`, confirm the docs and test `--settings '{"disableAllHooks": true}'` keeps subscription login working.
13. **Run-away loops.** A hook that runs the client headlessly, guarded by an environment variable: does the guard reach the child, and does the child's transcript get captured as if it were real work? Test `--no-session-persistence` and `--ephemeral`.
14. **Codex hook-off flags.** Does `--ignore-user-config` or `-c features.hooks=false` suppress hooks in `codex exec`, including project and plugin hooks?

**Install and interference**

15. **Codex trust flow.** What does a user see when a tool adds a hook, and when an update changes it? Does the untrusted hook fail silently?
16. **Cursor double-firing.** With a hook in both `~/.claude/settings.json` and `~/.cursor/hooks.json`: does it run twice, and does Cursor honour Claude's `hookSpecificOutput.additionalContext` shape on import?
17. **Hook latency.** A hook on every tool call in each client: what slowdown does the user notice?

**Transcripts**

18. **Stability across upgrades.** Parse a transcript before and after a client upgrade, for all three. Cursor's retention and the effect of turning transcripts off also need checking.
19. **Cursor tool output.** Confirm `postToolUse.tool_output` is complete and not truncated for large outputs, in both the app and CLI.
