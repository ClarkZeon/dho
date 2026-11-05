-- 언어 스킬 범위는 항상 함대

UPDATE skills
SET range_scope = '함대'
WHERE category = '언어'
  AND (range_scope IS DISTINCT FROM '함대');
