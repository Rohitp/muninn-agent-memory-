-- How things in muninn relate: a decision motivates an outcome, an outcome ships in a commit, a session touches a
-- file. `how` says where a link comes from: 'known' (recorded facts), 'meaning' (similar text, with its score),
-- or 'person' (you). Relationship names are fixed in src/links/links.ts.
CREATE TABLE links (src_type TEXT NOT NULL, src_id TEXT NOT NULL, rel TEXT NOT NULL, dst_type TEXT NOT NULL, dst_id TEXT NOT NULL, how TEXT NOT NULL, score REAL, repo_id TEXT, created_at TEXT NOT NULL, PRIMARY KEY (src_type, src_id, rel, dst_type, dst_id));
CREATE INDEX links_dst ON links (dst_type, dst_id);
CREATE INDEX links_repo ON links (repo_id, rel);
