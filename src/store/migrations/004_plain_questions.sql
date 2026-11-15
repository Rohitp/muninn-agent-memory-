-- A plain-English line for the engineer, and questions each lesson answers, for search.
ALTER TABLE lessons ADD COLUMN plain TEXT;
CREATE TABLE lesson_questions (lesson_id TEXT NOT NULL REFERENCES lessons(id), question TEXT NOT NULL, embedding F32_BLOB(384), PRIMARY KEY (lesson_id, question));
