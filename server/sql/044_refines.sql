-- Neon / PostgreSQL: 연성 효과 도감

CREATE TABLE IF NOT EXISTS refines (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  action_power TEXT,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refines_name ON refines (name);
CREATE INDEX IF NOT EXISTS idx_refines_enabled_sort
  ON refines (enabled, sort_order, id);

INSERT INTO catalog_stats (stat_key, count) VALUES ('refines', 0)
ON CONFLICT (stat_key) DO NOTHING;
