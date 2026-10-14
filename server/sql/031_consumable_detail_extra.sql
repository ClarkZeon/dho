-- 소비품 획득 상세: 생산·퀘스트·아이템 사용·트레져박스·이벤트·육지 재조사·애완동물
-- (구입은 기존 purchases 컬럼 사용)

ALTER TABLE consumables ADD COLUMN IF NOT EXISTS productions JSONB;
ALTER TABLE consumables ADD COLUMN IF NOT EXISTS quests JSONB;
ALTER TABLE consumables ADD COLUMN IF NOT EXISTS item_uses JSONB;
ALTER TABLE consumables ADD COLUMN IF NOT EXISTS treasure_boxes JSONB;
ALTER TABLE consumables ADD COLUMN IF NOT EXISTS events JSONB;
ALTER TABLE consumables ADD COLUMN IF NOT EXISTS land_resurveys JSONB;
ALTER TABLE consumables ADD COLUMN IF NOT EXISTS pets JSONB;

UPDATE consumables SET productions = '[]'::jsonb WHERE productions IS NULL;
UPDATE consumables SET quests = '[]'::jsonb WHERE quests IS NULL;
UPDATE consumables SET item_uses = '[]'::jsonb WHERE item_uses IS NULL;
UPDATE consumables SET treasure_boxes = '[]'::jsonb WHERE treasure_boxes IS NULL;
UPDATE consumables SET events = '[]'::jsonb WHERE events IS NULL;
UPDATE consumables SET land_resurveys = '[]'::jsonb WHERE land_resurveys IS NULL;
UPDATE consumables SET pets = '[]'::jsonb WHERE pets IS NULL;

ALTER TABLE consumables ALTER COLUMN productions SET DEFAULT '[]'::jsonb;
ALTER TABLE consumables ALTER COLUMN quests SET DEFAULT '[]'::jsonb;
ALTER TABLE consumables ALTER COLUMN item_uses SET DEFAULT '[]'::jsonb;
ALTER TABLE consumables ALTER COLUMN treasure_boxes SET DEFAULT '[]'::jsonb;
ALTER TABLE consumables ALTER COLUMN events SET DEFAULT '[]'::jsonb;
ALTER TABLE consumables ALTER COLUMN land_resurveys SET DEFAULT '[]'::jsonb;
ALTER TABLE consumables ALTER COLUMN pets SET DEFAULT '[]'::jsonb;
