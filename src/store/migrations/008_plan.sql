-- A running plan per repo, built from handoffs and edited by the person: the goal, open items, decisions, and what's done.
CREATE TABLE plan_items (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('goal','open','decision','done')),
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','removed')),
  handoff_id TEXT,
  session TEXT,
  created_at TEXT NOT NULL,
  closed_at TEXT,
  closed_by TEXT,
  by_person INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX plan_items_repo ON plan_items (repo_id, kind, status);
-- Handoffs already folded into the plan, so each is applied once.
CREATE TABLE plan_applied (handoff_id TEXT PRIMARY KEY, at TEXT NOT NULL);
