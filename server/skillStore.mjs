import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

/** 레거시 library_languages → skills (Neon runSqlFile 은 DO $$ 미지원) */
async function migrateLibraryLanguagesToSkills() {
  const sql = getSql()
  const rows = await sql`
    SELECT
      to_regclass('public.library_languages') AS old_tbl,
      to_regclass('public.skills') AS new_tbl
  `
  if (rows[0]?.old_tbl && !rows[0]?.new_tbl) {
    await sql.query('ALTER TABLE library_languages RENAME TO skills', [])
  }
  try {
    await sql.query(
      'ALTER INDEX IF EXISTS idx_library_languages_enabled_sort RENAME TO idx_skills_enabled_sort',
      [],
    )
  } catch {
    // ignore
  }
  try {
    await sql.query(
      'ALTER INDEX IF EXISTS idx_library_languages_name RENAME TO idx_skills_name',
      [],
    )
  } catch {
    // ignore
  }
}

export async function ensureSkillStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await migrateLibraryLanguagesToSkills()
  await runSqlFile('sql/012_skills.sql')
  await runSqlFile('sql/014_skill_detail.sql')
  await runSqlFile('sql/020_skill_category_default.sql')
  await runSqlFile('sql/021_skill_extra_fields.sql')
  await runSqlFile('sql/022_rename_library_languages_to_skills.sql')
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

function decorateSkill(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    category: row.category == null ? null : String(row.category),
    officerDuty:
      row.officer_duty == null ? null : String(row.officer_duty),
    rangeScope: row.range_scope == null ? null : String(row.range_scope),
    actionPower: row.action_power == null ? null : String(row.action_power),
    autoEffect: row.auto_effect == null ? null : String(row.auto_effect),
    refineEffect:
      row.refine_effect == null ? null : String(row.refine_effect),
    learnCost: row.learn_cost == null ? null : Number(row.learn_cost),
    prerequisite:
      row.prerequisite == null ? null : String(row.prerequisite),
    preferredJobs: asJsonArray(row.preferred_jobs).map(String),
    acquireConditions: asJsonArray(row.acquire_conditions).map((item) => ({
      kind: String(item?.kind || ''),
      content: String(item?.content || ''),
    })),
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

export async function listSkills() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM skills
    WHERE enabled = TRUE
    ORDER BY sort_order, id
  `
  return rows.map(decorateSkill)
}

export async function getSkillBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM skills
    WHERE slug = ${slug} AND enabled = TRUE
    LIMIT 1
  `
  return rows[0] ? decorateSkill(rows[0]) : null
}

export async function getSkillById(id) {
  const sql = getSql()
  const skillId = Number(id)
  if (!Number.isFinite(skillId)) return null
  const rows = await sql`
    SELECT * FROM skills
    WHERE id = ${skillId} AND enabled = TRUE
    LIMIT 1
  `
  return rows[0] ? decorateSkill(rows[0]) : null
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
export async function updateSkillFields(id, patch) {
  const sql = getSql()
  const skillId = Number(id)
  if (!Number.isFinite(skillId)) throw new Error('잘못된 스킬 ID입니다.')

  const current = await getSkillById(skillId)
  if (!current) throw new Error('스킬을 찾을 수 없습니다.')

  const next = { ...current }
  if ('name' in patch) {
    const name = normalizeName(patch.name)
    if (!name) throw new Error('스킬 이름이 필요합니다.')
    next.name = name
  }
  for (const key of [
    'description',
    'category',
    'officerDuty',
    'rangeScope',
    'actionPower',
    'autoEffect',
    'refineEffect',
    'prerequisite',
  ]) {
    if (key in patch) next[key] = asNullableText(patch[key])
  }
  if ('learnCost' in patch) next.learnCost = asOptionalNumber(patch.learnCost)
  if ('preferredJobs' in patch) {
    if (!Array.isArray(patch.preferredJobs)) {
      throw new Error('우대 직업 형식이 올바르지 않습니다.')
    }
    next.preferredJobs = patch.preferredJobs.map(String).filter(Boolean)
  }
  if ('acquireConditions' in patch) {
    if (!Array.isArray(patch.acquireConditions)) {
      throw new Error('습득 조건 형식이 올바르지 않습니다.')
    }
    next.acquireConditions = patch.acquireConditions.map((item) => ({
      kind: String(item?.kind || ''),
      content: String(item?.content || ''),
    }))
  }
  if ('learnPlaces' in patch) {
    if (!Array.isArray(patch.learnPlaces)) {
      throw new Error('습득 장소 형식이 올바르지 않습니다.')
    }
    next.learnPlaces = patch.learnPlaces.map((item) => ({
      region: String(item?.region || ''),
      city: String(item?.city || ''),
      npc:
        item?.npc == null || item?.npc === '' ? null : String(item.npc),
    }))
  }
  if ('useCities' in patch) {
    if (!Array.isArray(patch.useCities)) {
      throw new Error('사용 도시 형식이 올바르지 않습니다.')
    }
    next.useCities = patch.useCities.map((item) => ({
      region: String(item?.region || ''),
      city: String(item?.city || ''),
    }))
  }

  await sql`
    UPDATE skills SET
      name = ${next.name},
      description = ${next.description},
      category = ${next.category},
      officer_duty = ${next.officerDuty},
      range_scope = ${next.rangeScope},
      action_power = ${next.actionPower},
      auto_effect = ${next.autoEffect},
      refine_effect = ${next.refineEffect},
      learn_cost = ${next.learnCost},
      prerequisite = ${next.prerequisite},
      preferred_jobs = ${JSON.stringify(next.preferredJobs)},
      acquire_conditions = ${JSON.stringify(next.acquireConditions)},
      learn_places = ${JSON.stringify(next.learnPlaces)},
      use_cities = ${JSON.stringify(next.useCities)}
    WHERE id = ${skillId}
  `
  return getSkillById(skillId)
}

/** @param {number} id */
export async function deleteSkill(id) {
  const sql = getSql()
  const skillId = Number(id)
  if (!Number.isFinite(skillId)) throw new Error('잘못된 스킬 ID입니다.')
  const rows = await sql`
    UPDATE skills SET enabled = FALSE
    WHERE id = ${skillId} AND enabled = TRUE
    RETURNING id
  `
  if (!rows[0]) throw new Error('스킬을 찾을 수 없습니다.')
  await bumpCatalogStat('skills', -1)
  return { ok: true }
}

async function findIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug, enabled FROM skills
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

export async function upsertSkillFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeName(parsed.name)
  if (!name) throw new Error('스킬 이름이 없습니다.')
  const category =
    String(parsed.category || '')
      .trim()
      .replace(/\s+/g, ' ') || '언어'

  const learnPlacesJson = JSON.stringify(parsed.learnPlaces || [])
  const useCitiesJson = JSON.stringify(parsed.useCities || [])
  const preferredJobsJson = JSON.stringify(parsed.preferredJobs || [])
  const acquireConditionsJson = JSON.stringify(parsed.acquireConditions || [])
  const existing = await findIdByName(sql, name)

  if (existing) {
    await sql`
      UPDATE skills SET
        name = ${name},
        description = ${parsed.description ?? null},
        category = ${category},
        officer_duty = ${parsed.officerDuty ?? null},
        range_scope = ${parsed.rangeScope ?? null},
        action_power = ${parsed.actionPower ?? null},
        auto_effect = ${parsed.autoEffect ?? null},
        refine_effect = ${parsed.refineEffect ?? null},
        learn_cost = ${parsed.learnCost ?? null},
        prerequisite = ${parsed.prerequisite ?? null},
        preferred_jobs = ${preferredJobsJson},
        acquire_conditions = ${acquireConditionsJson},
        learn_places = ${learnPlacesJson},
        use_cities = ${useCitiesJson},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    await bumpCatalogStatIfGrew('skills', existing.enabled)
    return getSkillBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash =
      await sql`SELECT id FROM skills WHERE slug = ${attempt} LIMIT 1`
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows =
    await sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM skills`
  const id = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM skills
  `
  const sortOrder = Number(sortRows[0].max_sort) + 10

  await sql`
    INSERT INTO skills (
      id, slug, name, description, category, officer_duty, range_scope,
      action_power, auto_effect, refine_effect, learn_cost, prerequisite,
      preferred_jobs, acquire_conditions,
      learn_places, use_cities, enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${parsed.description ?? null},
      ${category}, ${parsed.officerDuty ?? null}, ${parsed.rangeScope ?? null},
      ${parsed.actionPower ?? null}, ${parsed.autoEffect ?? null},
      ${parsed.refineEffect ?? null},
      ${parsed.learnCost ?? null}, ${parsed.prerequisite ?? null},
      ${preferredJobsJson}, ${acquireConditionsJson},
      ${learnPlacesJson}, ${useCitiesJson}, TRUE, ${sortOrder}
    )
  `

  await bumpCatalogStat('skills', 1)
  return getSkillBySlug(slug)
}
