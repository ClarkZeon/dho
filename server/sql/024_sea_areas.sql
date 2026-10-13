-- Neon / PostgreSQL: 해역 도감

CREATE TABLE IF NOT EXISTS sea_areas (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  region TEXT,
  bound_north INTEGER,
  bound_west INTEGER,
  bound_south INTEGER,
  bound_east INTEGER,
  wave INTEGER,
  current INTEGER,
  max_speed_bonus TEXT,
  places JSONB NOT NULL DEFAULT '[]'::jsonb,
  collect_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  destinations JSONB NOT NULL DEFAULT '[]'::jsonb,
  sea_npcs JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sea_areas_name ON sea_areas (name);
CREATE INDEX IF NOT EXISTS idx_sea_areas_enabled_sort
  ON sea_areas (enabled, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_sea_areas_region ON sea_areas (region);
CREATE INDEX IF NOT EXISTS idx_sea_areas_category ON sea_areas (category);

INSERT INTO catalog_stats (stat_key, count) VALUES ('sea_areas', 0)
ON CONFLICT (stat_key) DO NOTHING;
