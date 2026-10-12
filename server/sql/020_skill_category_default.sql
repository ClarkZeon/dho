-- 스킬 카탈로그: 기존 언어 행 분류를 '언어'로 채움

UPDATE skills
SET category = '언어'
WHERE enabled = TRUE
  AND (category IS NULL OR TRIM(category) = '');
