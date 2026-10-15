-- Neon / PostgreSQL: 호칭 도감

CREATE TABLE IF NOT EXISTS titles (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  alt_name TEXT,
  description TEXT,
  effect TEXT,
  requirement TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_titles_name ON titles (name);
CREATE INDEX IF NOT EXISTS idx_titles_enabled_sort
  ON titles (enabled, sort_order, id);

INSERT INTO catalog_stats (stat_key, count) VALUES ('titles', 0)
ON CONFLICT (stat_key) DO NOTHING;
