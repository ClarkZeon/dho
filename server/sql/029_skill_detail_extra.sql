-- 스킬 상세 확장: 추가이름·장착비용·부관·효과 아이템

ALTER TABLE skills ADD COLUMN IF NOT EXISTS alt_name TEXT;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS equip_cost INTEGER;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS officers JSONB;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS effect_items JSONB;

UPDATE skills SET officers = '[]'::jsonb WHERE officers IS NULL;
UPDATE skills SET effect_items = '[]'::jsonb WHERE effect_items IS NULL;

ALTER TABLE skills ALTER COLUMN officers SET DEFAULT '[]'::jsonb;
ALTER TABLE skills ALTER COLUMN effect_items SET DEFAULT '[]'::jsonb;
