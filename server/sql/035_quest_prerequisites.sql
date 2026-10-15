-- 퀘스트 선행 발견/퀘스트

ALTER TABLE quests ADD COLUMN IF NOT EXISTS prerequisites JSONB;
UPDATE quests SET prerequisites = '[]'::jsonb WHERE prerequisites IS NULL;
ALTER TABLE quests ALTER COLUMN prerequisites SET DEFAULT '[]'::jsonb;
