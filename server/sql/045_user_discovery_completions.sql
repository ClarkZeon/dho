-- 유저별 발견물 완료 여부

CREATE TABLE IF NOT EXISTS user_discovery_completions (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  discovery_id BIGINT NOT NULL REFERENCES discoveries (id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, discovery_id)
);

CREATE INDEX IF NOT EXISTS idx_user_discovery_completions_user
  ON user_discovery_completions (user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_discovery_completions_discovery
  ON user_discovery_completions (discovery_id);
