import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'
import { parseRefineText } from './refineTextParse.mjs'

export async function ensureRefineStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/044_refines.sql')
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

function asStringArray(value) {
  return asJsonArray(value)
    .map((v) => String(v))
    .filter(Boolean)
}

function decorateRefine(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    actionPower: row.action_power == null ? null : String(row.action_power),
    skills: asStringArray(row.skills),
    updatedAt: row.updated_at
      ? new Date(/** @type {string|Date} */ (row.updated_at)).toISOString()
      : null,
  }
}

export async function listRefines() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM refines
    WHERE enabled = TRUE
    ORDER BY updated_at DESC NULLS LAST, id DESC
  `
  return rows.map(decorateRefine)
}

export async function deleteRefine(id) {
  const sql = getSql()
  const refineId = Number(id)
  if (!Number.isFinite(refineId)) throw new Error('잘못된 연성 ID입니다.')
  await sql`
    UPDATE refines SET enabled = FALSE
    WHERE id = ${refineId} AND enabled = TRUE
  `
  await bumpCatalogStat('refines', -1)
}

/**
 * @param {string} text
 */
export async function upsertRefineFromText(text) {
  const parsed = parseRefineText(text)
  const sql = getSql()
  const name = normalizeName(parsed.name)
  const skillsJson = JSON.stringify(parsed.skills || [])

  const existing = await sql`
    SELECT id, slug, enabled FROM refines
    WHERE name = ${name}
    LIMIT 1
  `

  if (existing[0]) {
    const id = Number(existing[0].id)
    await sql`
      UPDATE refines SET
        slug = ${parsed.slug},
        name = ${name},
        description = ${parsed.description},
        action_power = ${parsed.actionPower},
        skills = ${skillsJson},
        enabled = TRUE,
        updated_at = NOW()
      WHERE id = ${id}
    `
    if (!existing[0].enabled) await bumpCatalogStat('refines', 1)
    const rows = await sql`SELECT * FROM refines WHERE id = ${id} LIMIT 1`
    return { refine: decorateRefine(rows[0]), created: false }
  }

  const idRows =
    await sql`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM refines`
  const id = Number(idRows[0]?.next_id) || 1
  const sortRows =
    await sql`SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_sort FROM refines`
  const sortOrder = Number(sortRows[0]?.next_sort) || 10

  await sql`
    INSERT INTO refines (
      id, slug, name, description, action_power, skills, enabled, sort_order
    ) VALUES (
      ${id},
      ${parsed.slug},
      ${name},
      ${parsed.description},
      ${parsed.actionPower},
      ${skillsJson},
      TRUE,
      ${sortOrder}
    )
  `
  await bumpCatalogStatIfGrew('refines')
  const rows = await sql`SELECT * FROM refines WHERE id = ${id} LIMIT 1`
  return { refine: decorateRefine(rows[0]), created: true }
}
