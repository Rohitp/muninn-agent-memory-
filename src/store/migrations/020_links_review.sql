-- Links your Claude or you have judged: 'confirmed' and 'person' links stay through rebuilds, and a 'rejected' one
-- is remembered so it isn't proposed again. Everything that shows links reads live_links, which leaves those out.
CREATE VIEW live_links AS SELECT * FROM links WHERE how != 'rejected';
-- Whether your Claude has looked at an outcome for effects outside the repo (npm, GitHub, settings files).
ALTER TABLE plan_outcomes ADD COLUMN outside_checked INTEGER NOT NULL DEFAULT 0;
