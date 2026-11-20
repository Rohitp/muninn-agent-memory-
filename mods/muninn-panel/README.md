# muninn panel for Claude Code

A side panel that shows what muninn told this Claude Code session, and why: each lesson sent ("always-on, at session start", "your prompt said "python"") with a retire button, the handoff from the last session on this branch, the top lessons waiting for review with one-click Keep and Reject, and this week's numbers, including what muninn's own AI calls cost. The status line shows how many lessons were sent.

Install it from a terminal, after installing secondnature (`npm install -g secondnature`):

```sh
claude plugin marketplace add Rohitp/secondnature
claude plugin install muninn-panel@muninn
```

Then start a new Claude Code session and open the panel with `/muninn`.

From a local checkout instead: `claude plugin marketplace add <path to the checkout>`, then the same install line.

Needs the `muninn` command on the PATH Claude Code starts with: `npm install -g secondnature` puts it there, or `npm link` in a checkout.

Changing the panel: Claude Code runs an installed copy, not this folder. Bump `version` in `.claude-plugin/plugin.json`, then run `claude plugin marketplace update muninn` and `claude plugin update muninn-panel@muninn`, and start a new session.
