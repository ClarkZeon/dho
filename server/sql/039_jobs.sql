-- Neon / PostgreSQL: 직업 도감

CREATE TABLE IF NOT EXISTS jobs (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  alt_name TEXT,
  description TEXT,
  category TEXT,
  recommendation TEXT,
  cost TEXT,
  preferred_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  researches JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS alt_name TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommendation TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cost TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS preferred_skills JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requirements JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS researches JSONB;

UPDATE jobs SET preferred_skills = '[]'::jsonb WHERE preferred_skills IS NULL;
UPDATE jobs SET requirements = '[]'::jsonb WHERE requirements IS NULL;
UPDATE jobs SET researches = '[]'::jsonb WHERE researches IS NULL;

ALTER TABLE jobs ALTER COLUMN preferred_skills SET DEFAULT '[]'::jsonb;
ALTER TABLE jobs ALTER COLUMN requirements SET DEFAULT '[]'::jsonb;
ALTER TABLE jobs ALTER COLUMN researches SET DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_jobs_name ON jobs (name);
CREATE INDEX IF NOT EXISTS idx_jobs_enabled_sort
  ON jobs (enabled, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs (category);

INSERT INTO catalog_stats (stat_key, count) VALUES ('jobs', 0)
ON CONFLICT (stat_key) DO NOTHING;
