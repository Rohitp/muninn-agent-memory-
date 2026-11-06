CREATE TABLE repos (id TEXT PRIMARY KEY, paths TEXT NOT NULL, excluded INTEGER NOT NULL DEFAULT 0);
CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  repo_id TEXT REFERENCES repos(id),
  scope TEXT NOT NULL CHECK (scope IN ('repo','global')),
  text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('own_words','inferred','manual')),
  signal TEXT,
  status TEXT NOT NULL CHECK (status IN ('proposed','live','rejected','retired')),
  sessions INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT,
  reviewed_at TEXT,
  first_shown_at TEXT,
  news_to_engineer INTEGER,
  edited_by_person INTEGER NOT NULL DEFAULT 0,
  always_on INTEGER NOT NULL DEFAULT 0,
  embedding F32_BLOB(384),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX lessons_repo_status ON lessons (repo_id, status);
CREATE TABLE lesson_versions (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id), snapshot TEXT NOT NULL, changed_by TEXT NOT NULL, changed_at TEXT NOT NULL);
CREATE TABLE triggers (id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id), pattern TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE evidence (lesson_id TEXT NOT NULL REFERENCES lessons(id), tool TEXT NOT NULL, session TEXT NOT NULL, seen_at TEXT NOT NULL, quote TEXT NOT NULL, PRIMARY KEY (lesson_id, session, quote));
CREATE TABLE baselines (lesson_id TEXT NOT NULL REFERENCES lessons(id), tool TEXT NOT NULL, window_start TEXT NOT NULL, window_end TEXT NOT NULL, sessions_total INTEGER NOT NULL, sessions_with_repeat INTEGER NOT NULL, PRIMARY KEY (lesson_id, tool));
CREATE TABLE commands (repo_id TEXT NOT NULL REFERENCES repos(id), command TEXT NOT NULL, source TEXT NOT NULL, last_seen TEXT NOT NULL, embedding F32_BLOB(384), PRIMARY KEY (repo_id, command, source));
CREATE TABLE deliveries (id TEXT PRIMARY KEY, ts TEXT NOT NULL, tool TEXT NOT NULL, session TEXT, event TEXT NOT NULL, source TEXT, lesson_id TEXT, lesson_version TEXT, trigger_id TEXT, outcome TEXT NOT NULL CHECK (outcome IN ('sent','no_match','limit','paused','timeout','unsupported_client')), tokens INTEGER NOT NULL DEFAULT 0);
CREATE INDEX deliveries_session ON deliveries (session, lesson_id);
CREATE TABLE search_log (id TEXT PRIMARY KEY, ts TEXT NOT NULL, from_repo TEXT, result_repo TEXT NOT NULL, query_kind TEXT NOT NULL);
CREATE TABLE scan_counts (repo_id TEXT NOT NULL, tool TEXT NOT NULL, client_version TEXT NOT NULL, scanned_at TEXT NOT NULL, unknown_records INTEGER NOT NULL, PRIMARY KEY (repo_id, tool, client_version));
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE VIRTUAL TABLE lessons_fts USING fts5(lesson_id UNINDEXED, text);
CREATE VIRTUAL TABLE commands_fts USING fts5(repo_id UNINDEXED, command, source UNINDEXED);
