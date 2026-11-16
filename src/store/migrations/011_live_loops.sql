-- Commands failing the same way in a row during a session, so muninn can tell the agent to stop retrying.
CREATE TABLE live_loops (session TEXT NOT NULL, repo_id TEXT, key TEXT NOT NULL, err TEXT NOT NULL, n INTEGER NOT NULL, tokens INTEGER NOT NULL DEFAULT 0, hinted INTEGER NOT NULL DEFAULT 0, first_ts TEXT NOT NULL, last_ts TEXT NOT NULL, cmd TEXT NOT NULL, PRIMARY KEY (session, key));
