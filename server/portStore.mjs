import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export async function ensurePortStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/009_ports.sql')
}

function normalizePortName(name) {
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

function decoratePort(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    category: row.category == null ? null : String(row.category),
    region: row.region == null ? null : String(row.region),
    seaArea: row.sea_area == null ? null : String(row.sea_area),
    coordX: row.coord_x == null ? null : Number(row.coord_x),
    coordY: row.coord_y == null ? null : Number(row.coord_y),
    entryPermit: row.entry_permit == null ? null : String(row.entry_permit),
    culture: row.culture == null ? null : String(row.culture),
    language: row.language == null ? null : String(row.language),
    rewards: asJsonArray(row.rewards),
    collectItems: asJsonArray(row.collect_items),
  }
}

export async function listPorts() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM ports WHERE enabled = TRUE ORDER BY sort_order, id
  `
  return rows.map(decoratePort)
}

export async function getPortBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM ports WHERE slug = ${slug} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decoratePort(rows[0]) : null
}

export async function getPortById(id) {
  const sql = getSql()
  const portId = Number(id)
  if (!Number.isFinite(portId)) return null
  const rows = await sql`
    SELECT * FROM ports WHERE id = ${portId} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decoratePort(rows[0]) : null
}

function asNullableText(value) {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text : null
}

function asOptionalNumber(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error('숫자 값이 올바르지 않습니다.')
  return n
}

/** @param {number} id */
export async function updatePortFields(id, patch) {
  const sql = getSql()
  const portId = Number(id)
  if (!Number.isFinite(portId)) throw new Error('잘못된 항구 ID입니다.')

  const current = await getPortById(portId)
  if (!current) throw new Error('항구(도시)를 찾을 수 없습니다.')

  const next = { ...current }
  if ('name' in patch) {
    const name = normalizePortName(patch.name)
    if (!name) throw new Error('항구(도시) 이름이 필요합니다.')
    next.name = name
  }
  for (const key of [
    'description',
    'category',
    'region',
    'seaArea',
    'entryPermit',
    'culture',
    'language',
  ]) {
    if (key in patch) next[key] = asNullableText(patch[key])
  }
  if ('coordX' in patch) next.coordX = asOptionalNumber(patch.coordX)
  if ('coordY' in patch) next.coordY = asOptionalNumber(patch.coordY)
  if ('rewards' in patch) {
    if (!Array.isArray(patch.rewards)) throw new Error('보상 형식이 올바르지 않습니다.')
    next.rewards = patch.rewards.map((item) => ({
      kind: String(item?.kind || ''),
      amount: String(item?.amount || ''),
      reward: String(item?.reward || ''),
    }))
  }
  if ('collectItems' in patch) {
    if (!Array.isArray(patch.collectItems)) {
      throw new Error('수집 아이템 형식이 올바르지 않습니다.')
    }
    next.collectItems = patch.collectItems.map((item) => ({
      source: String(item?.source || '기타'),
      rank:
        item?.rank == null || item?.rank === ''
          ? null
          : Number(item.rank),
      type: item?.type == null || item?.type === '' ? null : String(item.type),
      items: String(item?.items || ''),
    }))
  }

  const rewardsJson = JSON.stringify(next.rewards || [])
  const collectJson = JSON.stringify(next.collectItems || [])
  await sql`
    UPDATE ports SET
      name = ${next.name},
      description = ${next.description},
      category = ${next.category},
      region = ${next.region},
      sea_area = ${next.seaArea},
      coord_x = ${next.coordX},
      coord_y = ${next.coordY},
      entry_permit = ${next.entryPermit},
      culture = ${next.culture},
      language = ${next.language},
      rewards = ${rewardsJson},
      collect_items = ${collectJson}
    WHERE id = ${portId}
  `
  return getPortById(portId)
}

/** @param {number} id */
export async function deletePort(id) {
  const sql = getSql()
  const portId = Number(id)
  if (!Number.isFinite(portId)) throw new Error('잘못된 항구 ID입니다.')
  const rows = await sql`
    UPDATE ports SET enabled = FALSE
    WHERE id = ${portId} AND enabled = TRUE
    RETURNING id
  `
  if (!rows[0]) throw new Error('항구(도시)를 찾을 수 없습니다.')
  await bumpCatalogStat('ports', -1)
  return { ok: true }
}

async function findPortIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug, enabled FROM ports
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

/** 텍스트 파싱 결과로 항구 등록. 동일 이름이면 내용 갱신 */
export async function upsertPortFromParsed(parsed) {
  const sql = getSql()
  const name = normalizePortName(parsed.name)
  if (!name) throw new Error('항구(도시) 이름이 없습니다.')

  const existing = await findPortIdByName(sql, name)
  const rewardsJson = JSON.stringify(parsed.rewards || [])
  const collectJson = JSON.stringify(parsed.collectItems || [])

  if (existing) {
    await sql`
      UPDATE ports SET
        name = ${name},
        description = ${parsed.description},
        category = ${parsed.category},
        region = ${parsed.region},
        sea_area = ${parsed.seaArea},
        coord_x = ${parsed.coordX},
        coord_y = ${parsed.coordY},
        entry_permit = ${parsed.entryPermit},
        culture = ${parsed.culture},
        language = ${parsed.language},
        rewards = ${rewardsJson},
        collect_items = ${collectJson},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    await bumpCatalogStatIfGrew('ports', existing.enabled)
    return getPortBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash = await sql`SELECT id FROM ports WHERE slug = ${attempt} LIMIT 1`
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows = await sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM ports`
  const id = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM ports
  `
  const sortOrder = Number(sortRows[0].max_sort) + 1

  await sql`
    INSERT INTO ports (
      id, slug, name, description, category, region, sea_area,
      coord_x, coord_y, entry_permit, culture, language,
      rewards, collect_items, enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${parsed.description},
      ${parsed.category}, ${parsed.region}, ${parsed.seaArea},
      ${parsed.coordX}, ${parsed.coordY}, ${parsed.entryPermit},
      ${parsed.culture}, ${parsed.language},
      ${rewardsJson}, ${collectJson},
      TRUE, ${sortOrder}
    )
  `

  await bumpCatalogStat('ports', 1)
  return getPortBySlug(slug)
}
