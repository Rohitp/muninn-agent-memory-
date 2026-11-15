-- One plan per branch: each item belongs to the branch whose session (or person) added it.
ALTER TABLE plan_items ADD COLUMN branch TEXT;
UPDATE plan_items SET branch = coalesce((SELECT h.branch FROM handoffs h WHERE h.id = plan_items.handoff_id), 'main');
CREATE INDEX plan_items_branch ON plan_items (repo_id, branch, kind, status);
