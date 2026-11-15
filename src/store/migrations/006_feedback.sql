-- "helped" or "wrong here" on something muninn told an agent: the engineer's own word on whether it worked.
CREATE TABLE feedback (id TEXT PRIMARY KEY, ts TEXT NOT NULL, lesson_id TEXT REFERENCES lessons(id), handoff_id TEXT, session TEXT, verdict TEXT NOT NULL CHECK (verdict IN ('helped','wrong')));
CREATE INDEX feedback_lesson ON feedback (lesson_id);
