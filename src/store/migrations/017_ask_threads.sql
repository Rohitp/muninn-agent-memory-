-- Questions you asked muninn, kept as threads so you can come back to one and ask a follow-up.
CREATE TABLE ask_threads (id TEXT PRIMARY KEY, repo_id TEXT, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX ask_threads_updated ON ask_threads (updated_at);
CREATE TABLE ask_turns (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES ask_threads(id), q TEXT NOT NULL, a TEXT, sources TEXT NOT NULL DEFAULT '[]', at TEXT NOT NULL);
CREATE INDEX ask_turns_thread ON ask_turns (thread_id, at);
