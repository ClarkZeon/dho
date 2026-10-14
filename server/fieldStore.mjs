import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export async function ensureFieldStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/018_fields.sql')
  await runSqlFile('sql/026_field_detail_extra.sql')
}

function normalizeFieldName(name) {
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

function asNullableText(value) {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text : null
}

function asOptionalNumber(value, label = '값') {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error(`${label}이(가) 올바르지 않습니다.`)
  return n
}

function decorateField(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    altName: row.alt_name == null ? null : String(row.alt_name),
    description: row.description == null ? null : String(row.description),
    fieldKind: row.field_kind == null ? null : String(row.field_kind),
    region: row.region == null ? null : String(row.region),
    seaArea: row.sea_area == null ? null : String(row.sea_area),
    coordX: row.coord_x == null ? null : Number(row.coord_x),
    coordY: row.coord_y == null ? null : Number(row.coord_y),
    linkedPlaces: asJsonArray(row.linked_places).map((item) => ({
      kind: String(item?.kind || ''),
      name: String(item?.name || ''),
    })),
    landSurveys: asJsonArray(row.land_surveys),
    resurveyRewards: asJsonArray(row.resurvey_rewards),
    collectItems: asJsonArray(row.collect_items).map((item) => ({
      source: String(item?.source || '기타'),
      name: String(item?.name || ''),
      rank: item?.rank == null || item?.rank === '' ? null : Number(item.rank),
      type: item?.type == null || item?.type === '' ? null : String(item.type),
      recommendSpot:
        item?.recommendSpot == null || item?.recommendSpot === ''
          ? null
          : String(item.recommendSpot),
      canExchange:
        typeof item?.canExchange === 'boolean' ? item.canExchange : null,
      canRelease:
        typeof item?.canRelease === 'boolean' ? item.canRelease : null,
    })),
    destinations: asJsonArray(row.destinations).map((item) => ({
      source: String(item?.source || '보물지도'),
      discovery: String(item?.discovery || ''),
      content: String(item?.content || ''),
    })),
    landNpcs: asJsonArray(row.land_npcs).map((item) => ({
      level: item?.level == null || item?.level === '' ? null : Number(item.level),
      trait: item?.trait == null || item?.trait === '' ? null : String(item.trait),
      names: asJsonArray(item?.names).map(String),
    })),
  }
}

export async function listFields() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM fields WHERE enabled = TRUE ORDER BY sort_order, id
  `
  return rows.map(decorateField)
}

export async function getFieldBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM fields WHERE slug = ${slug} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateField(rows[0]) : null
}

export async function getFieldById(id) {
  const sql = getSql()
  const fieldId = Number(id)
  if (!Number.isFinite(fieldId)) return null
  const rows = await sql`
    SELECT * FROM fields WHERE id = ${fieldId} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateField(rows[0]) : null
}

/**
 * @param {number} id
 * @param {Record<string, unknown>} patch
 */
export async function updateFieldFields(id, patch) {
  const sql = getSql()
  const fieldId = Number(id)
  if (!Number.isFinite(fieldId)) throw new Error('잘못된 필드 ID입니다.')

  const current = await getFieldById(fieldId)
  if (!current) throw new Error('필드를 찾을 수 없습니다.')

  const next = { ...current }

  if ('name' in patch) {
    const name = normalizeFieldName(patch.name)
    if (!name) throw new Error('필드 이름이 필요합니다.')
    next.name = name
  }
  for (const key of [
    'altName',
    'description',
    'fieldKind',
    'region',
    'seaArea',
  ]) {
    if (key in patch) next[key] = asNullableText(patch[key])
  }
  if ('coordX' in patch) next.coordX = asOptionalNumber(patch.coordX, '좌표 X')
  if ('coordY' in patch) next.coordY = asOptionalNumber(patch.coordY, '좌표 Y')
  if ('linkedPlaces' in patch) {
    if (!Array.isArray(patch.linkedPlaces)) {
      throw new Error('연결 장소 형식이 올바르지 않습니다.')
    }
    next.linkedPlaces = patch.linkedPlaces.map((item) => ({
      kind: String(item?.kind || ''),
      name: String(item?.name || ''),
    }))
  }
  if ('landSurveys' in patch) {
    if (!Array.isArray(patch.landSurveys)) {
      throw new Error('육지 조사 형식이 올바르지 않습니다.')
    }
    next.landSurveys = patch.landSurveys
  }
  if ('resurveyRewards' in patch) {
    if (!Array.isArray(patch.resurveyRewards)) {
      throw new Error('재조사 보상 형식이 올바르지 않습니다.')
    }
    next.resurveyRewards = patch.resurveyRewards
  }
  if ('collectItems' in patch) {
    if (!Array.isArray(patch.collectItems)) {
      throw new Error('수집 아이템 형식이 올바르지 않습니다.')
    }
    next.collectItems = patch.collectItems.map((item) => ({
      source: String(item?.source || '기타'),
      name: String(item?.name || ''),
      rank:
        item?.rank == null || item?.rank === '' ? null : Number(item.rank),
      type: item?.type == null || item?.type === '' ? null : String(item.type),
      recommendSpot:
        item?.recommendSpot == null || item?.recommendSpot === ''
          ? null
          : String(item.recommendSpot),
      canExchange:
        typeof item?.canExchange === 'boolean' ? item.canExchange : null,
      canRelease:
        typeof item?.canRelease === 'boolean' ? item.canRelease : null,
    }))
  }
  if ('destinations' in patch) {
    if (!Array.isArray(patch.destinations)) {
      throw new Error('목적지 형식이 올바르지 않습니다.')
    }
    next.destinations = patch.destinations.map((item) => ({
      source: String(item?.source || '보물지도'),
      discovery: String(item?.discovery || ''),
      content: String(item?.content || ''),
    }))
  }
  if ('landNpcs' in patch) {
    if (!Array.isArray(patch.landNpcs)) {
      throw new Error('육상 NPC 형식이 올바르지 않습니다.')
    }
    next.landNpcs = patch.landNpcs.map((item) => ({
      level:
        item?.level == null || item?.level === '' ? null : Number(item.level),
      trait:
        item?.trait == null || item?.trait === '' ? null : String(item.trait),
      names: Array.isArray(item?.names)
        ? item.names.map(String)
        : String(item?.names || '')
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean),
    }))
  }

  const linkedJson = JSON.stringify(next.linkedPlaces || [])
  const surveysJson = JSON.stringify(next.landSurveys || [])
  const rewardsJson = JSON.stringify(next.resurveyRewards || [])
  const collectJson = JSON.stringify(next.collectItems || [])
  const destJson = JSON.stringify(next.destinations || [])
  const npcJson = JSON.stringify(next.landNpcs || [])

  await sql`
    UPDATE fields SET
      name = ${next.name},
      alt_name = ${next.altName},
      description = ${next.description},
      field_kind = ${next.fieldKind},
      region = ${next.region},
      sea_area = ${next.seaArea},
      coord_x = ${next.coordX},
      coord_y = ${next.coordY},
      linked_places = ${linkedJson},
      land_surveys = ${surveysJson},
      resurvey_rewards = ${rewardsJson},
      collect_items = ${collectJson},
      destinations = ${destJson},
      land_npcs = ${npcJson}
    WHERE id = ${fieldId}
  `

  return getFieldById(fieldId)
}

/** @param {number} id */
export async function deleteField(id) {
  const sql = getSql()
  const fieldId = Number(id)
  if (!Number.isFinite(fieldId)) throw new Error('잘못된 필드 ID입니다.')
  const rows = await sql`
    UPDATE fields SET enabled = FALSE
    WHERE id = ${fieldId} AND enabled = TRUE
    RETURNING id
  `
  if (!rows[0]) throw new Error('필드를 찾을 수 없습니다.')
  await bumpCatalogStat('fields', -1)
  return { ok: true }
}

async function findFieldIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug, enabled FROM fields
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

/** 텍스트 파싱 결과로 필드 등록. 동일 이름이면 내용 갱신 */
export async function upsertFieldFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeFieldName(parsed.name)
  if (!name) throw new Error('필드 이름이 없습니다.')

  const existing = await findFieldIdByName(sql, name)
  const surveysJson = JSON.stringify(parsed.landSurveys || [])
  const rewardsJson = JSON.stringify(parsed.resurveyRewards || [])
  const linkedJson = JSON.stringify(parsed.linkedPlaces || [])
  const collectJson = JSON.stringify(parsed.collectItems || [])
  const destJson = JSON.stringify(parsed.destinations || [])
  const npcJson = JSON.stringify(parsed.landNpcs || [])
  const altName = parsed.altName ?? null
  const description = parsed.description ?? null

  if (existing) {
    await sql`
      UPDATE fields SET
        name = ${name},
        alt_name = ${altName},
        description = ${description},
        field_kind = ${parsed.fieldKind},
        region = ${parsed.region},
        sea_area = ${parsed.seaArea},
        coord_x = ${parsed.coordX},
        coord_y = ${parsed.coordY},
        linked_places = ${linkedJson},
        land_surveys = ${surveysJson},
        resurvey_rewards = ${rewardsJson},
        collect_items = ${collectJson},
        destinations = ${destJson},
        land_npcs = ${npcJson},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    await bumpCatalogStatIfGrew('fields', existing.enabled)
    return getFieldBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash = await sql`SELECT id FROM fields WHERE slug = ${attempt} LIMIT 1`
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows = await sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM fields`
  const id = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM fields
  `
  const sortOrder = Number(sortRows[0].max_sort) + 1

  await sql`
    INSERT INTO fields (
      id, slug, name, alt_name, description, field_kind, region, sea_area,
      coord_x, coord_y, linked_places, land_surveys, resurvey_rewards,
      collect_items, destinations, land_npcs,
      enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${altName}, ${description},
      ${parsed.fieldKind}, ${parsed.region},
      ${parsed.seaArea}, ${parsed.coordX}, ${parsed.coordY},
      ${linkedJson}, ${surveysJson}, ${rewardsJson},
      ${collectJson}, ${destJson}, ${npcJson},
      TRUE, ${sortOrder}
    )
  `

  await bumpCatalogStat('fields', 1)
  return getFieldBySlug(slug)
}
