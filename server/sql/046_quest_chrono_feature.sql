-- 크로노 퀘스트 / 특징 (분류·quest_type 과 분리)

ALTER TABLE quests ADD COLUMN IF NOT EXISTS chrono_quest TEXT;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS feature TEXT;
