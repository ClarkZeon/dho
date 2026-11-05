-- 발견물 장식품 레시피 (장식품 이름 → 필요 발견물 카드)

ALTER TABLE discoveries
  ADD COLUMN IF NOT EXISTS ornaments JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE discoveries
SET ornaments = '[]'::jsonb
WHERE ornaments IS NULL;
