-- 일반 선박: 조선 랭크·강화 분해·건조 도시

ALTER TABLE ships ADD COLUMN IF NOT EXISTS shipyard_rank INTEGER;
ALTER TABLE ships ADD COLUMN IF NOT EXISTS enhance_base INTEGER;
ALTER TABLE ships ADD COLUMN IF NOT EXISTS enhance_re INTEGER;
ALTER TABLE ships ADD COLUMN IF NOT EXISTS build_cities JSONB;
ALTER TABLE ships ADD COLUMN IF NOT EXISTS special_builds JSONB;

UPDATE ships SET build_cities = '[]'::jsonb WHERE build_cities IS NULL;
UPDATE ships SET special_builds = '[]'::jsonb WHERE special_builds IS NULL;
