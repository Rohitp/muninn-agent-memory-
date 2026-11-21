-- Finished steps grouped into outcomes ("Every session is searchable", shipped 21 Nov, ffbf07e), with a plain-language
-- area; steps that were routine (tests run, pushed) marked so the page can fold them away; each decision's area and reason.
CREATE TABLE plan_outcomes (id TEXT PRIMARY KEY, repo_id TEXT NOT NULL, branch TEXT NOT NULL, title TEXT NOT NULL, result TEXT NOT NULL, kind TEXT NOT NULL, area TEXT NOT NULL, ref TEXT, at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX plan_outcomes_branch ON plan_outcomes (repo_id, branch, at);
ALTER TABLE plan_items ADD COLUMN outcome_id TEXT;
ALTER TABLE plan_items ADD COLUMN routine INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plan_items ADD COLUMN area TEXT;
ALTER TABLE plan_items ADD COLUMN what TEXT;
ALTER TABLE plan_items ADD COLUMN why TEXT;
