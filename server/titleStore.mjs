import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export async function ensureTitleStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/036_titles.sql')
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

function decorateTitle(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    altName: row.alt_name == null ? null : String(row.alt_name),
    description: row.description == null ? null : String(row.description),
    effect: row.effect == null ? null : String(row.effect),
    requirement: row.requirement == null ? null : String(row.requirement),
    updatedAt: row.updated_at
      ? new Date(/** @type {string|Date} */ (row.updated_at)).toISOString()
      : null,
  }
}

export async function listTitles() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM titles
    WHERE enabled = TRUE
    ORDER BY updated_at DESC NULLS LAST, id DESC
  `
  return rows.map(decorateTitle)
}

export async function getTitleBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM titles WHERE slug = ${slug} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateTitle(rows[0]) : null
}

export async function getTitleById(id) {
  const sql = getSql()
  const titleId = Number(id)
  if (!Number.isFinite(titleId)) return null
  const rows = await sql`
    SELECT * FROM titles WHERE id = ${titleId} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateTitle(rows[0]) : null
}

/**
 * @param {number} id
 * @param {Record<string, unknown>} patch
 */
export async function updateTitleFields(id, patch) {
  const sql = getSql()
  const titleId = Number(id)
  if (!Number.isFinite(titleId)) throw new Error('잘못된 호칭 ID입니다.')

  const current = await getTitleById(titleId)
  if (!current) throw new Error('호칭을 찾을 수 없습니다.')

  const next = {
    altName: 'altName' in patch ? asNullableText(patch.altName) : current.altName,
    description:
      'description' in patch
        ? asNullableText(patch.description)
        : current.description,
    effect: 'effect' in patch ? asNullableText(patch.effect) : current.effect,
    requirement:
      'requirement' in patch
        ? asNullableText(patch.requirement)
        : current.requirement,
  }

  await sql`
    UPDATE titles SET
      alt_name = ${next.altName},
      description = ${next.description},
      effect = ${next.effect},
      requirement = ${next.requirement}
    WHERE id = ${titleId}
  `
  return getTitleById(titleId)
}

/** @param {number} id */
export async function deleteTitle(id) {
  const sql = getSql()
  const titleId = Number(id)
  if (!Number.isFinite(titleId)) throw new Error('잘못된 호칭 ID입니다.')
  const rows = await sql`
    UPDATE titles SET enabled = FALSE
    WHERE id = ${titleId} AND enabled = TRUE
    RETURNING id
  `
  if (!rows[0]) throw new Error('호칭을 찾을 수 없습니다.')
  await bumpCatalogStat('titles', -1)
  return { ok: true }
}

async function findIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug, enabled FROM titles
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

export async function upsertTitleFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeName(parsed.name)
  if (!name) throw new Error('호칭 이름이 없습니다.')

  const payload = {
    altName: asNullableText(parsed.altName),
    description: asNullableText(parsed.description),
    effect: asNullableText(parsed.effect),
    requirement: asNullableText(parsed.requirement),
  }

  const existing = await findIdByName(sql, name)
  if (existing) {
    await sql`
      UPDATE titles SET
        name = ${name},
        alt_name = ${payload.altName},
        description = ${payload.description},
        effect = ${payload.effect},
        requirement = ${payload.requirement},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    await bumpCatalogStatIfGrew('titles', existing.enabled)
    return getTitleBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash = await sql`
      SELECT id FROM titles WHERE slug = ${attempt} LIMIT 1
    `
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows = await sql`
    SELECT COALESCE(MAX(id), 0) AS max_id FROM titles
  `
  const id = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM titles
  `
  const sortOrder = Number(sortRows[0].max_sort) + 1

  await sql`
    INSERT INTO titles (
      id, slug, name, alt_name, description, effect, requirement,
      enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${payload.altName}, ${payload.description},
      ${payload.effect}, ${payload.requirement}, TRUE, ${sortOrder}
    )
  `

  await bumpCatalogStat('titles', 1)
  return getTitleBySlug(slug)
}
