-- 선박 재료 위키 상세 필드 (기존 ship_materials 확장)

ALTER TABLE ship_materials ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ship_materials ADD COLUMN IF NOT EXISTS material_kind TEXT;
ALTER TABLE ship_materials ADD COLUMN IF NOT EXISTS material_label TEXT;
ALTER TABLE ship_materials ADD COLUMN IF NOT EXISTS effects JSONB;
ALTER TABLE ship_materials ADD COLUMN IF NOT EXISTS acquire_methods JSONB;

UPDATE ship_materials SET effects = '[]'::jsonb WHERE effects IS NULL;
UPDATE ship_materials SET acquire_methods = '[]'::jsonb WHERE acquire_methods IS NULL;
