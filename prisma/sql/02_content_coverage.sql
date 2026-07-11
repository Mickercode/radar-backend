-- Content coverage audit table.
-- Run once on the DB after deploying the schema change:
--   psql $DATABASE_URL -f prisma/sql/02_content_coverage.sql
--
-- prisma db push also creates the table from the schema; this file is provided
-- for reference and to seed the initial rows without having to run an audit first.

CREATE TABLE IF NOT EXISTS content_coverage (
  topic_slug    TEXT        NOT NULL,
  content_type  TEXT        NOT NULL, -- 'news' | 'podcast' | 'clip'
  item_count    INTEGER     NOT NULL DEFAULT 0,
  min_threshold INTEGER     NOT NULL DEFAULT 5,
  last_checked  TIMESTAMPTZ,
  status        TEXT        NOT NULL DEFAULT 'unknown',
  fail_cycles   INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (topic_slug, content_type)
);

CREATE INDEX IF NOT EXISTS content_coverage_status_idx ON content_coverage (status);

-- Seed one row per topic + type so the audit has rows to update on first run.
-- Thresholds: news needs more items (10) than podcasts (5) or clips (3).
INSERT INTO content_coverage (topic_slug, content_type, min_threshold)
SELECT t.slug, c.ct,
  CASE c.ct
    WHEN 'news'    THEN 10
    WHEN 'podcast' THEN 5
    WHEN 'clip'    THEN 3
  END
FROM topics t
CROSS JOIN (VALUES ('news'), ('podcast'), ('clip')) AS c(ct)
ON CONFLICT DO NOTHING;
