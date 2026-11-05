import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'
import { parseJobText } from './jobTextParse.mjs'

export async function ensureJobStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/039_jobs.sql')
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
  return asJsonArray(value).map((v) => String(v)).filter(Boolean)
}

function asRequirements(value) {
  return asJsonArray(value)
    .map((row) => ({
      kind: row?.kind == null ? '' : String(row.kind),
      content: row?.content == null ? '' : String(row.content),
    }))
    .filter((row) => row.kind || row.content)
}

function asResearches(value) {
  return asJsonArray(value)
    .map((row) => ({
      name: row?.name == null ? '' : String(row.name),
      major: row?.major == null || row.major === '' ? null : String(row.major),
      skill: row?.skill == null || row.skill === '' ? null : String(row.skill),
    }))
    .filter((row) => row.name)
}

function decorateJob(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    altName: row.alt_name == null ? null : String(row.alt_name),
    description: row.description == null ? null : String(row.description),
    category: row.category == null ? null : String(row.category),
    recommendation:
      row.recommendation == null ? null : String(row.recommendation),
    cost: row.cost == null ? null : String(row.cost),
    preferredSkills: asStringArray(row.preferred_skills),
    requirements: asRequirements(row.requirements),
    researches: asResearches(row.researches),
    updatedAt: row.updated_at
      ? new Date(/** @type {string|Date} */ (row.updated_at)).toISOString()
      : null,
  }
}

export async function listJobs() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM jobs
    WHERE enabled = TRUE
    ORDER BY updated_at DESC NULLS LAST, id DESC
  `
  return rows.map(decorateJob)
}

export async function deleteJob(id) {
  const sql = getSql()
  const jobId = Number(id)
  if (!Number.isFinite(jobId)) throw new Error('잘못된 직업 ID입니다.')
  await sql`
    UPDATE jobs SET enabled = FALSE
    WHERE id = ${jobId} AND enabled = TRUE
  `
  await bumpCatalogStat('jobs', -1)
}

/**
 * @param {string} text
 */
export async function upsertJobFromText(text) {
  const parsed = parseJobText(text)
  const sql = getSql()
  const name = normalizeName(parsed.name)
  const preferredSkills = JSON.stringify(parsed.preferredSkills || [])
  const requirements = JSON.stringify(parsed.requirements || [])
  const researches = JSON.stringify(parsed.researches || [])

  const existing = await sql`
    SELECT id, slug, enabled FROM jobs
    WHERE name = ${name}
    LIMIT 1
  `

  if (existing[0]) {
    const id = Number(existing[0].id)
    await sql`
      UPDATE jobs SET
        slug = ${parsed.slug},
        name = ${name},
        alt_name = ${parsed.altName},
        description = ${parsed.description},
        category = ${parsed.category},
        recommendation = ${parsed.recommendation},
        cost = ${parsed.cost},
        preferred_skills = ${preferredSkills},
        requirements = ${requirements},
        researches = ${researches},
        enabled = TRUE
      WHERE id = ${id}
    `
    if (!existing[0].enabled) await bumpCatalogStat('jobs', 1)
    const rows = await sql`SELECT * FROM jobs WHERE id = ${id} LIMIT 1`
    return { job: decorateJob(rows[0]), created: false }
  }

  const idRows = await sql`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM jobs`
  const id = Number(idRows[0]?.next_id) || 1
  const sortRows =
    await sql`SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_sort FROM jobs`
  const sortOrder = Number(sortRows[0]?.next_sort) || 10

  await sql`
    INSERT INTO jobs (
      id, slug, name, alt_name, description, category, recommendation, cost,
      preferred_skills, requirements, researches, enabled, sort_order
    ) VALUES (
      ${id},
      ${parsed.slug},
      ${name},
      ${parsed.altName},
      ${parsed.description},
      ${parsed.category},
      ${parsed.recommendation},
      ${parsed.cost},
      ${preferredSkills},
      ${requirements},
      ${researches},
      TRUE,
      ${sortOrder}
    )
  `
  await bumpCatalogStatIfGrew('jobs')
  const rows = await sql`SELECT * FROM jobs WHERE id = ${id} LIMIT 1`
  return { job: decorateJob(rows[0]), created: true }
}
