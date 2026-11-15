-- Notes are longer repo knowledge, delivered like rules. Handoffs say where the last session left off.
ALTER TABLE lessons ADD COLUMN kind TEXT NOT NULL DEFAULT 'rule';
ALTER TABLE lessons ADD COLUMN suggested_keywords TEXT;
-- Moments the writer already judged, so a rerun doesn't ask again.
CREATE TABLE judged (repo_id TEXT NOT NULL, key TEXT NOT NULL, verdict TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (repo_id, key));
CREATE TABLE handoffs (id TEXT PRIMARY KEY, repo_id TEXT NOT NULL, branch TEXT NOT NULL, session TEXT NOT NULL UNIQUE, tool TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX handoffs_repo_branch ON handoffs (repo_id, branch, created_at);
ALTER TABLE deliveries ADD COLUMN handoff_id TEXT;
