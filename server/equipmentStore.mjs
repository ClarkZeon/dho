import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export async function ensureEquipmentStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/032_equipments.sql')
  await runSqlFile('sql/033_equipment_detail_extra.sql')
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function asJsonArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function asJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      /* ignore */
    }
  }
  return {}
}

function asNullableText(value) {
  const t = value == null ? '' : String(value).trim()
  return t || null
}

function asPurchaseRows(value) {
  return asJsonArray(value).map((item) => ({
    npc: String(item?.npc || ''),
    region: String(item?.region || ''),
    place: String(item?.place || ''),
    price:
      item?.price == null || String(item.price).trim() === ''
        ? null
        : String(item.price).trim(),
  }))
}

function asSkillRows(value) {
  return asJsonArray(value)
    .map((item) => ({
      name: String(item?.name || '').trim(),
      rank:
        item?.rank == null || String(item.rank).trim() === ''
          ? null
          : String(item.rank).trim(),
    }))
    .filter((r) => r.name)
}

function asEffectRows(value) {
  return asSkillRows(value)
}

function asRequirements(value) {
  const obj = asJsonObject(value)
  return {
    fame: asNullableText(obj.fame),
    infamy: asNullableText(obj.infamy),
    gender: asNullableText(obj.gender),
    jobClass: asNullableText(obj.jobClass),
    title: asNullableText(obj.title),
    alias: asNullableText(obj.alias),
  }
}

function asTransmutations(value) {
  return asJsonArray(value).map((item) => ({
    policy: String(item?.policy || ''),
    skills: String(item?.skills || ''),
    materials: String(item?.materials || ''),
    product: String(item?.product || ''),
  }))
}

function asQuestRows(value) {
  return asJsonArray(value).map((item) => ({
    quest: String(item?.quest || ''),
    destination: String(item?.destination || ''),
  }))
}

function asInfoRows(value) {
  return asJsonArray(value).map((item) => ({
    name: String(item?.name || ''),
    detail:
      item?.detail == null || String(item.detail).trim() === ''
        ? null
        : String(item.detail).trim(),
  }))
}

function asMethodList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[·,，/|｜\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  throw new Error('획득 방법 형식이 올바르지 않습니다.')
}

function decorateEquipment(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    altName: row.alt_name == null ? null : String(row.alt_name),
    description: row.description == null ? null : String(row.description),
    category: row.category == null ? null : String(row.category),
    useEffect: row.use_effect == null ? null : String(row.use_effect),
    equipSlot: row.equip_slot == null ? null : String(row.equip_slot),
    durability: row.durability == null ? null : String(row.durability),
    attack: row.attack == null ? null : String(row.attack),
    defense: row.defense == null ? null : String(row.defense),
    dressEtiquette:
      row.dress_etiquette == null ? null : String(row.dress_etiquette),
    disguise: row.disguise == null ? null : String(row.disguise),
    skills: asSkillRows(row.skills),
    equipmentEffects: asEffectRows(row.equipment_effects),
    memorialAlbum:
      row.memorial_album == null ? null : String(row.memorial_album),
    requirements: asRequirements(row.requirements),
    nonTradable: Boolean(row.non_tradable),
    acquireMethods: asJsonArray(row.acquire_methods).map(String),
    purchases: asPurchaseRows(row.purchases),
    transmutations: asTransmutations(row.transmutations),
    quests: asQuestRows(row.quests),
    treasureMaps: asInfoRows(row.treasure_maps),
    memorialAlbums: asInfoRows(row.memorial_albums),
  }
}

export async function listEquipments() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM equipments WHERE enabled = TRUE ORDER BY sort_order, id
  `
  return rows.map(decorateEquipment)
}

export async function getEquipmentBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM equipments WHERE slug = ${slug} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateEquipment(rows[0]) : null
}

export async function getEquipmentById(id) {
  const sql = getSql()
  const equipmentId = Number(id)
  if (!Number.isFinite(equipmentId)) return null
  const rows = await sql`
    SELECT * FROM equipments WHERE id = ${equipmentId} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateEquipment(rows[0]) : null
}

/**
 * @param {number} id
 * @param {Record<string, unknown>} patch
 */
export async function updateEquipmentFields(id, patch) {
  const sql = getSql()
  const equipmentId = Number(id)
  if (!Number.isFinite(equipmentId)) throw new Error('잘못된 장비품 ID입니다.')

  const current = await getEquipmentById(equipmentId)
  if (!current) throw new Error('장비품을 찾을 수 없습니다.')

  const next = {
    altName: 'altName' in patch ? asNullableText(patch.altName) : current.altName,
    category:
      'category' in patch ? asNullableText(patch.category) : current.category,
    useEffect:
      'useEffect' in patch ? asNullableText(patch.useEffect) : current.useEffect,
    equipSlot:
      'equipSlot' in patch ? asNullableText(patch.equipSlot) : current.equipSlot,
    durability:
      'durability' in patch
        ? asNullableText(patch.durability)
        : current.durability,
    attack: 'attack' in patch ? asNullableText(patch.attack) : current.attack,
    defense:
      'defense' in patch ? asNullableText(patch.defense) : current.defense,
    dressEtiquette:
      'dressEtiquette' in patch
        ? asNullableText(patch.dressEtiquette)
        : current.dressEtiquette,
    disguise:
      'disguise' in patch ? asNullableText(patch.disguise) : current.disguise,
    skills: 'skills' in patch ? asSkillRows(patch.skills) : current.skills,
    equipmentEffects:
      'equipmentEffects' in patch
        ? asEffectRows(patch.equipmentEffects)
        : current.equipmentEffects,
    memorialAlbum:
      'memorialAlbum' in patch
        ? asNullableText(patch.memorialAlbum)
        : current.memorialAlbum,
    requirements:
      'requirements' in patch
        ? asRequirements(patch.requirements)
        : current.requirements,
    nonTradable:
      'nonTradable' in patch
        ? Boolean(patch.nonTradable)
        : current.nonTradable,
    acquireMethods:
      'acquireMethods' in patch
        ? asMethodList(patch.acquireMethods)
        : current.acquireMethods,
    purchases:
      'purchases' in patch ? asPurchaseRows(patch.purchases) : current.purchases,
    transmutations:
      'transmutations' in patch
        ? asTransmutations(patch.transmutations)
        : current.transmutations,
    quests: 'quests' in patch ? asQuestRows(patch.quests) : current.quests,
    treasureMaps:
      'treasureMaps' in patch
        ? asInfoRows(patch.treasureMaps)
        : current.treasureMaps,
    memorialAlbums:
      'memorialAlbums' in patch
        ? asInfoRows(patch.memorialAlbums)
        : current.memorialAlbums,
    description:
      'description' in patch
        ? asNullableText(patch.description)
        : current.description,
  }

  await sql`
    UPDATE equipments SET
      alt_name = ${next.altName},
      description = ${next.description},
      category = ${next.category},
      use_effect = ${next.useEffect},
      equip_slot = ${next.equipSlot},
      durability = ${next.durability},
      attack = ${next.attack},
      defense = ${next.defense},
      dress_etiquette = ${next.dressEtiquette},
      disguise = ${next.disguise},
      skills = ${JSON.stringify(next.skills)},
      equipment_effects = ${JSON.stringify(next.equipmentEffects)},
      memorial_album = ${next.memorialAlbum},
      requirements = ${JSON.stringify(next.requirements)},
      non_tradable = ${next.nonTradable},
      acquire_methods = ${JSON.stringify(next.acquireMethods)},
      purchases = ${JSON.stringify(next.purchases)},
      transmutations = ${JSON.stringify(next.transmutations)},
      quests = ${JSON.stringify(next.quests)},
      treasure_maps = ${JSON.stringify(next.treasureMaps)},
      memorial_albums = ${JSON.stringify(next.memorialAlbums)}
    WHERE id = ${equipmentId}
  `
  return getEquipmentById(equipmentId)
}

/** @param {number} id */
export async function deleteEquipment(id) {
  const sql = getSql()
  const equipmentId = Number(id)
  if (!Number.isFinite(equipmentId)) throw new Error('잘못된 장비품 ID입니다.')
  const rows = await sql`
    UPDATE equipments SET enabled = FALSE
    WHERE id = ${equipmentId} AND enabled = TRUE
    RETURNING id
  `
  if (!rows[0]) throw new Error('장비품을 찾을 수 없습니다.')
  await bumpCatalogStat('equipments', -1)
  return { ok: true }
}

async function findIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug, enabled FROM equipments
    WHERE TRIM(BOTH FROM regexp_replace(name, '\\s+', ' ', 'g')) = ${name}
    LIMIT 1
  `
  return dup[0]
    ? {
        id: Number(dup[0].id),
        slug: String(dup[0].slug),
        enabled: Boolean(dup[0].enabled),
      }
    : null
}

function payloadFromParsed(parsed) {
  return {
    altName: asNullableText(parsed.altName),
    description: asNullableText(parsed.description),
    category: asNullableText(parsed.category),
    useEffect: asNullableText(parsed.useEffect),
    equipSlot: asNullableText(parsed.equipSlot),
    durability: asNullableText(parsed.durability),
    attack: asNullableText(parsed.attack),
    defense: asNullableText(parsed.defense),
    dressEtiquette: asNullableText(parsed.dressEtiquette),
    disguise: asNullableText(parsed.disguise),
    skills: asSkillRows(parsed.skills),
    equipmentEffects: asEffectRows(parsed.equipmentEffects),
    memorialAlbum: asNullableText(parsed.memorialAlbum),
    requirements: asRequirements(parsed.requirements),
    nonTradable: Boolean(parsed.nonTradable),
    acquireMethods: asMethodList(parsed.acquireMethods || []),
    purchases: asPurchaseRows(parsed.purchases || []),
    transmutations: asTransmutations(parsed.transmutations || []),
    quests: asQuestRows(parsed.quests || []),
    treasureMaps: asInfoRows(parsed.treasureMaps || []),
    memorialAlbums: asInfoRows(parsed.memorialAlbums || []),
  }
}

export async function upsertEquipmentFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeName(parsed.name)
  if (!name) throw new Error('장비품 이름이 없습니다.')

  const existing = await findIdByName(sql, name)
  const p = payloadFromParsed(parsed)

  if (existing) {
    await sql`
      UPDATE equipments SET
        name = ${name},
        alt_name = ${p.altName},
        description = ${p.description},
        category = ${p.category},
        use_effect = ${p.useEffect},
        equip_slot = ${p.equipSlot},
        durability = ${p.durability},
        attack = ${p.attack},
        defense = ${p.defense},
        dress_etiquette = ${p.dressEtiquette},
        disguise = ${p.disguise},
        skills = ${JSON.stringify(p.skills)},
        equipment_effects = ${JSON.stringify(p.equipmentEffects)},
        memorial_album = ${p.memorialAlbum},
        requirements = ${JSON.stringify(p.requirements)},
        non_tradable = ${p.nonTradable},
        acquire_methods = ${JSON.stringify(p.acquireMethods)},
        purchases = ${JSON.stringify(p.purchases)},
        transmutations = ${JSON.stringify(p.transmutations)},
        quests = ${JSON.stringify(p.quests)},
        treasure_maps = ${JSON.stringify(p.treasureMaps)},
        memorial_albums = ${JSON.stringify(p.memorialAlbums)},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    await bumpCatalogStatIfGrew('equipments', existing.enabled)
    return getEquipmentBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash = await sql`
      SELECT id FROM equipments WHERE slug = ${attempt} LIMIT 1
    `
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows = await sql`
    SELECT COALESCE(MAX(id), 0) AS max_id FROM equipments
  `
  const id = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM equipments
  `
  const sortOrder = Number(sortRows[0].max_sort) + 1

  await sql`
    INSERT INTO equipments (
      id, slug, name, alt_name, description, category, use_effect,
      equip_slot, durability, attack, defense, dress_etiquette, disguise,
      skills, equipment_effects, memorial_album, requirements, non_tradable,
      acquire_methods, purchases, transmutations, quests, treasure_maps,
      memorial_albums, enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${p.altName}, ${p.description}, ${p.category},
      ${p.useEffect}, ${p.equipSlot}, ${p.durability}, ${p.attack}, ${p.defense},
      ${p.dressEtiquette}, ${p.disguise}, ${JSON.stringify(p.skills)},
      ${JSON.stringify(p.equipmentEffects)}, ${p.memorialAlbum},
      ${JSON.stringify(p.requirements)}, ${p.nonTradable},
      ${JSON.stringify(p.acquireMethods)}, ${JSON.stringify(p.purchases)},
      ${JSON.stringify(p.transmutations)}, ${JSON.stringify(p.quests)},
      ${JSON.stringify(p.treasureMaps)}, ${JSON.stringify(p.memorialAlbums)},
      TRUE, ${sortOrder}
    )
  `

  await bumpCatalogStat('equipments', 1)
  return getEquipmentBySlug(slug)
}
