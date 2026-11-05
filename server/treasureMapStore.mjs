import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export async function ensureTreasureMapStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/038_treasure_maps.sql')
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function asNullableText(value) {
  const t = value == null ? '' : String(value).trim()
  return t || null
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

function asInt(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function asStringList(value) {
  return asJsonArray(value).map((item) => String(item || '').trim()).filter(Boolean)
}

function decorateMap(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    altName: row.alt_name == null ? null : String(row.alt_name),
    mapKind: row.map_kind == null ? '보물지도' : String(row.map_kind),
    description: row.description == null ? null : String(row.description),
    category: row.category == null ? null : String(row.category),
    libraries: asStringList(row.libraries),
    academicField:
      row.academic_field == null ? null : String(row.academic_field),
    destinationCity:
      row.destination_city == null ? null : String(row.destination_city),
    destination: row.destination == null ? null : String(row.destination),
    discoveries: asJsonArray(row.discoveries).map((item) => ({
      category: item?.category == null ? null : String(item.category),
      rank: item?.rank == null || item?.rank === '' ? null : Number(item.rank),
      name: String(item?.name || ''),
    })),
    skillReqs: asJsonArray(row.skill_reqs).map((item) => ({
      name: String(item?.name || ''),
      rank: item?.rank == null || item?.rank === '' ? null : Number(item.rank),
    })),
    discoveryExp: row.discovery_exp == null ? null : Number(row.discovery_exp),
    cardExp: row.card_exp == null ? null : Number(row.card_exp),
    ducat: row.ducat == null ? null : Number(row.ducat),
    rewardItems: asJsonArray(row.reward_items).map((item) => ({
      name: String(item?.name || ''),
      count: item?.count == null || item?.count === '' ? null : Number(item.count),
    })),
    linkedQuests: asJsonArray(row.linked_quests).map((item) => ({
      tag: item?.tag == null ? null : String(item.tag),
      title: String(item?.title || item?.raw || ''),
      raw: String(item?.raw || item?.title || ''),
    })),
    walkthrough: row.walkthrough == null ? null : String(row.walkthrough),
    updatedAt: row.updated_at
      ? new Date(/** @type {string|Date} */ (row.updated_at)).toISOString()
      : null,
  }
}

export async function listTreasureMaps() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM treasure_maps
    WHERE enabled = TRUE
    ORDER BY updated_at DESC NULLS LAST, id DESC
  `
  return rows.map(decorateMap)
}

export async function getTreasureMapById(id) {
  const sql = getSql()
  const mapId = Number(id)
  if (!Number.isFinite(mapId)) return null
  const rows = await sql`
    SELECT * FROM treasure_maps WHERE id = ${mapId} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateMap(rows[0]) : null
}

export async function getTreasureMapBySlug(slug) {
  const key = String(slug || '').trim()
  if (!key) return null
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM treasure_maps WHERE slug = ${key} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateMap(rows[0]) : null
}

/** @deprecated use getTreasureMapBySlug */
async function getBySlug(slug) {
  return getTreasureMapBySlug(slug)
}

export async function getTreasureMapByName(name) {
  const key = normalizeName(name)
  if (!key) return null
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM treasure_maps
    WHERE enabled = TRUE
      AND TRIM(BOTH FROM regexp_replace(name, '\\s+', ' ', 'g')) = ${key}
    LIMIT 1
  `
  return rows[0] ? decorateMap(rows[0]) : null
}

/** id · slug · 이름 */
export async function getTreasureMapByKey(key) {
  const raw = String(key || '').trim()
  if (!raw) return null
  const asId = Number(raw)
  if (Number.isFinite(asId) && String(asId) === raw) {
    const byId = await getTreasureMapById(asId)
    if (byId) return byId
  }
  const bySlug = await getTreasureMapBySlug(raw)
  if (bySlug) return bySlug
  return getTreasureMapByName(raw)
}

function payloadFrom(parsed) {
  return {
    altName: asNullableText(parsed.altName),
    mapKind: asNullableText(parsed.mapKind) || '보물지도',
    description: asNullableText(parsed.description),
    category: asNullableText(parsed.category),
    libraries: asStringList(parsed.libraries),
    academicField: asNullableText(parsed.academicField),
    destinationCity: asNullableText(parsed.destinationCity),
    destination: asNullableText(parsed.destination),
    discoveries: asJsonArray(parsed.discoveries),
    skillReqs: asJsonArray(parsed.skillReqs),
    discoveryExp: asInt(parsed.discoveryExp),
    cardExp: asInt(parsed.cardExp),
    ducat: asInt(parsed.ducat),
    rewardItems: asJsonArray(parsed.rewardItems),
    linkedQuests: asJsonArray(parsed.linkedQuests),
    walkthrough: asNullableText(parsed.walkthrough),
  }
}

/**
 * @param {number} id
 * @param {Record<string, unknown>} patch
 */
export async function updateTreasureMapFields(id, patch) {
  const sql = getSql()
  const mapId = Number(id)
  if (!Number.isFinite(mapId)) throw new Error('잘못된 지도 ID입니다.')
  const current = await getTreasureMapById(mapId)
  if (!current) throw new Error('지도를 찾을 수 없습니다.')

  const next = payloadFrom({
    ...current,
    ...patch,
  })

  await sql`
    UPDATE treasure_maps SET
      alt_name = ${next.altName},
      map_kind = ${next.mapKind},
      description = ${next.description},
      category = ${next.category},
      libraries = ${JSON.stringify(next.libraries)},
      academic_field = ${next.academicField},
      destination_city = ${next.destinationCity},
      destination = ${next.destination},
      discoveries = ${JSON.stringify(next.discoveries)},
      skill_reqs = ${JSON.stringify(next.skillReqs)},
      discovery_exp = ${next.discoveryExp},
      card_exp = ${next.cardExp},
      ducat = ${next.ducat},
      reward_items = ${JSON.stringify(next.rewardItems)},
      linked_quests = ${JSON.stringify(next.linkedQuests)},
      walkthrough = ${next.walkthrough}
    WHERE id = ${mapId}
  `
  return getTreasureMapById(mapId)
}

export async function deleteTreasureMap(id) {
  const sql = getSql()
  const mapId = Number(id)
  if (!Number.isFinite(mapId)) throw new Error('잘못된 지도 ID입니다.')
  const rows = await sql`
    UPDATE treasure_maps SET enabled = FALSE
    WHERE id = ${mapId} AND enabled = TRUE
    RETURNING id
  `
  if (!rows[0]) throw new Error('지도를 찾을 수 없습니다.')
  await bumpCatalogStat('treasure_maps', -1)
  return { ok: true }
}

async function findIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug, enabled FROM treasure_maps
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

export async function upsertTreasureMapFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeName(parsed.name)
  if (!name) throw new Error('지도 이름이 없습니다.')
  const payload = payloadFrom(parsed)

  const existing = await findIdByName(sql, name)
  if (existing) {
    await sql`
      UPDATE treasure_maps SET
        name = ${name},
        alt_name = ${payload.altName},
        map_kind = ${payload.mapKind},
        description = ${payload.description},
        category = ${payload.category},
        libraries = ${JSON.stringify(payload.libraries)},
        academic_field = ${payload.academicField},
        destination_city = ${payload.destinationCity},
        destination = ${payload.destination},
        discoveries = ${JSON.stringify(payload.discoveries)},
        skill_reqs = ${JSON.stringify(payload.skillReqs)},
        discovery_exp = ${payload.discoveryExp},
        card_exp = ${payload.cardExp},
        ducat = ${payload.ducat},
        reward_items = ${JSON.stringify(payload.rewardItems)},
        linked_quests = ${JSON.stringify(payload.linkedQuests)},
        walkthrough = ${payload.walkthrough},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    await bumpCatalogStatIfGrew('treasure_maps', existing.enabled)
    return getBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash = await sql`SELECT id FROM treasure_maps WHERE slug = ${attempt} LIMIT 1`
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows = await sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM treasure_maps`
  const id = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM treasure_maps
  `
  const sortOrder = Number(sortRows[0].max_sort) + 1

  await sql`
    INSERT INTO treasure_maps (
      id, slug, name, alt_name, map_kind, description, category, libraries,
      academic_field, destination_city, destination, discoveries, skill_reqs,
      discovery_exp, card_exp, ducat, reward_items, linked_quests, walkthrough,
      enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${payload.altName}, ${payload.mapKind},
      ${payload.description}, ${payload.category}, ${JSON.stringify(payload.libraries)},
      ${payload.academicField}, ${payload.destinationCity}, ${payload.destination},
      ${JSON.stringify(payload.discoveries)}, ${JSON.stringify(payload.skillReqs)},
      ${payload.discoveryExp}, ${payload.cardExp}, ${payload.ducat},
      ${JSON.stringify(payload.rewardItems)}, ${JSON.stringify(payload.linkedQuests)},
      ${payload.walkthrough}, TRUE, ${sortOrder}
    )
  `
  await bumpCatalogStat('treasure_maps', 1)
  return getBySlug(slug)
}
