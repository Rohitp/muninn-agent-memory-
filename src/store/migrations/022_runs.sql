-- Workflow runs: sessions in one repo that worked at the same time or one after another (a software factory's
-- builder, reviewer and qa worktrees, or a session and the subagents it started), with each session's role.
-- `data` holds the run as JSON (sessions, roles, handoffs, tokens); rebuilt by each scan.
CREATE TABLE runs (id TEXT PRIMARY KEY, repo_id TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT NOT NULL, team INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
CREATE INDEX runs_repo ON runs (repo_id, started_at);
