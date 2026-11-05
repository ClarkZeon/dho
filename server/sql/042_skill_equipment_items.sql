-- 스킬: 장비품 (효과 아이템과 별도)

ALTER TABLE skills ADD COLUMN IF NOT EXISTS equipment_items JSONB;
UPDATE skills SET equipment_items = '[]'::jsonb WHERE equipment_items IS NULL;
ALTER TABLE skills ALTER COLUMN equipment_items SET DEFAULT '[]'::jsonb;
