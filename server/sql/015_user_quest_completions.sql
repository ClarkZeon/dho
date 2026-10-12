-- 유저별 퀘스트 완료 여부

CREATE TABLE IF NOT EXISTS user_quest_completions (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  quest_id BIGINT NOT NULL REFERENCES quests (id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_user_quest_completions_user
  ON user_quest_completions (user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_quest_completions_quest
  ON user_quest_completions (quest_id);
