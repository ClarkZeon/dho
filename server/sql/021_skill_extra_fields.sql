-- 스킬 위키 추가 필드 (모험 스킬 등)

ALTER TABLE skills ADD COLUMN IF NOT EXISTS officer_duty TEXT;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS refine_effect TEXT;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS preferred_jobs JSONB;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS acquire_conditions JSONB;

UPDATE skills
SET preferred_jobs = '[]'::jsonb
WHERE preferred_jobs IS NULL;

UPDATE skills
SET acquire_conditions = '[]'::jsonb
WHERE acquire_conditions IS NULL;
