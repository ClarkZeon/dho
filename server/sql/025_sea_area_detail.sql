-- 해역: 추가 이름·설명·지역(복수) — 수집 항목은 collect_items JSON 구조 확장

ALTER TABLE sea_areas ADD COLUMN IF NOT EXISTS alt_name TEXT;
ALTER TABLE sea_areas ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE sea_areas ADD COLUMN IF NOT EXISTS regions JSONB;

UPDATE sea_areas
SET regions = CASE
  WHEN regions IS NULL AND region IS NOT NULL AND TRIM(region) <> ''
    THEN jsonb_build_array(TRIM(region))
  WHEN regions IS NULL THEN '[]'::jsonb
  ELSE regions
END;
