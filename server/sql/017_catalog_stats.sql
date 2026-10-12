-- 관리자 대시보드용 카탈로그 건수 캐시

CREATE TABLE IF NOT EXISTS catalog_stats (
  stat_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO catalog_stats (stat_key, count) VALUES
  ('users', 0),
  ('ships', 0),
  ('quests', 0),
  ('ports', 0),
  ('discoveries', 0),
  ('skills', 0),
  ('materials', 0),
  ('feature_requests', 0)
ON CONFLICT (stat_key) DO NOTHING;
