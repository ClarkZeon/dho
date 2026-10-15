import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export async function ensureRegionStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/028_regions.sql')
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

function asNullableText(value) {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text : null
}

function normalizeSeaGroups(list) {
  if (!Array.isArray(list)) throw new Error('해역 그룹 형식이 올바르지 않습니다.')
  return list.map((item) => {
    const group = String(item?.group || '').trim()
    let seaAreas = []
    if (Array.isArray(item?.seaAreas)) {
      seaAreas = item.seaAreas.map((s) => String(s || '').trim()).filter(Boolean)
    } else if (typeof item?.seaAreas === 'string') {
      seaAreas = String(item.seaAreas)
        .split(/[,\uFF0C]/)
        .map((s) => s.trim())
        .filter(Boolean)
    } else if (typeof item?.seas === 'string') {
      seaAreas = String(item.seas)
        .split(/[,\uFF0C]/)
        .map((s) => s.trim())
        .filter(Boolean)
    }
    return { group, seaAreas }
  })
}

function decorateRegion(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    altName: row.alt_name == null ? null : String(row.alt_name),
    description: row.description == null ? null : String(row.description),
    seaGroups: normalizeSeaGroups(asJsonArray(row.sea_groups)),
    updatedAt: row.updated_at
      ? new Date(/** @type {string|Date} */ (row.updated_at)).toISOString()
      : null,
  }
}

export async function listRegions() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM regions
    WHERE enabled = TRUE
    ORDER BY updated_at DESC NULLS LAST, id DESC
  `
  return rows.map(decorateRegion)
}

export async function getRegionBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM regions WHERE slug = ${slug} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateRegion(rows[0]) : null
}

export async function getRegionById(id) {
  const sql = getSql()
  const regionId = Number(id)
  if (!Number.isFinite(regionId)) return null
  const rows = await sql`
    SELECT * FROM regions WHERE id = ${regionId} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateRegion(rows[0]) : null
}

/** @param {number} id */
export async function updateRegionFields(id, patch) {
  const sql = getSql()
  const regionId = Number(id)
  if (!Number.isFinite(regionId)) throw new Error('잘못된 지역 ID입니다.')

  const current = await getRegionById(regionId)
  if (!current) throw new Error('지역을 찾을 수 없습니다.')

  const next = { ...current }
  if ('name' in patch) {
    const name = normalizeName(patch.name)
    if (!name) throw new Error('지역 이름이 필요합니다.')
    next.name = name
  }
  if ('altName' in patch) next.altName = asNullableText(patch.altName)
  if ('description' in patch) next.description = asNullableText(patch.description)
  if ('seaGroups' in patch) next.seaGroups = normalizeSeaGroups(patch.seaGroups)

  const seaJson = JSON.stringify(next.seaGroups || [])
  await sql`
    UPDATE regions SET
      name = ${next.name},
      alt_name = ${next.altName},
      description = ${next.description},
      sea_groups = ${seaJson}
    WHERE id = ${regionId}
  `
  return getRegionById(regionId)
}

/** @param {number} id */
export async function deleteRegion(id) {
  const sql = getSql()
  const regionId = Number(id)
  if (!Number.isFinite(regionId)) throw new Error('잘못된 지역 ID입니다.')
  const rows = await sql`
    UPDATE regions SET enabled = FALSE
    WHERE id = ${regionId} AND enabled = TRUE
    RETURNING id
  `
  if (!rows[0]) throw new Error('지역을 찾을 수 없습니다.')
  await bumpCatalogStat('regions', -1)
  return { ok: true }
}

async function findRegionIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug, enabled FROM regions
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

/** 텍스트 파싱 결과로 지역 등록. 동일 이름이면 내용 갱신 */
export async function upsertRegionFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeName(parsed.name)
  if (!name) throw new Error('지역 이름이 없습니다.')

  const existing = await findRegionIdByName(sql, name)
  const seaJson = JSON.stringify(normalizeSeaGroups(parsed.seaGroups || []))

  if (existing) {
    await sql`
      UPDATE regions SET
        name = ${name},
        alt_name = ${parsed.altName ?? null},
        description = ${parsed.description},
        sea_groups = ${seaJson},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    await bumpCatalogStatIfGrew('regions', existing.enabled)
    return getRegionBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash = await sql`SELECT id FROM regions WHERE slug = ${attempt} LIMIT 1`
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows = await sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM regions`
  const id = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM regions
  `
  const sortOrder = Number(sortRows[0].max_sort) + 1

  await sql`
    INSERT INTO regions (
      id, slug, name, alt_name, description, sea_groups, enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${parsed.altName ?? null}, ${parsed.description},
      ${seaJson}, TRUE, ${sortOrder}
    )
  `

  await bumpCatalogStat('regions', 1)
  return getRegionBySlug(slug)
}
