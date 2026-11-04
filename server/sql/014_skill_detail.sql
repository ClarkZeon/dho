-- 스킬 위키 상세 필드

ALTER TABLE skills ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS range_scope TEXT;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS action_power TEXT;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS auto_effect TEXT;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS learn_places JSONB;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS use_cities JSONB;

UPDATE skills SET learn_places = '[]'::jsonb WHERE learn_places IS NULL;
UPDATE skills SET use_cities = '[]'::jsonb WHERE use_cities IS NULL;
