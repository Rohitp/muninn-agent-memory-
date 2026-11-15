-- Every call muninn makes to the engineer's AI client, and what it cost, so muninn can show its own spend.
CREATE TABLE llm_calls (id TEXT PRIMARY KEY, ts TEXT NOT NULL, what TEXT NOT NULL, job TEXT NOT NULL, provider TEXT NOT NULL, model TEXT, input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL, cache_read INTEGER NOT NULL, cache_write INTEGER NOT NULL, cost_usd REAL);
CREATE INDEX llm_calls_ts ON llm_calls (ts);
