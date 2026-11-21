-- What each delivery was for, so the page can show everything muninn told an agent:
--   repo  the repo the session was in (a global lesson's own repo_id is where it was learned, not where it was told)
--   kind  lesson (or NULL, older rows), handoff, plan, note (the "look things up" reminder), loop (a repeated-failure warning)
ALTER TABLE deliveries ADD COLUMN repo TEXT;
ALTER TABLE deliveries ADD COLUMN kind TEXT;
