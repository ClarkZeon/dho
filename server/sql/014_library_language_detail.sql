-- 언어(스킬) 위키 상세 필드

ALTER TABLE library_languages ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE library_languages ADD COLUMN IF NOT EXISTS range_scope TEXT;
ALTER TABLE library_languages ADD COLUMN IF NOT EXISTS action_power TEXT;
ALTER TABLE library_languages ADD COLUMN IF NOT EXISTS auto_effect TEXT;
ALTER TABLE library_languages ADD COLUMN IF NOT EXISTS learn_places JSONB;
ALTER TABLE library_languages ADD COLUMN IF NOT EXISTS use_cities JSONB;

UPDATE library_languages SET learn_places = '[]'::jsonb WHERE learn_places IS NULL;
UPDATE library_languages SET use_cities = '[]'::jsonb WHERE use_cities IS NULL;

-- 북극어 (위키 예시)
INSERT INTO library_languages (id, slug, name, learn_cost, category, range_scope, sort_order)
VALUES (31, 'arctic', '북극어', 1000000, '언어', '함대', 310)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  learn_cost = EXCLUDED.learn_cost,
  category = EXCLUDED.category,
  range_scope = EXCLUDED.range_scope,
  sort_order = EXCLUDED.sort_order,
  enabled = TRUE;
