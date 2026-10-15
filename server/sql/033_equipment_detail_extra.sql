-- 장비품 상세 필드 확장 (이미 032만 적용된 DB용)

ALTER TABLE equipments ADD COLUMN IF NOT EXISTS alt_name TEXT;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS attack TEXT;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS defense TEXT;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS dress_etiquette TEXT;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS disguise TEXT;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS skills JSONB;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS equipment_effects JSONB;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS memorial_album TEXT;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS requirements JSONB;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS non_tradable BOOLEAN;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS transmutations JSONB;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS quests JSONB;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS treasure_maps JSONB;
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS memorial_albums JSONB;

UPDATE equipments SET skills = '[]'::jsonb WHERE skills IS NULL;
UPDATE equipments SET equipment_effects = '[]'::jsonb WHERE equipment_effects IS NULL;
UPDATE equipments SET requirements = '{}'::jsonb WHERE requirements IS NULL;
UPDATE equipments SET non_tradable = FALSE WHERE non_tradable IS NULL;
UPDATE equipments SET transmutations = '[]'::jsonb WHERE transmutations IS NULL;
UPDATE equipments SET quests = '[]'::jsonb WHERE quests IS NULL;
UPDATE equipments SET treasure_maps = '[]'::jsonb WHERE treasure_maps IS NULL;
UPDATE equipments SET memorial_albums = '[]'::jsonb WHERE memorial_albums IS NULL;

ALTER TABLE equipments ALTER COLUMN skills SET DEFAULT '[]'::jsonb;
ALTER TABLE equipments ALTER COLUMN equipment_effects SET DEFAULT '[]'::jsonb;
ALTER TABLE equipments ALTER COLUMN requirements SET DEFAULT '{}'::jsonb;
ALTER TABLE equipments ALTER COLUMN non_tradable SET DEFAULT FALSE;
ALTER TABLE equipments ALTER COLUMN transmutations SET DEFAULT '[]'::jsonb;
ALTER TABLE equipments ALTER COLUMN quests SET DEFAULT '[]'::jsonb;
ALTER TABLE equipments ALTER COLUMN treasure_maps SET DEFAULT '[]'::jsonb;
ALTER TABLE equipments ALTER COLUMN memorial_albums SET DEFAULT '[]'::jsonb;
