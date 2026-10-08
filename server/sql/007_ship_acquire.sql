-- 획득 구분 · 건조 일수
ALTER TABLE ships ADD COLUMN IF NOT EXISTS acquire_type TEXT;
ALTER TABLE ships ADD COLUMN IF NOT EXISTS build_days INTEGER;
