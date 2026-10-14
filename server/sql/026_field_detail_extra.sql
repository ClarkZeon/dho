-- 필드 상세 확장: 추가이름·설명·수집·목적지·육상 NPC

ALTER TABLE fields ADD COLUMN IF NOT EXISTS alt_name TEXT;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS collect_items JSONB;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS destinations JSONB;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS land_npcs JSONB;

UPDATE fields SET collect_items = '[]'::jsonb WHERE collect_items IS NULL;
UPDATE fields SET destinations = '[]'::jsonb WHERE destinations IS NULL;
UPDATE fields SET land_npcs = '[]'::jsonb WHERE land_npcs IS NULL;

ALTER TABLE fields ALTER COLUMN collect_items SET DEFAULT '[]'::jsonb;
ALTER TABLE fields ALTER COLUMN destinations SET DEFAULT '[]'::jsonb;
ALTER TABLE fields ALTER COLUMN land_npcs SET DEFAULT '[]'::jsonb;
