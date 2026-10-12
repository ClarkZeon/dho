-- catalog_stats 키: languages → skills
-- (테이블 RENAME 은 skillStore.migrateLibraryLanguagesToSkills 에서 수행)

INSERT INTO catalog_stats (stat_key, count, updated_at)
SELECT 'skills', count, updated_at
FROM catalog_stats
WHERE stat_key = 'languages'
ON CONFLICT (stat_key) DO UPDATE SET
  count = GREATEST(catalog_stats.count, EXCLUDED.count),
  updated_at = NOW();

DELETE FROM catalog_stats WHERE stat_key = 'languages';

INSERT INTO catalog_stats (stat_key, count) VALUES ('skills', 0)
ON CONFLICT (stat_key) DO NOTHING;
