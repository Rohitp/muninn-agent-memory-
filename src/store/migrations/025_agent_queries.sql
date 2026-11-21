-- Every question an agent asks muninn (an MCP tool call, or muninn ask / recall / related run by an agent), to see
-- whether muninn helps agents: what they ask, whether it finds something, which lessons they find. Redacted.
CREATE TABLE agent_queries (id TEXT PRIMARY KEY, ts TEXT NOT NULL, repo TEXT, branch TEXT, session TEXT, tool TEXT NOT NULL, surface TEXT NOT NULL, query TEXT NOT NULL, results INTEGER NOT NULL, result_ids TEXT NOT NULL DEFAULT '[]', ms INTEGER NOT NULL);
CREATE INDEX agent_queries_repo_ts ON agent_queries (repo, ts);
