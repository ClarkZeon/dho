-- Neon / PostgreSQL: 항구(도시) 도감

CREATE TABLE IF NOT EXISTS ports (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  region TEXT,
  sea_area TEXT,
  coord_x INTEGER,
  coord_y INTEGER,
  entry_permit TEXT,
  culture TEXT,
  language TEXT,
  facilities TEXT,
  rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
  collect_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 초기 스키마에서 확장
ALTER TABLE ports ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS coord_x INTEGER;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS coord_y INTEGER;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS entry_permit TEXT;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS rewards JSONB;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS collect_items JSONB;
UPDATE ports SET rewards = '[]'::jsonb WHERE rewards IS NULL;
UPDATE ports SET collect_items = '[]'::jsonb WHERE collect_items IS NULL;

CREATE INDEX IF NOT EXISTS idx_ports_name ON ports (name);
CREATE INDEX IF NOT EXISTS idx_ports_enabled_sort ON ports (enabled, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_ports_sea_area ON ports (sea_area);
CREATE INDEX IF NOT EXISTS idx_ports_region ON ports (region);
