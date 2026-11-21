-- Claude Code agent teams, from its documented hooks (TaskCreated, TaskCompleted, TeammateIdle): which session is
-- which teammate, and the tasks they created and finished. Teammates' own logs don't say who they are.
CREATE TABLE team_events (ts TEXT NOT NULL, session TEXT, event TEXT NOT NULL, team TEXT, teammate TEXT, agent_type TEXT, task_id TEXT, subject TEXT);
CREATE INDEX team_events_session ON team_events (session);
