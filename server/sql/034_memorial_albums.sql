-- Neon / PostgreSQL: 메모리얼 앨범 도감

CREATE TABLE IF NOT EXISTS memorial_albums (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  alt_name TEXT,
  description TEXT,
  category TEXT,
  reward_npc TEXT,
  reward_item TEXT,
  item_count INTEGER,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memorial_albums_name ON memorial_albums (name);
CREATE INDEX IF NOT EXISTS idx_memorial_albums_enabled_sort
  ON memorial_albums (enabled, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_memorial_albums_category ON memorial_albums (category);

INSERT INTO catalog_stats (stat_key, count) VALUES ('memorial_albums', 0)
ON CONFLICT (stat_key) DO NOTHING;
