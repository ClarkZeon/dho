-- 선박 관련 테이블 초기화 (데이터 전부 삭제 후 스키마 재적용 전용)
USE dho;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS ship_skill_links;
DROP TABLE IF EXISTS ships;
DROP TABLE IF EXISTS ship_skills;
DROP TABLE IF EXISTS ship_materials;
DROP TABLE IF EXISTS ship_forms;
DROP TABLE IF EXISTS ship_sizes;
SET FOREIGN_KEY_CHECKS = 1;
