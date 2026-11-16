# muninn panel for Claude Code

A side panel that shows what muninn told this Claude Code session, and why: each lesson sent ("always-on, at session start", "your prompt said "python"") with a retire button, the handoff from the last session on this branch, the top lessons waiting for review with one-click Keep and Reject, and this week's numbers, including what muninn's own AI calls cost. The status line shows how many lessons were sent.

Install it in Claude Code:

```
/plugin install muninn-panel --marketplace Rohitp/muninn-agent-memory-
```

From a local checkout instead: `claude plugin marketplace add <path to muninn>`, then `claude plugin install muninn-panel@muninn`.

Needs the `muninn` command on the PATH Claude Code starts with (`npm link` in the muninn folder). Open the panel with `/muninn`.
