-- 언어가 아닌 스킬은 사용 도시 없음

UPDATE skills
SET use_cities = '[]'::jsonb
WHERE category IS DISTINCT FROM '언어'
  AND use_cities IS NOT NULL
  AND use_cities <> '[]'::jsonb;
