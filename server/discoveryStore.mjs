import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'
import {
  extractQuestNameFromRef,
  resolveDiscoveryCategory,
} from './discoveryTextParse.mjs'

export async function ensureDiscoveryStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/010_discoveries.sql')
  await runSqlFile('sql/011_discovery_categories.sql')
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

function asJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : null
    } catch {
      return null
    }
  }
  return null
}

function decorateDebateCombo(raw) {
  const obj = asJsonObject(raw)
  if (!obj) return null
  return {
    effect: obj.effect == null ? null : String(obj.effect),
    comboName: obj.comboName == null ? null : String(obj.comboName),
    cards: asJsonArray(obj.cards).map(String),
  }
}

function decorateDiscovery(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    category: row.category == null ? null : String(row.category),
    categoryGroup:
      row.category_group == null ? null : String(row.category_group),
    categoryId:
      row.category_id == null ? null : Number(row.category_id),
    rank: row.rank == null ? null : Number(row.rank),
    cardPoints: row.card_points == null ? null : Number(row.card_points),
    discoveryExp:
      row.discovery_exp == null ? null : Number(row.discovery_exp),
    cardExp: row.card_exp == null ? null : Number(row.card_exp),
    reportFame: row.report_fame == null ? null : Number(row.report_fame),
    skills: asJsonArray(row.skills),
    acquireType: row.acquire_type == null ? null : String(row.acquire_type),
    acquireName: row.acquire_name == null ? null : String(row.acquire_name),
    place: row.place == null ? null : String(row.place),
    linkedQuests: asJsonArray(row.linked_quests).map((item) => {
      if (typeof item === 'string') {
        return { tag: null, title: item, raw: item, quest: null }
      }
      return {
        tag: item?.tag == null ? null : String(item.tag),
        title: item?.title == null ? String(item?.raw || '') : String(item.title),
        raw: item?.raw == null ? String(item?.title || '') : String(item.raw),
        quest: null,
      }
    }),
    debateCombo: decorateDebateCombo(row.debate_combo),
    acquireQuest: null,
  }
}

async function loadQuestNameIndex() {
  const sql = getSql()
  const rows = await sql`
    SELECT id, slug, name FROM quests WHERE enabled = TRUE
  `
  /** @type {Map<string, { id: number, slug: string, name: string }>} */
  const map = new Map()
  for (const row of rows) {
    const key = normalizeName(row.name)
    if (!key) continue
    map.set(key, {
      id: Number(row.id),
      slug: String(row.slug),
      name: String(row.name),
    })
  }
  return map
}

function lookupQuestRef(index, text) {
  const name = extractQuestNameFromRef(text)
  if (!name) return null
  return index.get(normalizeName(name)) || null
}

async function withQuestLinks(discovery) {
  const index = await loadQuestNameIndex()
  const acquireQuest =
    discovery.acquireType === '퀘스트'
      ? lookupQuestRef(index, discovery.acquireName)
      : null
  return {
    ...discovery,
    acquireQuest,
    linkedQuests: discovery.linkedQuests.map((item) => ({
      ...item,
      quest:
        !item.tag || item.tag === '퀘스트'
          ? lookupQuestRef(index, item.title || item.raw)
          : null,
    })),
  }
}

async function withQuestLinksMany(discoveries) {
  const index = await loadQuestNameIndex()
  return discoveries.map((discovery) => {
    const acquireQuest =
      discovery.acquireType === '퀘스트'
        ? lookupQuestRef(index, discovery.acquireName)
        : null
    return {
      ...discovery,
      acquireQuest,
      linkedQuests: discovery.linkedQuests.map((item) => ({
        ...item,
        quest:
          !item.tag || item.tag === '퀘스트'
            ? lookupQuestRef(index, item.title || item.raw)
            : null,
      })),
    }
  })
}

export async function listDiscoveryCategoryTree() {
  const sql = getSql()
  const groups = await sql`
    SELECT id, code, name, sort_order
    FROM discovery_category_groups
    WHERE enabled = TRUE
    ORDER BY sort_order, id
  `
  const categories = await sql`
    SELECT id, group_id, code, name, sort_order
    FROM discovery_categories
    WHERE enabled = TRUE
    ORDER BY sort_order, id
  `
  return groups.map((g) => ({
    id: Number(g.id),
    code: String(g.code),
    name: String(g.name),
    sortOrder: Number(g.sort_order),
    categories: categories
      .filter((c) => Number(c.group_id) === Number(g.id))
      .map((c) => ({
        id: Number(c.id),
        code: String(c.code),
        name: String(c.name),
        sortOrder: Number(c.sort_order),
      })),
  }))
}

export async function listDiscoveries() {
  const sql = getSql()
  const rows = await sql`
    SELECT
      d.*,
      c.id AS category_id,
      g.name AS category_group
    FROM discoveries d
    LEFT JOIN discovery_categories c
      ON c.enabled = TRUE
      AND (
        c.name = d.category
        OR (d.category = '항구-마을' AND c.name = '항구·마을')
        OR (d.category = '기상현상' AND c.name = '기상 현상')
      )
    LEFT JOIN discovery_category_groups g
      ON g.id = c.group_id AND g.enabled = TRUE
    WHERE d.enabled = TRUE
    ORDER BY d.sort_order, d.id
  `
  return withQuestLinksMany(rows.map(decorateDiscovery))
}

export async function getDiscoveryBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT
      d.*,
      c.id AS category_id,
      g.name AS category_group
    FROM discoveries d
    LEFT JOIN discovery_categories c
      ON c.enabled = TRUE
      AND (
        c.name = d.category
        OR (d.category = '항구-마을' AND c.name = '항구·마을')
        OR (d.category = '기상현상' AND c.name = '기상 현상')
      )
    LEFT JOIN discovery_category_groups g
      ON g.id = c.group_id AND g.enabled = TRUE
    WHERE d.slug = ${slug} AND d.enabled = TRUE
    LIMIT 1
  `
  return rows[0] ? withQuestLinks(decorateDiscovery(rows[0])) : null
}

async function findIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug FROM discoveries
    WHERE TRIM(BOTH FROM regexp_replace(name, '\\s+', ' ', 'g')) = ${name}
    LIMIT 1
  `
  return dup[0]
    ? { id: Number(dup[0].id), slug: String(dup[0].slug) }
    : null
}

export async function upsertDiscoveryFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeName(parsed.name)
  if (!name) throw new Error('발견물 이름이 없습니다.')

  const existing = await findIdByName(sql, name)
  const skillsJson = JSON.stringify(parsed.skills || [])
  const linkedJson = JSON.stringify(parsed.linkedQuests || [])
  const debateJson = parsed.debateCombo
    ? JSON.stringify(parsed.debateCombo)
    : null
  const category = resolveDiscoveryCategory(parsed.category)

  if (existing) {
    await sql`
      UPDATE discoveries SET
        name = ${name},
        description = ${parsed.description},
        category = ${category},
        rank = ${parsed.rank},
        card_points = ${parsed.cardPoints ?? null},
        discovery_exp = ${parsed.discoveryExp ?? null},
        card_exp = ${parsed.cardExp ?? null},
        report_fame = ${parsed.reportFame ?? null},
        skills = ${skillsJson},
        acquire_type = ${parsed.acquireType},
        acquire_name = ${parsed.acquireName},
        place = ${parsed.place},
        linked_quests = ${linkedJson},
        debate_combo = ${debateJson},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    return getDiscoveryBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash =
      await sql`SELECT id FROM discoveries WHERE slug = ${attempt} LIMIT 1`
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows =
    await sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM discoveries`
  const id = Number(maxRows[0].max_id) + 1
  const sortRows =
    await sql`SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM discoveries`
  const sortOrder = Number(sortRows[0].max_sort) + 1

  await sql`
    INSERT INTO discoveries (
      id, slug, name, description, category, rank,
      card_points, discovery_exp, card_exp, report_fame,
      skills, acquire_type, acquire_name, place,
      linked_quests, debate_combo, enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${parsed.description},
      ${category}, ${parsed.rank},
      ${parsed.cardPoints ?? null}, ${parsed.discoveryExp ?? null},
      ${parsed.cardExp ?? null}, ${parsed.reportFame ?? null},
      ${skillsJson},
      ${parsed.acquireType}, ${parsed.acquireName}, ${parsed.place},
      ${linkedJson}, ${debateJson},
      TRUE, ${sortOrder}
    )
  `

  return getDiscoveryBySlug(slug)
}
