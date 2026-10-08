-- Neon / PostgreSQL: 발견물 분류 (그룹 ≠ 카테고리)
-- 그룹: 유물 / 보물 / 생물 / 지리·천문 / 기상·전승
-- 카테고리: 각 행의 나머지 항목들

CREATE TABLE IF NOT EXISTS discovery_category_groups (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS discovery_categories (
  id BIGINT PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES discovery_category_groups (id),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_discovery_categories_group
  ON discovery_categories (group_id, sort_order, id);

INSERT INTO discovery_category_groups (id, code, name, sort_order) VALUES
  (1, 'relic', '유물', 10),
  (2, 'treasure', '보물', 20),
  (3, 'creature', '생물', 30),
  (4, 'geo_astro', '지리·천문', 40),
  (5, 'weather_lore', '기상·전승', 50)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  enabled = TRUE;

INSERT INTO discovery_categories (id, group_id, code, name, sort_order) VALUES
  -- 유물
  (1, 1, 'historic_site', '사적', 10),
  (2, 1, 'religious_building', '종교건축물', 20),
  (3, 1, 'historic_relic', '역사유물', 30),
  (4, 1, 'religious_relic', '종교유물', 40),
  -- 보물
  (5, 2, 'artwork', '미술품', 10),
  (6, 2, 'treasure', '보물', 20),
  (7, 2, 'fossil', '화석', 30),
  -- 생물
  (8, 3, 'plant', '식물', 10),
  (9, 3, 'insect', '곤충', 20),
  (10, 3, 'bird', '조류', 30),
  (11, 3, 'small_creature', '소형생물', 40),
  (12, 3, 'medium_creature', '중형생물', 50),
  (13, 3, 'large_creature', '대형생물', 60),
  (14, 3, 'marine_creature', '해양생물', 70),
  -- 지리·천문
  (15, 4, 'port_town', '항구·마을', 10),
  (16, 4, 'geography', '지리', 20),
  (17, 4, 'astronomy', '천문', 30),
  -- 기상·전승
  (18, 5, 'weather', '기상 현상', 10),
  (19, 5, 'legend', '전승', 20)
ON CONFLICT (id) DO UPDATE SET
  group_id = EXCLUDED.group_id,
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  enabled = TRUE;
