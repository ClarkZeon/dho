import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { BUNDLED_DATA_DIR } from './paths.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

const BUNDLED_SHIPS_FILE = path.join(BUNDLED_DATA_DIR, 'ships-db.json')

/**
 * @param {Record<string, unknown>} ship
 * @param {Array<Record<string, unknown>>} sizes
 * @param {Array<Record<string, unknown>>} forms
 * @param {Array<Record<string, unknown>>} materials
 * @param {Array<Record<string, unknown>>} skillRows
 */
function decorateShipRow(ship, sizes, forms, materials, skillRows) {
  const size = sizes.find((s) => Number(s.id) === Number(ship.size_id))
  const form = forms.find((f) => Number(f.id) === Number(ship.form_id))
  const material = materials.find(
    (m) => Number(m.id) === Number(ship.material_id),
  )
  const skills = skillRows
    .filter((r) => Number(r.ship_id) === Number(ship.id))
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((row) => ({
      id: Number(row.skill_id),
      name: String(row.skill_name || ''),
      sail: row.sail == null ? null : String(row.sail),
      gunPort: row.gun_port == null ? null : String(row.gun_port),
      material1: row.material1 == null ? null : String(row.material1),
      material2: row.material2 == null ? null : String(row.material2),
    }))

  const sailVertical = Number(ship.sail_vertical) || 0
  const sailHorizontal = Number(ship.sail_horizontal) || 0
  const cabin = Number(ship.cabin) || 0
  const guns = Number(ship.guns) || 0
  const warehouse = Number(ship.warehouse) || 0

  return {
    id: Number(ship.id),
    slug: String(ship.slug),
    name: String(ship.name),
    category: ship.category == null ? null : String(ship.category),
    description: ship.description == null ? null : String(ship.description),
    size: size ? String(size.name) : null,
    sizeCode: size ? String(size.code) : null,
    form: form ? String(form.name) : null,
    formCode: form ? String(form.code) : null,
    material: material ? String(material.name) : null,
    adventureLv: Number(ship.adventure_lv) || 0,
    tradeLv: Number(ship.trade_lv) || 0,
    battleLv: Number(ship.battle_lv) || 0,
    acquireType:
      ship.acquire_type == null ? null : String(ship.acquire_type),
    acquireMethod:
      ship.acquire_method == null ? null : String(ship.acquire_method),
    enhanceCount:
      ship.enhance_count == null ? null : Number(ship.enhance_count),
    buildDays: ship.build_days == null ? null : Number(ship.build_days),
    durability: Number(ship.durability) || 0,
    sailVertical,
    sailHorizontal,
    oar: Number(ship.oar) || 0,
    turn: Number(ship.turn_stat) || 0,
    wave: Number(ship.wave_resist) || 0,
    armor: Number(ship.armor) || 0,
    cabin,
    crewRequired: Number(ship.crew_required) || 0,
    guns,
    warehouse,
    caps: {
      durability: ship.cap_durability == null ? null : Number(ship.cap_durability),
      sailVertical:
        ship.cap_sail_vertical == null ? null : Number(ship.cap_sail_vertical),
      sailHorizontal:
        ship.cap_sail_horizontal == null
          ? null
          : Number(ship.cap_sail_horizontal),
      oar: ship.cap_oar == null ? null : Number(ship.cap_oar),
      turn: ship.cap_turn == null ? null : Number(ship.cap_turn),
      wave: ship.cap_wave == null ? null : Number(ship.cap_wave),
      armor: ship.cap_armor == null ? null : Number(ship.cap_armor),
      cabin: ship.cap_cabin == null ? null : Number(ship.cap_cabin),
      guns: ship.cap_guns == null ? null : Number(ship.cap_guns),
      warehouse: ship.cap_warehouse == null ? null : Number(ship.cap_warehouse),
    },
    parts: {
      auxSail: Number(ship.part_aux_sail) || 0,
      figurehead: Number(ship.part_figurehead) || 0,
      emblem: Number(ship.part_emblem) || 0,
      special: Number(ship.part_special) || 0,
      extraArmor: Number(ship.part_extra_armor) || 0,
      broadside: Number(ship.part_broadside) || 0,
      bow: Number(ship.part_bow) || 0,
      stern: Number(ship.part_stern) || 0,
    },
    skills,
    sailTotal: sailVertical + sailHorizontal,
    loadTotal: cabin + guns + warehouse,
  }
}

async function seedShipsFromBundle() {
  const sql = getSql()
  const raw = await readFile(BUNDLED_SHIPS_FILE, 'utf8')
  const db = JSON.parse(raw)

  for (const size of db.sizes || []) {
    await sql`
      INSERT INTO ship_sizes (id, code, name, sort_order, enabled)
      VALUES (
        ${size.id}, ${size.code}, ${size.name}, ${size.sortOrder ?? 0},
        ${size.enabled !== false}
      )
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order,
        enabled = EXCLUDED.enabled
    `
  }

  for (const form of db.forms || []) {
    await sql`
      INSERT INTO ship_forms (id, code, name, sort_order, enabled)
      VALUES (
        ${form.id}, ${form.code}, ${form.name}, ${form.sortOrder ?? 0},
        ${form.enabled !== false}
      )
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order,
        enabled = EXCLUDED.enabled
    `
  }

  for (const material of db.materials || []) {
    await sql`
      INSERT INTO ship_materials (id, code, name, sort_order, enabled)
      VALUES (
        ${material.id}, ${material.code}, ${material.name},
        ${material.sortOrder ?? 0}, ${material.enabled !== false}
      )
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order,
        enabled = EXCLUDED.enabled
    `
  }

  for (const skill of db.skills || []) {
    await sql`
      INSERT INTO ship_skills (id, name, description)
      VALUES (${skill.id}, ${skill.name}, ${skill.description ?? null})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `
  }

  for (const [index, ship] of (db.ships || []).entries()) {
    await sql`
      INSERT INTO ships (
        id, slug, name, category, description, size_id, form_id, material_id,
        adventure_lv, trade_lv, battle_lv, acquire_type, acquire_method,
        enhance_count, build_days,
        durability, sail_vertical, sail_horizontal, oar, turn_stat, wave_resist,
        armor, cabin, crew_required, guns, warehouse,
        cap_durability, cap_sail_vertical, cap_sail_horizontal, cap_oar,
        cap_turn, cap_wave, cap_armor, cap_cabin, cap_guns, cap_warehouse,
        part_aux_sail, part_figurehead, part_emblem, part_special,
        part_extra_armor, part_broadside, part_bow, part_stern,
        enabled, sort_order
      ) VALUES (
        ${ship.id}, ${ship.slug}, ${ship.name}, ${ship.category ?? null},
        ${ship.description ?? null}, ${ship.sizeId}, ${ship.formId},
        ${ship.materialId ?? null}, ${ship.adventureLv ?? 0},
        ${ship.tradeLv ?? 0}, ${ship.battleLv ?? 0},
        ${ship.acquireType ?? null}, ${ship.acquireMethod ?? null},
        ${ship.enhanceCount ?? null}, ${ship.buildDays ?? null},
        ${ship.durability ?? 0}, ${ship.sailVertical ?? 0},
        ${ship.sailHorizontal ?? 0}, ${ship.oar ?? 0}, ${ship.turn ?? 0},
        ${ship.wave ?? 0}, ${ship.armor ?? 0}, ${ship.cabin ?? 0},
        ${ship.crewRequired ?? 0}, ${ship.guns ?? 0}, ${ship.warehouse ?? 0},
        ${ship.capDurability ?? null}, ${ship.capSailVertical ?? null},
        ${ship.capSailHorizontal ?? null}, ${ship.capOar ?? null},
        ${ship.capTurn ?? null}, ${ship.capWave ?? null},
        ${ship.capArmor ?? null}, ${ship.capCabin ?? null},
        ${ship.capGuns ?? null}, ${ship.capWarehouse ?? null},
        ${ship.partAuxSail ?? 0}, ${ship.partFigurehead ?? 0},
        ${ship.partEmblem ?? 0}, ${ship.partSpecial ?? 0},
        ${ship.partExtraArmor ?? 0}, ${ship.partBroadside ?? 0},
        ${ship.partBow ?? 0}, ${ship.partStern ?? 0},
        ${ship.enabled !== false}, ${ship.sortOrder ?? index}
      )
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        size_id = EXCLUDED.size_id,
        form_id = EXCLUDED.form_id,
        material_id = EXCLUDED.material_id,
        adventure_lv = EXCLUDED.adventure_lv,
        trade_lv = EXCLUDED.trade_lv,
        battle_lv = EXCLUDED.battle_lv,
        acquire_type = EXCLUDED.acquire_type,
        acquire_method = EXCLUDED.acquire_method,
        enhance_count = EXCLUDED.enhance_count,
        build_days = EXCLUDED.build_days,
        durability = EXCLUDED.durability,
        sail_vertical = EXCLUDED.sail_vertical,
        sail_horizontal = EXCLUDED.sail_horizontal,
        oar = EXCLUDED.oar,
        turn_stat = EXCLUDED.turn_stat,
        wave_resist = EXCLUDED.wave_resist,
        armor = EXCLUDED.armor,
        cabin = EXCLUDED.cabin,
        crew_required = EXCLUDED.crew_required,
        guns = EXCLUDED.guns,
        warehouse = EXCLUDED.warehouse,
        cap_durability = EXCLUDED.cap_durability,
        cap_sail_vertical = EXCLUDED.cap_sail_vertical,
        cap_sail_horizontal = EXCLUDED.cap_sail_horizontal,
        cap_oar = EXCLUDED.cap_oar,
        cap_turn = EXCLUDED.cap_turn,
        cap_wave = EXCLUDED.cap_wave,
        cap_armor = EXCLUDED.cap_armor,
        cap_cabin = EXCLUDED.cap_cabin,
        cap_guns = EXCLUDED.cap_guns,
        cap_warehouse = EXCLUDED.cap_warehouse,
        part_aux_sail = EXCLUDED.part_aux_sail,
        part_figurehead = EXCLUDED.part_figurehead,
        part_emblem = EXCLUDED.part_emblem,
        part_special = EXCLUDED.part_special,
        part_extra_armor = EXCLUDED.part_extra_armor,
        part_broadside = EXCLUDED.part_broadside,
        part_bow = EXCLUDED.part_bow,
        part_stern = EXCLUDED.part_stern,
        enabled = EXCLUDED.enabled,
        sort_order = EXCLUDED.sort_order
    `

    await sql`DELETE FROM ship_skill_links WHERE ship_id = ${ship.id}`

    const skillRows = Array.isArray(ship.skills) ? ship.skills : []
    for (const [sortOrder, row] of skillRows.entries()) {
      const skillId = row.skillId ?? row.id
      if (!skillId) continue
      await sql`
        INSERT INTO ship_skill_links (
          ship_id, skill_id, sort_order, sail, gun_port, material1, material2
        ) VALUES (
          ${ship.id}, ${skillId}, ${sortOrder},
          ${row.sail ?? null}, ${row.gunPort ?? null},
          ${row.material1 ?? null}, ${row.material2 ?? null}
        )
        ON CONFLICT (ship_id, skill_id) DO UPDATE SET
          sort_order = EXCLUDED.sort_order,
          sail = EXCLUDED.sail,
          gun_port = EXCLUDED.gun_port,
          material1 = EXCLUDED.material1,
          material2 = EXCLUDED.material2
      `
    }
  }
}

export async function ensureShipStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/006_ships.sql')
  await runSqlFile('sql/007_ship_acquire.sql')
  // 번들 JSON upsert — 신규 선박·획득 방법 반영
  await seedShipsFromBundle()
}

async function loadLookups() {
  const sql = getSql()
  const [sizes, forms, materials] = await Promise.all([
    sql`SELECT id, code, name, sort_order, enabled FROM ship_sizes ORDER BY sort_order`,
    sql`SELECT id, code, name, sort_order, enabled FROM ship_forms ORDER BY sort_order`,
    sql`SELECT id, code, name, sort_order, enabled FROM ship_materials ORDER BY sort_order`,
  ])
  return { sizes, forms, materials }
}

export async function listShipLookups() {
  const { sizes, forms, materials } = await loadLookups()
  return {
    sizes: sizes
      .filter((x) => x.enabled !== false)
      .map((x) => ({
        id: Number(x.id),
        code: String(x.code),
        name: String(x.name),
        sortOrder: Number(x.sort_order) || 0,
        enabled: true,
      })),
    forms: forms
      .filter((x) => x.enabled !== false)
      .map((x) => ({
        id: Number(x.id),
        code: String(x.code),
        name: String(x.name),
        sortOrder: Number(x.sort_order) || 0,
        enabled: true,
      })),
    materials: materials
      .filter((x) => x.enabled !== false)
      .map((x) => ({
        id: Number(x.id),
        code: String(x.code),
        name: String(x.name),
        sortOrder: Number(x.sort_order) || 0,
        enabled: true,
      })),
  }
}

async function loadSkillLinks() {
  const sql = getSql()
  return sql`
    SELECT l.ship_id, l.skill_id, l.sort_order, l.sail, l.gun_port,
           l.material1, l.material2, s.name AS skill_name
    FROM ship_skill_links l
    JOIN ship_skills s ON s.id = l.skill_id
    ORDER BY l.ship_id, l.sort_order
  `
}

export async function listShips() {
  const sql = getSql()
  const [ships, lookups, skillRows] = await Promise.all([
    sql`SELECT * FROM ships WHERE enabled = TRUE ORDER BY sort_order, id`,
    loadLookups(),
    loadSkillLinks(),
  ])
  return ships.map((ship) =>
    decorateShipRow(
      ship,
      lookups.sizes,
      lookups.forms,
      lookups.materials,
      skillRows,
    ),
  )
}

export async function getShipBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM ships WHERE slug = ${slug} AND enabled = TRUE LIMIT 1
  `
  if (!rows[0]) return null
  const [lookups, skillRows] = await Promise.all([
    loadLookups(),
    loadSkillLinks(),
  ])
  return decorateShipRow(
    rows[0],
    lookups.sizes,
    lookups.forms,
    lookups.materials,
    skillRows,
  )
}

/** 번들 JSON으로 강제 재시드 (마이그레이션용) */
export async function reseedShipsFromBundle() {
  await runSqlFile('sql/006_ships.sql')
  await runSqlFile('sql/007_ship_acquire.sql')
  await seedShipsFromBundle()
}

/**
 * @param {string} name
 * @param {Array<{ id: unknown, name: unknown }>} rows
 */
function findLookupIdByName(name, rows) {
  if (!name) return null
  const needle = String(name).replace(/\s+/g, '').toLowerCase()
  const hit = rows.find(
    (row) => String(row.name).replace(/\s+/g, '').toLowerCase() === needle,
  )
  return hit ? Number(hit.id) : null
}

/**
 * @param {string} name
 */
async function ensureMaterialId(name) {
  if (!name) return null
  const sql = getSql()
  const existing = await sql`
    SELECT id FROM ship_materials WHERE name = ${name} LIMIT 1
  `
  if (existing[0]) return Number(existing[0].id)
  const maxRows = await sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM ship_materials`
  const id = Number(maxRows[0].max_id) + 1
  const code = `mat-${id}`
  await sql`
    INSERT INTO ship_materials (id, code, name, sort_order, enabled)
    VALUES (${id}, ${code}, ${name}, ${id}, TRUE)
  `
  return id
}

/**
 * @param {string} name
 */
async function ensureSkillId(name) {
  const sql = getSql()
  const existing = await sql`
    SELECT id FROM ship_skills WHERE name = ${name} LIMIT 1
  `
  if (existing[0]) return Number(existing[0].id)
  const maxRows = await sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM ship_skills`
  const id = Number(maxRows[0].max_id) + 1
  await sql`
    INSERT INTO ship_skills (id, name, description)
    VALUES (${id}, ${name}, NULL)
  `
  return id
}

function normalizeShipName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
}

/** 텍스트 파싱 결과로 선박 신규 등록 (동일 이름 거부) */
export async function upsertShipFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeShipName(parsed.name)
  if (!name) throw new Error('선박 이름이 없습니다.')

  const dup = await sql`
    SELECT id, name FROM ships
    WHERE TRIM(BOTH FROM regexp_replace(name, '\\s+', ' ', 'g')) = ${name}
    LIMIT 1
  `
  if (dup[0]) {
    throw new Error(`중복 선박이 존재합니다. (「${dup[0].name}」)`)
  }

  const { sizes, forms } = await loadLookups()

  let sizeId = findLookupIdByName(parsed.sizeName, sizes)
  let formId = findLookupIdByName(parsed.formName, forms)
  if (!sizeId && sizes[0]) sizeId = Number(sizes[0].id)
  if (!formId && forms[0]) formId = Number(forms[0].id)
  if (!sizeId || !formId) {
    throw new Error('선박 크기/형태 룩업이 없습니다. 시드를 먼저 적용하세요.')
  }

  const materialId = await ensureMaterialId(parsed.materialName)

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash = await sql`SELECT id FROM ships WHERE slug = ${attempt} LIMIT 1`
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows = await sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM ships`
  const shipId = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM ships`
  const sortOrder = Number(sortRows[0].max_sort) + 1

  await sql`
    INSERT INTO ships (
      id, slug, name, category, description, size_id, form_id, material_id,
      adventure_lv, trade_lv, battle_lv, acquire_type, acquire_method,
      enhance_count, build_days,
      durability, sail_vertical, sail_horizontal, oar, turn_stat, wave_resist,
      armor, cabin, crew_required, guns, warehouse,
      cap_durability, cap_sail_vertical, cap_sail_horizontal, cap_oar,
      cap_turn, cap_wave, cap_armor, cap_cabin, cap_guns, cap_warehouse,
      part_aux_sail, part_figurehead, part_emblem, part_special,
      part_extra_armor, part_broadside, part_bow, part_stern,
      enabled, sort_order
    ) VALUES (
      ${shipId}, ${slug}, ${name}, ${parsed.category},
      ${parsed.description}, ${sizeId}, ${formId}, ${materialId},
      ${parsed.adventureLv}, ${parsed.tradeLv}, ${parsed.battleLv},
      ${parsed.acquireType}, ${parsed.acquireMethod},
      ${parsed.enhanceCount}, ${parsed.buildDays},
      ${parsed.durability}, ${parsed.sailVertical}, ${parsed.sailHorizontal},
      ${parsed.oar}, ${parsed.turn}, ${parsed.wave}, ${parsed.armor},
      ${parsed.cabin}, ${parsed.crewRequired}, ${parsed.guns}, ${parsed.warehouse},
      ${parsed.caps.durability}, ${parsed.caps.sailVertical},
      ${parsed.caps.sailHorizontal}, ${parsed.caps.oar},
      ${parsed.caps.turn}, ${parsed.caps.wave}, ${parsed.caps.armor},
      ${parsed.caps.cabin}, ${parsed.caps.guns}, ${parsed.caps.warehouse},
      ${parsed.parts.auxSail}, ${parsed.parts.figurehead},
      ${parsed.parts.emblem}, ${parsed.parts.special},
      ${parsed.parts.extraArmor}, ${parsed.parts.broadside},
      ${parsed.parts.bow}, ${parsed.parts.stern},
      TRUE, ${sortOrder}
    )
  `

  for (const [sortIdx, skill] of (parsed.skills || []).entries()) {
    if (!skill?.name) continue
    const skillId = await ensureSkillId(skill.name)
    await sql`
      INSERT INTO ship_skill_links (
        ship_id, skill_id, sort_order, sail, gun_port, material1, material2
      ) VALUES (
        ${shipId}, ${skillId}, ${sortIdx},
        ${skill.sail}, ${skill.gunPort}, ${skill.material1}, ${skill.material2}
      )
      ON CONFLICT (ship_id, skill_id) DO UPDATE SET
        sort_order = EXCLUDED.sort_order,
        sail = EXCLUDED.sail,
        gun_port = EXCLUDED.gun_port,
        material1 = EXCLUDED.material1,
        material2 = EXCLUDED.material2
    `
  }

  return getShipBySlug(slug)
}
