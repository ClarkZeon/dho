-- Neon / PostgreSQL: 스킬 카탈로그

CREATE TABLE IF NOT EXISTS skills (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  learn_cost INTEGER,
  prerequisite TEXT,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_enabled_sort
  ON skills (enabled, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_skills_name
  ON skills (name);
