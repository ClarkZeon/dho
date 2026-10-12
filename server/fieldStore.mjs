import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export async function ensureFieldStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/018_fields.sql')
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

function decorateField(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    fieldKind: row.field_kind == null ? null : String(row.field_kind),
    region: row.region == null ? null : String(row.region),
    seaArea: row.sea_area == null ? null : String(row.sea_area),
    coordX: row.coord_x == null ? null : Number(row.coord_x),
    coordY: row.coord_y == null ? null : Number(row.coord_y),
    landSurveys: asJsonArray(row.land_surveys),
    resurveyRewards: asJsonArray(row.resurvey_rewards),
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
 * 육지 조사 필수 여부 등 JSON 부분 갱신
 * @param {number} id
 * @param {{ landSurveys?: unknown }} patch
 */
export async function updateFieldFields(id, patch) {
  const sql = getSql()
  const fieldId = Number(id)
  if (!Number.isFinite(fieldId)) throw new Error('잘못된 필드 ID입니다.')

  const current = await getFieldById(fieldId)
  if (!current) throw new Error('필드를 찾을 수 없습니다.')

  if ('landSurveys' in patch) {
    if (!Array.isArray(patch.landSurveys)) {
      throw new Error('육지 조사 형식이 올바르지 않습니다.')
    }
    const surveysJson = JSON.stringify(patch.landSurveys)
    await sql`
      UPDATE fields SET land_surveys = ${surveysJson} WHERE id = ${fieldId}
    `
  }

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

  if (existing) {
    await sql`
      UPDATE fields SET
        name = ${name},
        field_kind = ${parsed.fieldKind},
        region = ${parsed.region},
        sea_area = ${parsed.seaArea},
        coord_x = ${parsed.coordX},
        coord_y = ${parsed.coordY},
        land_surveys = ${surveysJson},
        resurvey_rewards = ${rewardsJson},
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
      id, slug, name, field_kind, region, sea_area,
      coord_x, coord_y, land_surveys, resurvey_rewards,
      enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${parsed.fieldKind}, ${parsed.region},
      ${parsed.seaArea}, ${parsed.coordX}, ${parsed.coordY},
      ${surveysJson}, ${rewardsJson},
      TRUE, ${sortOrder}
    )
  `

  await bumpCatalogStat('fields', 1)
  return getFieldBySlug(slug)
}
