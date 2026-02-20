-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- before running the ingestion script.

CREATE TABLE IF NOT EXISTS documents (
  id     SERIAL PRIMARY KEY,
  title  TEXT        NOT NULL,
  date   DATE,
  topic  TEXT,
  tags   TEXT[],
  content TEXT       NOT NULL
);
