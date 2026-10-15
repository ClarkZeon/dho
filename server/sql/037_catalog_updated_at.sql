-- 카탈로그: 수정 시각 (목록 최근순). 트리거는 catalogUpdatedAt.mjs 에서 설치.

ALTER TABLE quests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE quests SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE quests ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE quests ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE ports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE ports SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE ports ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE ports ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE regions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE regions SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE regions ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE regions ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE entry_permits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE entry_permits SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE entry_permits ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE entry_permits ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE discoveries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE discoveries SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE discoveries ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE discoveries ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE skills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE skills SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE skills ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE skills ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE titles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE titles SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE titles ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE titles ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE fields ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE fields SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE fields ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE fields ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE sea_areas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE sea_areas SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE sea_areas ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE sea_areas ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE consumables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE consumables SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE consumables ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE consumables ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE equipments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE equipments SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE equipments ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE equipments ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE memorial_albums ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE memorial_albums SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE memorial_albums ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE memorial_albums ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE ships ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE ships SET updated_at = NOW() WHERE updated_at IS NULL;
ALTER TABLE ships ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE ships ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE ship_materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE ship_materials SET updated_at = NOW() WHERE updated_at IS NULL;
ALTER TABLE ship_materials ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE ship_materials ALTER COLUMN updated_at SET NOT NULL;
