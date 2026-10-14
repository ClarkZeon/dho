-- Neon / PostgreSQL: 입항허가 도감

CREATE TABLE IF NOT EXISTS entry_permits (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  alt_name TEXT,
  description TEXT,
  requirement TEXT,
  fame JSONB NOT NULL DEFAULT '[]'::jsonb,
  city_quests JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entry_permits_name ON entry_permits (name);
CREATE INDEX IF NOT EXISTS idx_entry_permits_enabled_sort
  ON entry_permits (enabled, sort_order, id);
