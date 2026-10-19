-- 도감: 보물지도

CREATE TABLE IF NOT EXISTS treasure_maps (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  alt_name TEXT,
  map_kind TEXT,
  description TEXT,
  category TEXT,
  libraries JSONB NOT NULL DEFAULT '[]'::jsonb,
  academic_field TEXT,
  destination_city TEXT,
  destination TEXT,
  discoveries JSONB NOT NULL DEFAULT '[]'::jsonb,
  skill_reqs JSONB NOT NULL DEFAULT '[]'::jsonb,
  discovery_exp INTEGER,
  card_exp INTEGER,
  ducat INTEGER,
  reward_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_quests JSONB NOT NULL DEFAULT '[]'::jsonb,
  walkthrough TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasure_maps_name ON treasure_maps (name);
CREATE INDEX IF NOT EXISTS idx_treasure_maps_enabled_updated
  ON treasure_maps (enabled, updated_at DESC, id DESC);

INSERT INTO catalog_stats (stat_key, count) VALUES ('treasure_maps', 0)
ON CONFLICT (stat_key) DO NOTHING;
