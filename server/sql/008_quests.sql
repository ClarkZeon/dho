-- Neon / PostgreSQL: 퀘스트 도감

CREATE TABLE IF NOT EXISTS quests (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  quest_type TEXT,
  difficulty INTEGER,
  request_places TEXT,
  destination TEXT,
  discovery_category TEXT,
  discovery_rank INTEGER,
  discovery_name TEXT,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  reward_ducat INTEGER,
  reward_advance INTEGER,
  exp_discovery INTEGER,
  exp_card INTEGER,
  exp_report INTEGER,
  fame_report INTEGER,
  reward_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  chain_quests JSONB NOT NULL DEFAULT '[]'::jsonb,
  walkthrough TEXT,
  progress TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quests_name ON quests (name);
CREATE INDEX IF NOT EXISTS idx_quests_enabled_sort ON quests (enabled, sort_order, id);
