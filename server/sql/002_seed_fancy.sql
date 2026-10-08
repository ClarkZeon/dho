-- 팬시(Fancy) 시드
USE dho;

INSERT INTO ship_materials (code, name, sort_order) VALUES
  ('field_admiral', '야전용 제독 재료', 50)
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

-- 스킬 마스터 + 선박별 재료(돛/포문/재료1/재료2)는 JSON 런타임 DB(ships-db.json) 기준.
-- MySQL 이관 시 ship_skill_links 에 sail/gun_port/material1/material2 컬럼 추가 예정.
INSERT INTO ship_skills (name) VALUES
  ('강화포문'),
  ('고속범주'),
  ('급가속'),
  ('반동타'),
  ('사령탑'),
  ('수밀격벽'),
  ('직격저지'),
  ('집중장전'),
  ('특수기뢰')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO ships (
  slug, name, category, description,
  size_id, form_id, material_id,
  adventure_lv, trade_lv, battle_lv,
  acquire_method, enhance_count,
  durability, sail_vertical, sail_horizontal, oar, turn_stat, wave_resist, armor,
  cabin, crew_required, guns, warehouse,
  cap_durability, cap_sail_vertical, cap_sail_horizontal, cap_oar, cap_turn, cap_wave, cap_armor,
  cap_cabin, cap_guns, cap_warehouse,
  part_aux_sail, part_figurehead, part_emblem, part_special, part_extra_armor,
  part_broadside, part_bow, part_stern,
  is_enabled, sort_order
)
SELECT
  'fancy',
  '팬시',
  '전투용',
  '해적 헨리 에브리의 기함으로서, 인도양에서 활약한 매우 빠른 프리깃함.',
  sz.id,
  f.id,
  m.id,
  25, 15, 40,
  '팬시 교환권',
  9,
  1301, 340, 300, 0, 18, 14, 53,
  190, 85, 110, 480,
  280, 150, 150, 0, 24, 25, 25,
  50, 50, 50,
  3, 1, 1, 2, 3,
  5, 1, 1,
  1, 10
FROM ship_sizes sz
JOIN ship_forms f ON f.code = 'sail'
JOIN ship_materials m ON m.code = 'field_admiral'
WHERE sz.code = 'large2'
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  category = VALUES(category),
  description = VALUES(description),
  size_id = VALUES(size_id),
  form_id = VALUES(form_id),
  material_id = VALUES(material_id),
  adventure_lv = VALUES(adventure_lv),
  trade_lv = VALUES(trade_lv),
  battle_lv = VALUES(battle_lv),
  acquire_method = VALUES(acquire_method),
  enhance_count = VALUES(enhance_count),
  durability = VALUES(durability),
  sail_vertical = VALUES(sail_vertical),
  sail_horizontal = VALUES(sail_horizontal),
  oar = VALUES(oar),
  turn_stat = VALUES(turn_stat),
  wave_resist = VALUES(wave_resist),
  armor = VALUES(armor),
  cabin = VALUES(cabin),
  crew_required = VALUES(crew_required),
  guns = VALUES(guns),
  warehouse = VALUES(warehouse),
  cap_durability = VALUES(cap_durability),
  cap_sail_vertical = VALUES(cap_sail_vertical),
  cap_sail_horizontal = VALUES(cap_sail_horizontal),
  cap_oar = VALUES(cap_oar),
  cap_turn = VALUES(cap_turn),
  cap_wave = VALUES(cap_wave),
  cap_armor = VALUES(cap_armor),
  cap_cabin = VALUES(cap_cabin),
  cap_guns = VALUES(cap_guns),
  cap_warehouse = VALUES(cap_warehouse),
  part_aux_sail = VALUES(part_aux_sail),
  part_figurehead = VALUES(part_figurehead),
  part_emblem = VALUES(part_emblem),
  part_special = VALUES(part_special),
  part_extra_armor = VALUES(part_extra_armor),
  part_broadside = VALUES(part_broadside),
  part_bow = VALUES(part_bow),
  part_stern = VALUES(part_stern),
  is_enabled = VALUES(is_enabled),
  sort_order = VALUES(sort_order);

DELETE sslink
FROM ship_skill_links sslink
JOIN ships s ON s.id = sslink.ship_id
WHERE s.slug = 'fancy';

INSERT INTO ship_skill_links (ship_id, skill_id, sort_order)
SELECT s.id, sk.id, ord.n
FROM ships s
JOIN (
  SELECT 1 AS n, '강화포문' AS name UNION ALL
  SELECT 2, '고속범주' UNION ALL
  SELECT 3, '급가속' UNION ALL
  SELECT 4, '반동타' UNION ALL
  SELECT 5, '사령탑' UNION ALL
  SELECT 6, '수밀격벽' UNION ALL
  SELECT 7, '직격저지' UNION ALL
  SELECT 8, '집중장전' UNION ALL
  SELECT 9, '특수기뢰'
) ord
JOIN ship_skills sk ON sk.name = ord.name
WHERE s.slug = 'fancy';
