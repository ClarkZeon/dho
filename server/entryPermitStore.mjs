import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export async function ensureEntryPermitStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/030_entry_permits.sql')
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

function normalizeFame(list) {
  if (!Array.isArray(list)) throw new Error('명성 형식이 올바르지 않습니다.')
  return list.map((item) => ({
    nationality: asNullableText(item?.nationality),
    general: asNullableText(item?.general),
    countryEvent: asNullableText(item?.countryEvent),
  }))
}

function normalizeCityQuests(list) {
  if (!Array.isArray(list)) {
    throw new Error('퀘스트(택일) 형식이 올바르지 않습니다.')
  }
  return list.map((cityBlock) => ({
    city: String(cityBlock?.city || ''),
    quests: Array.isArray(cityBlock?.quests)
      ? cityBlock.quests.map((q) => ({
          kind: String(q?.kind || ''),
          difficulty:
            q?.difficulty == null || q?.difficulty === ''
              ? null
              : Number(q.difficulty),
          name: String(q?.name || ''),
        }))
      : [],
  }))
}

function decorateEntryPermit(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    altName: row.alt_name == null ? null : String(row.alt_name),
    description: row.description == null ? null : String(row.description),
    requirement: row.requirement == null ? null : String(row.requirement),
    fame: normalizeFame(asJsonArray(row.fame)),
    cityQuests: normalizeCityQuests(asJsonArray(row.city_quests)),
  }
}

export async function listEntryPermits() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM entry_permits WHERE enabled = TRUE ORDER BY sort_order, id
  `
  return rows.map(decorateEntryPermit)
}

export async function getEntryPermitBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM entry_permits WHERE slug = ${slug} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateEntryPermit(rows[0]) : null
}

export async function getEntryPermitById(id) {
  const sql = getSql()
  const permitId = Number(id)
  if (!Number.isFinite(permitId)) return null
  const rows = await sql`
    SELECT * FROM entry_permits WHERE id = ${permitId} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateEntryPermit(rows[0]) : null
}

/** @param {number} id */
export async function updateEntryPermitFields(id, patch) {
  const sql = getSql()
  const permitId = Number(id)
  if (!Number.isFinite(permitId)) throw new Error('잘못된 입항허가 ID입니다.')

  const current = await getEntryPermitById(permitId)
  if (!current) throw new Error('입항허가를 찾을 수 없습니다.')

  const next = { ...current }
  if ('name' in patch) {
    const name = normalizeName(patch.name)
    if (!name) throw new Error('입항허가 이름이 필요합니다.')
    next.name = name
  }
  if ('altName' in patch) next.altName = asNullableText(patch.altName)
  if ('description' in patch) next.description = asNullableText(patch.description)
  if ('requirement' in patch) next.requirement = asNullableText(patch.requirement)
  if ('fame' in patch) next.fame = normalizeFame(patch.fame)
  if ('cityQuests' in patch) next.cityQuests = normalizeCityQuests(patch.cityQuests)

  const fameJson = JSON.stringify(next.fame || [])
  const cityJson = JSON.stringify(next.cityQuests || [])
  await sql`
    UPDATE entry_permits SET
      name = ${next.name},
      alt_name = ${next.altName},
      description = ${next.description},
      requirement = ${next.requirement},
      fame = ${fameJson},
      city_quests = ${cityJson}
    WHERE id = ${permitId}
  `
  return getEntryPermitById(permitId)
}

/** @param {number} id */
export async function deleteEntryPermit(id) {
  const sql = getSql()
  const permitId = Number(id)
  if (!Number.isFinite(permitId)) throw new Error('잘못된 입항허가 ID입니다.')
  const rows = await sql`
    UPDATE entry_permits SET enabled = FALSE
    WHERE id = ${permitId} AND enabled = TRUE
    RETURNING id
  `
  if (!rows[0]) throw new Error('입항허가를 찾을 수 없습니다.')
  await bumpCatalogStat('entry_permits', -1)
  return { ok: true }
}

async function findByName(sql, name) {
  const dup = await sql`
    SELECT id, slug, enabled FROM entry_permits
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

export async function upsertEntryPermitFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeName(parsed.name)
  if (!name) throw new Error('입항허가 이름이 없습니다.')

  const existing = await findByName(sql, name)
  const fameJson = JSON.stringify(normalizeFame(parsed.fame || []))
  const cityJson = JSON.stringify(normalizeCityQuests(parsed.cityQuests || []))

  if (existing) {
    await sql`
      UPDATE entry_permits SET
        name = ${name},
        alt_name = ${parsed.altName ?? null},
        description = ${parsed.description},
        requirement = ${parsed.requirement ?? null},
        fame = ${fameJson},
        city_quests = ${cityJson},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    await bumpCatalogStatIfGrew('entry_permits', existing.enabled)
    return getEntryPermitBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash =
      await sql`SELECT id FROM entry_permits WHERE slug = ${attempt} LIMIT 1`
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows =
    await sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM entry_permits`
  const id = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM entry_permits
  `
  const sortOrder = Number(sortRows[0].max_sort) + 1

  await sql`
    INSERT INTO entry_permits (
      id, slug, name, alt_name, description, requirement,
      fame, city_quests, enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${parsed.altName ?? null}, ${parsed.description},
      ${parsed.requirement ?? null}, ${fameJson}, ${cityJson}, TRUE, ${sortOrder}
    )
  `

  await bumpCatalogStat('entry_permits', 1)
  return getEntryPermitBySlug(slug)
}
