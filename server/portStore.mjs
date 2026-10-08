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

async function findPortIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug FROM ports
    WHERE TRIM(BOTH FROM regexp_replace(name, '\\s+', ' ', 'g')) = ${name}
    LIMIT 1
  `
  return dup[0]
    ? { id: Number(dup[0].id), slug: String(dup[0].slug) }
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

  return getPortBySlug(slug)
}
