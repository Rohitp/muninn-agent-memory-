-- A kept lesson switched off: it stays in the list, and agents aren't told it until it's switched back on.
ALTER TABLE lessons ADD COLUMN off INTEGER NOT NULL DEFAULT 0;
