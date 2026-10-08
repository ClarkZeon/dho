-- 선박 도감 스키마 (상세 항목 기준)
-- 재질·크기·형식은 마스터 테이블 → 입력 시 콤보박스용
-- 데이터는 자체 입력·공개 출처로 적재. 타 사이트 일괄 수집 없음.

CREATE TABLE IF NOT EXISTS ship_sizes (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(40)  NOT NULL COMMENT '식별 코드 (small2 …)',
  name        VARCHAR(40)  NOT NULL COMMENT '표시명 (소형2 …)',
  sort_order  INT NOT NULL DEFAULT 0,
  is_enabled  TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
              ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_ship_sizes_code (code),
  UNIQUE KEY uq_ship_sizes_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='선박 크기 마스터 (콤보)';


CREATE TABLE IF NOT EXISTS ship_forms (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(40)  NOT NULL COMMENT '식별 코드 (sail/galley/steam …)',
  name        VARCHAR(40)  NOT NULL COMMENT '표시명 (범선/갤리/증기선 …)',
  sort_order  INT NOT NULL DEFAULT 0,
  is_enabled  TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
              ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_ship_forms_code (code),
  UNIQUE KEY uq_ship_forms_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='선박 형식 마스터 (콤보)';


CREATE TABLE IF NOT EXISTS ship_materials (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(80)  NOT NULL COMMENT '식별 코드',
  name        VARCHAR(120) NOT NULL COMMENT '표시명 (재질)',
  sort_order  INT NOT NULL DEFAULT 0,
  is_enabled  TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
              ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_ship_materials_code (code),
  UNIQUE KEY uq_ship_materials_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='선박 재질 마스터 (콤보)';


CREATE TABLE IF NOT EXISTS ships (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug            VARCHAR(80)     NOT NULL COMMENT 'URL/식별용 슬러그',
  name            VARCHAR(120)    NOT NULL COMMENT '선박 이름',
  category        VARCHAR(40)     NULL COMMENT '전투용/교역용/모험용 등',
  description     TEXT            NULL COMMENT '소개 문구',

  size_id         BIGINT UNSIGNED NOT NULL COMMENT 'FK → ship_sizes',
  form_id         BIGINT UNSIGNED NOT NULL COMMENT 'FK → ship_forms (선박 형식)',
  material_id     BIGINT UNSIGNED NULL COMMENT 'FK → ship_materials',

  adventure_lv    SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '모험 레벨',
  trade_lv        SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '교역 레벨',
  battle_lv       SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '전투 레벨',

  acquire_method  VARCHAR(255)    NULL COMMENT '획득 방법',
  enhance_count   TINYINT UNSIGNED NULL COMMENT '강화 횟수',
  shipyard_rank   TINYINT UNSIGNED NULL COMMENT '건조 조선 랭크',
  build_days      SMALLINT UNSIGNED NULL COMMENT '건조 일수',

  -- 기본 성능
  durability      INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '내구도',
  sail_vertical   INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '세로돛',
  sail_horizontal INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '가로돛',
  oar             INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '조력',
  turn_stat       SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '선회',
  wave_resist     SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '내파',
  armor           SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '장갑',

  -- 적재
  cabin           INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '선실',
  crew_required   INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '필요 선원',
  guns            INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '포실',
  warehouse       INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '창고',

  -- 강화 상한
  cap_durability      INT UNSIGNED NULL COMMENT '강화상한 내구도',
  cap_sail_vertical   INT UNSIGNED NULL COMMENT '강화상한 세로돛',
  cap_sail_horizontal INT UNSIGNED NULL COMMENT '강화상한 가로돛',
  cap_oar             INT UNSIGNED NULL COMMENT '강화상한 조력',
  cap_turn            SMALLINT UNSIGNED NULL COMMENT '강화상한 선회',
  cap_wave            SMALLINT UNSIGNED NULL COMMENT '강화상한 내파',
  cap_armor           SMALLINT UNSIGNED NULL COMMENT '강화상한 장갑',
  cap_cabin           INT UNSIGNED NULL COMMENT '강화상한 선실',
  cap_guns            INT UNSIGNED NULL COMMENT '강화상한 포실',
  cap_warehouse       INT UNSIGNED NULL COMMENT '강화상한 창고',

  -- 선박 부품 슬롯 수
  part_aux_sail     TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '보조돛',
  part_figurehead   TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '선수상',
  part_emblem       TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '문장',
  part_special      TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '특수장비',
  part_extra_armor  TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '추가장갑',
  part_broadside    TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '선측포',
  part_bow          TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '선수포',
  part_stern        TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '선미포',

  is_enabled      TINYINT(1) NOT NULL DEFAULT 1,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                  ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_ships_slug (slug),
  KEY idx_ships_name (name),
  KEY idx_ships_category (category),
  KEY idx_ships_size (size_id),
  KEY idx_ships_form (form_id),
  KEY idx_ships_material (material_id),

  CONSTRAINT fk_ships_size
    FOREIGN KEY (size_id) REFERENCES ship_sizes (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ships_form
    FOREIGN KEY (form_id) REFERENCES ship_forms (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ships_material
    FOREIGN KEY (material_id) REFERENCES ship_materials (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='선박 상세 (기본성능·적재·강화상한·부품슬롯)';


CREATE TABLE IF NOT EXISTS ship_skills (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(80) NOT NULL COMMENT '스킬 이름',
  description TEXT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (id),
  UNIQUE KEY uq_ship_skills_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='선박 스킬 마스터';


CREATE TABLE IF NOT EXISTS ship_skill_links (
  ship_id   BIGINT UNSIGNED NOT NULL,
  skill_id  BIGINT UNSIGNED NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,

  PRIMARY KEY (ship_id, skill_id),
  KEY idx_ship_skill_links_skill (skill_id),
  CONSTRAINT fk_ship_skill_ship
    FOREIGN KEY (ship_id) REFERENCES ships (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ship_skill_skill
    FOREIGN KEY (skill_id) REFERENCES ship_skills (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='선박 ↔ 스킬';


-- 콤보 초기 시드 (필요 시 관리 화면에서 추가)
INSERT INTO ship_sizes (code, name, sort_order) VALUES
  ('small1',  '소형1', 10),
  ('small2',  '소형2', 20),
  ('medium1', '중형1', 30),
  ('medium2', '중형2', 40),
  ('large1',  '대형1', 50),
  ('large2',  '대형2', 60)
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

INSERT INTO ship_forms (code, name, sort_order) VALUES
  ('sail',   '범선',   10),
  ('galley', '갤리',   20),
  ('steam',  '증기선', 30)
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

INSERT INTO ship_materials (code, name, sort_order) VALUES
  ('beech',              '너도밤나무',           10),
  ('cedar_plank',        '삼나무판',             20),
  ('red_pine',           '붉은 소나무',          30),
  ('england_admiral',    '잉글랜드 제독 재료',   40),
  ('field_admiral',      '야전용 제독 재료',     50)
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);
