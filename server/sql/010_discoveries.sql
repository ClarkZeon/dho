-- Neon / PostgreSQL: 발견물 도감

CREATE TABLE IF NOT EXISTS discoveries (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  rank INTEGER,
  card_points INTEGER,
  discovery_exp INTEGER,
  card_exp INTEGER,
  report_fame INTEGER,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  acquire_type TEXT,
  acquire_name TEXT,
  place TEXT,
  linked_quests JSONB NOT NULL DEFAULT '[]'::jsonb,
  debate_combo JSONB,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE discoveries ADD COLUMN IF NOT EXISTS card_points INTEGER;
ALTER TABLE discoveries ADD COLUMN IF NOT EXISTS discovery_exp INTEGER;
ALTER TABLE discoveries ADD COLUMN IF NOT EXISTS card_exp INTEGER;
ALTER TABLE discoveries ADD COLUMN IF NOT EXISTS report_fame INTEGER;
ALTER TABLE discoveries ADD COLUMN IF NOT EXISTS linked_quests JSONB;
ALTER TABLE discoveries ADD COLUMN IF NOT EXISTS debate_combo JSONB;

UPDATE discoveries
SET linked_quests = '[]'::jsonb
WHERE linked_quests IS NULL;

CREATE INDEX IF NOT EXISTS idx_discoveries_name ON discoveries (name);
CREATE INDEX IF NOT EXISTS idx_discoveries_enabled_sort ON discoveries (enabled, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_discoveries_category ON discoveries (category);
