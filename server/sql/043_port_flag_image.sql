-- 도시 깃발 이미지 (로컬 /cities/… 경로)
ALTER TABLE ports ADD COLUMN IF NOT EXISTS flag_image TEXT;
