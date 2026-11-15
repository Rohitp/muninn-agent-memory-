-- Plan updates during a long session: each covers the part of the session since the last one.
CREATE TABLE checkpoints (id TEXT PRIMARY KEY, session TEXT NOT NULL, repo_id TEXT NOT NULL, branch TEXT NOT NULL, tool TEXT NOT NULL, from_event INTEGER NOT NULL, to_event INTEGER NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX checkpoints_session ON checkpoints (session, to_event);
