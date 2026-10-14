-- 항구(도시) 상세 확장: 추가이름·플래그퀘스트·연결장소·인물·생산·목적지·판매

ALTER TABLE ports ADD COLUMN IF NOT EXISTS alt_name TEXT;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS flag_quest TEXT;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS linked_places JSONB;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS characters JSONB;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS productions JSONB;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS destinations JSONB;
ALTER TABLE ports ADD COLUMN IF NOT EXISTS sale_items JSONB;

UPDATE ports SET linked_places = '[]'::jsonb WHERE linked_places IS NULL;
UPDATE ports SET characters = '[]'::jsonb WHERE characters IS NULL;
UPDATE ports SET productions = '[]'::jsonb WHERE productions IS NULL;
UPDATE ports SET destinations = '[]'::jsonb WHERE destinations IS NULL;
UPDATE ports SET sale_items = '[]'::jsonb WHERE sale_items IS NULL;

ALTER TABLE ports ALTER COLUMN linked_places SET DEFAULT '[]'::jsonb;
ALTER TABLE ports ALTER COLUMN characters SET DEFAULT '[]'::jsonb;
ALTER TABLE ports ALTER COLUMN productions SET DEFAULT '[]'::jsonb;
ALTER TABLE ports ALTER COLUMN destinations SET DEFAULT '[]'::jsonb;
ALTER TABLE ports ALTER COLUMN sale_items SET DEFAULT '[]'::jsonb;
