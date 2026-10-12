-- Neon / PostgreSQL: 필드(상륙지 등) 도감

CREATE TABLE IF NOT EXISTS fields (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  field_kind TEXT,
  region TEXT,
  sea_area TEXT,
  coord_x INTEGER,
  coord_y INTEGER,
  land_surveys JSONB NOT NULL DEFAULT '[]'::jsonb,
  resurvey_rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fields_name ON fields (name);
CREATE INDEX IF NOT EXISTS idx_fields_enabled_sort ON fields (enabled, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_fields_region ON fields (region);
CREATE INDEX IF NOT EXISTS idx_fields_kind ON fields (field_kind);

INSERT INTO catalog_stats (stat_key, count) VALUES ('fields', 0)
ON CONFLICT (stat_key) DO NOTHING;
