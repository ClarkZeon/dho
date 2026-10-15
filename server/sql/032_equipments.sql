-- Neon / PostgreSQL: 장비품 도감

CREATE TABLE IF NOT EXISTS equipments (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  alt_name TEXT,
  description TEXT,
  category TEXT,
  use_effect TEXT,
  equip_slot TEXT,
  durability TEXT,
  attack TEXT,
  defense TEXT,
  dress_etiquette TEXT,
  disguise TEXT,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipment_effects JSONB NOT NULL DEFAULT '[]'::jsonb,
  memorial_album TEXT,
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  non_tradable BOOLEAN NOT NULL DEFAULT FALSE,
  acquire_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  purchases JSONB NOT NULL DEFAULT '[]'::jsonb,
  transmutations JSONB NOT NULL DEFAULT '[]'::jsonb,
  quests JSONB NOT NULL DEFAULT '[]'::jsonb,
  treasure_maps JSONB NOT NULL DEFAULT '[]'::jsonb,
  memorial_albums JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipments_name ON equipments (name);
CREATE INDEX IF NOT EXISTS idx_equipments_enabled_sort
  ON equipments (enabled, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_equipments_category ON equipments (category);

INSERT INTO catalog_stats (stat_key, count) VALUES ('equipments', 0)
ON CONFLICT (stat_key) DO NOTHING;
