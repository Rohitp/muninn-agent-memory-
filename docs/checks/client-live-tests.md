# Client live tests

Results of hands-on checks from `docs/checks/client-capabilities.md`. Each used a throwaway project, a hook passed through `claude -p --settings` so no real settings changed, and a made-up fact the model had to repeat.

## Claude Code 2.1.317 (2026-11-06)

| Check | Result |
|---|---|
| M1: `SessionStart` at session start | Pass. The model repeated the fact. Input fields: `cwd`, `hook_event_name`, `session_id`, `source` (`startup`), `transcript_path` |
| M2: `UserPromptSubmit` | Pass. Input adds `prompt`, `prompt_id`, `permission_mode` |
| `PostToolUseFailure` on a failed Bash call | Pass. Input adds `tool_name`, `tool_input.command`, `error` ("Exit code 1"), `duration_ms` |
| Output shape | `{"hookSpecificOutput":{"hookEventName":"<event>","additionalContext":"<text>"}}` works for all three |
| muninn's real hook on the author's 4 kept lessons | Pass. The model quoted both always-on lessons word for word |
| Hook time, muninn's real hook | 0.31-0.40 s per run, about half of it Node start-up |

All runs used `claude -p`. Interactive sessions, compaction and `SubagentStart` are not tested yet.

## Codex

Not tested. `codex exec` on CLI 0.133.0 fails because the configured default model, `gpt-6-sol`, isn't supported with this ChatGPT account. Codex hooks wait for a working client.
