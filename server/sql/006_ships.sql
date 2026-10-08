-- Neon / PostgreSQL: 선박 도감

CREATE TABLE IF NOT EXISTS ship_sizes (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ship_forms (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ship_materials (
  id BIGINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ship_skills (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS ships (
  id BIGINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  size_id BIGINT NOT NULL REFERENCES ship_sizes (id),
  form_id BIGINT NOT NULL REFERENCES ship_forms (id),
  material_id BIGINT REFERENCES ship_materials (id),
  adventure_lv INTEGER NOT NULL DEFAULT 0,
  trade_lv INTEGER NOT NULL DEFAULT 0,
  battle_lv INTEGER NOT NULL DEFAULT 0,
  acquire_type TEXT,
  acquire_method TEXT,
  enhance_count INTEGER,
  build_days INTEGER,
  durability INTEGER NOT NULL DEFAULT 0,
  sail_vertical INTEGER NOT NULL DEFAULT 0,
  sail_horizontal INTEGER NOT NULL DEFAULT 0,
  oar INTEGER NOT NULL DEFAULT 0,
  turn_stat INTEGER NOT NULL DEFAULT 0,
  wave_resist INTEGER NOT NULL DEFAULT 0,
  armor INTEGER NOT NULL DEFAULT 0,
  cabin INTEGER NOT NULL DEFAULT 0,
  crew_required INTEGER NOT NULL DEFAULT 0,
  guns INTEGER NOT NULL DEFAULT 0,
  warehouse INTEGER NOT NULL DEFAULT 0,
  cap_durability INTEGER,
  cap_sail_vertical INTEGER,
  cap_sail_horizontal INTEGER,
  cap_oar INTEGER,
  cap_turn INTEGER,
  cap_wave INTEGER,
  cap_armor INTEGER,
  cap_cabin INTEGER,
  cap_guns INTEGER,
  cap_warehouse INTEGER,
  part_aux_sail INTEGER NOT NULL DEFAULT 0,
  part_figurehead INTEGER NOT NULL DEFAULT 0,
  part_emblem INTEGER NOT NULL DEFAULT 0,
  part_special INTEGER NOT NULL DEFAULT 0,
  part_extra_armor INTEGER NOT NULL DEFAULT 0,
  part_broadside INTEGER NOT NULL DEFAULT 0,
  part_bow INTEGER NOT NULL DEFAULT 0,
  part_stern INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ship_skill_links (
  ship_id BIGINT NOT NULL REFERENCES ships (id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES ship_skills (id),
  sort_order SMALLINT NOT NULL DEFAULT 0,
  sail TEXT,
  gun_port TEXT,
  material1 TEXT,
  material2 TEXT,
  PRIMARY KEY (ship_id, skill_id)
);
