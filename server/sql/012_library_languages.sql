-- Neon / PostgreSQL: 서고 언어 (인게임 언어 스킬)

CREATE TABLE IF NOT EXISTS library_languages (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  learn_cost INTEGER,
  prerequisite TEXT,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_library_languages_enabled_sort
  ON library_languages (enabled, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_library_languages_name
  ON library_languages (name);

INSERT INTO library_languages (id, slug, name, learn_cost, prerequisite, sort_order) VALUES
  (1,  'ancient-egyptian', '고대 이집트어', 30000, NULL, 10),
  (2,  'greek', '그리스어', 6000, NULL, 20),
  (3,  'nahuatl', '나우아틀어', 800000, NULL, 30),
  (4,  'dutch', '네덜란드어', 1000, NULL, 40),
  (5,  'norwegian', '노르웨이어', 1000, NULL, 50),
  (6,  'german', '독일어', 1000, NULL, 60),
  (7,  'latin', '라틴어', 10000, '이탈리아어 1', 70),
  (8,  'maya', '마야어', 600000, NULL, 80),
  (9,  'malay-tagalog', '말레이 타갈로그어', 600000, NULL, 90),
  (10, 'west-african', '서아프리카어', 10000, NULL, 100),
  (11, 'swahili', '스와힐리어', 10000, NULL, 110),
  (12, 'spanish', '스페인어', 1000, NULL, 120),
  (13, 'slavic', '슬라브어', 4000, NULL, 130),
  (14, 'arabic', '아라비아어', 10000, NULL, 140),
  (15, 'english', '영어', 1000, NULL, 150),
  (16, 'oceanic', '오세아니아어', 1000000, NULL, 160),
  (17, 'italian', '이탈리아어', 1000, NULL, 170),
  (18, 'indian', '인도어', 30000, NULL, 180),
  (19, 'japanese', '일본어', 600000, NULL, 190),
  (20, 'korean', '조선어', 600000, NULL, 200),
  (21, 'chinese', '중국어', 500000, NULL, 210),
  (22, 'quechua', '케추아어', 800000, NULL, 220),
  (23, 'celtic', '켈트어', 10000, NULL, 230),
  (24, 'khmer', '크메르어', 500000, NULL, 240),
  (25, 'thai-myanmar', '태국 미얀마어', 600000, NULL, 250),
  (26, 'turkish', '터키어', 10000, NULL, 260),
  (27, 'persian', '페르시아어', 25000, NULL, 270),
  (28, 'portuguese', '포르투갈어', 1000, NULL, 280),
  (29, 'french', '프랑스어', 1000, NULL, 290),
  (30, 'hebrew', '헤브라이어', 30000, NULL, 300)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  learn_cost = EXCLUDED.learn_cost,
  prerequisite = EXCLUDED.prerequisite,
  sort_order = EXCLUDED.sort_order,
  enabled = TRUE;
