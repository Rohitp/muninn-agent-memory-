-- Changes muninn proposes to files agents read (a permission rule, a new skill, an edit to CLAUDE.md), for you to apply or dismiss.
-- `applied` holds the file as it was before, so Undo can put it back.
CREATE TABLE proposals (id TEXT PRIMARY KEY, repo_id TEXT, kind TEXT NOT NULL, key TEXT NOT NULL, title TEXT NOT NULL, why TEXT NOT NULL, payload TEXT NOT NULL, evidence TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'proposed', created_at TEXT NOT NULL, decided_at TEXT, applied TEXT);
CREATE UNIQUE INDEX proposals_key ON proposals (coalesce(repo_id,''), key);
