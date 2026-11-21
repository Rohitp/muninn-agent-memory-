-- Search by meaning through libsql's vector index, instead of comparing a question with every stored exchange.
-- The vectors were already raw float32, so they copy across as they are.
CREATE TABLE chunks_v (id TEXT PRIMARY KEY, repo_id TEXT, session TEXT NOT NULL, tool TEXT NOT NULL, branch TEXT, ts TEXT NOT NULL, seq INTEGER NOT NULL, text TEXT NOT NULL, embedding F32_BLOB(384));
INSERT INTO chunks_v (id,repo_id,session,tool,branch,ts,seq,text,embedding) SELECT id,repo_id,session,tool,branch,ts,seq,text,CASE WHEN length(embedding)=1536 THEN embedding END FROM chunks;
DROP TABLE chunks;
ALTER TABLE chunks_v RENAME TO chunks;
CREATE INDEX chunks_session ON chunks (session);
CREATE INDEX chunks_repo_ts ON chunks (repo_id, ts);
CREATE INDEX chunks_vec ON chunks (libsql_vector_idx(embedding, 'metric=cosine'));
