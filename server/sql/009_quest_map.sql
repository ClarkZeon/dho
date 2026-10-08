-- 퀘스트 공략 지도 (URL 또는 data URL)
ALTER TABLE quests
  ADD COLUMN IF NOT EXISTS map_url TEXT;
