-- Lines in a repo's CLAUDE.md (and similar files) that may be out of date, for you to remove or keep.
CREATE TABLE memory_lines (id TEXT PRIMARY KEY, repo_id TEXT NOT NULL, file TEXT NOT NULL, line INTEGER NOT NULL, text TEXT NOT NULL, reason TEXT NOT NULL, detail TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', checked_at TEXT NOT NULL, removed_text TEXT, removed_at TEXT);
CREATE INDEX memory_lines_repo ON memory_lines (repo_id, status);
