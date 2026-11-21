-- The role a lesson is for, in a team of agents: a subagent type ("reviewer") or a worktree's name ("builder").
-- NULL is every agent. A role's lessons are told only to that role.
ALTER TABLE lessons ADD COLUMN role TEXT;
