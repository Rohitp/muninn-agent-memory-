-- Every session, kept as exchanges: what the engineer typed, what the agent said, and the commands it ran. Redacted.
-- `embedding` is the local model's 384 numbers as raw float32 bytes, for search by meaning; chunks_fts is for words.
CREATE TABLE chunks (id TEXT PRIMARY KEY, repo_id TEXT, session TEXT NOT NULL, tool TEXT NOT NULL, branch TEXT, ts TEXT NOT NULL, seq INTEGER NOT NULL, text TEXT NOT NULL, embedding BLOB);
CREATE INDEX chunks_session ON chunks (session);
CREATE INDEX chunks_repo_ts ON chunks (repo_id, ts);
CREATE VIRTUAL TABLE chunks_fts USING fts5(chunk_id UNINDEXED, text);
-- Which log files are indexed (and at what size), and where each one's compressed copy is kept.
CREATE TABLE session_files (file TEXT PRIMARY KEY, session TEXT NOT NULL, tool TEXT NOT NULL, size INTEGER NOT NULL, indexed_at TEXT, archive TEXT, archived_size INTEGER);
