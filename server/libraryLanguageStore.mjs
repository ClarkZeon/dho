import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export async function ensureLibraryLanguageStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/012_library_languages.sql')
  await runSqlFile('sql/014_library_language_detail.sql')
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

function decorateLanguage(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    category: row.category == null ? null : String(row.category),
    rangeScope: row.range_scope == null ? null : String(row.range_scope),
    actionPower: row.action_power == null ? null : String(row.action_power),
    autoEffect: row.auto_effect == null ? null : String(row.auto_effect),
    learnCost: row.learn_cost == null ? null : Number(row.learn_cost),
    prerequisite:
      row.prerequisite == null ? null : String(row.prerequisite),
    learnPlaces: asJsonArray(row.learn_places).map((item) => ({
      region: String(item?.region || ''),
      city: String(item?.city || ''),
      npc: item?.npc == null || item?.npc === '' ? null : String(item.npc),
    })),
    useCities: asJsonArray(row.use_cities).map((item) => ({
      region: String(item?.region || ''),
      city: String(item?.city || ''),
    })),
  }
}

export async function listLibraryLanguages() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM library_languages
    WHERE enabled = TRUE
    ORDER BY sort_order, id
  `
  return rows.map(decorateLanguage)
}

export async function getLibraryLanguageBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM library_languages
    WHERE slug = ${slug} AND enabled = TRUE
    LIMIT 1
  `
  return rows[0] ? decorateLanguage(rows[0]) : null
}

async function findIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug FROM library_languages
    WHERE TRIM(BOTH FROM regexp_replace(name, '\\s+', ' ', 'g')) = ${name}
    LIMIT 1
  `
  return dup[0]
    ? { id: Number(dup[0].id), slug: String(dup[0].slug) }
    : null
}

export async function upsertLibraryLanguageFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeName(parsed.name)
  if (!name) throw new Error('언어 이름이 없습니다.')

  const learnPlacesJson = JSON.stringify(parsed.learnPlaces || [])
  const useCitiesJson = JSON.stringify(parsed.useCities || [])
  const existing = await findIdByName(sql, name)

  if (existing) {
    await sql`
      UPDATE library_languages SET
        name = ${name},
        description = ${parsed.description ?? null},
        category = ${parsed.category ?? null},
        range_scope = ${parsed.rangeScope ?? null},
        action_power = ${parsed.actionPower ?? null},
        auto_effect = ${parsed.autoEffect ?? null},
        learn_cost = ${parsed.learnCost ?? null},
        prerequisite = ${parsed.prerequisite ?? null},
        learn_places = ${learnPlacesJson},
        use_cities = ${useCitiesJson},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    return getLibraryLanguageBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash =
      await sql`SELECT id FROM library_languages WHERE slug = ${attempt} LIMIT 1`
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows =
    await sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM library_languages`
  const id = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM library_languages
  `
  const sortOrder = Number(sortRows[0].max_sort) + 10

  await sql`
    INSERT INTO library_languages (
      id, slug, name, description, category, range_scope,
      action_power, auto_effect, learn_cost, prerequisite,
      learn_places, use_cities, enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${parsed.description ?? null},
      ${parsed.category ?? null}, ${parsed.rangeScope ?? null},
      ${parsed.actionPower ?? null}, ${parsed.autoEffect ?? null},
      ${parsed.learnCost ?? null}, ${parsed.prerequisite ?? null},
      ${learnPlacesJson}, ${useCitiesJson}, TRUE, ${sortOrder}
    )
  `

  return getLibraryLanguageBySlug(slug)
}
