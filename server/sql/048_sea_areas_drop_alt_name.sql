-- 해역 추가 이름(alt_name) 미사용 → 컬럼 제거
ALTER TABLE sea_areas DROP COLUMN IF EXISTS alt_name;
