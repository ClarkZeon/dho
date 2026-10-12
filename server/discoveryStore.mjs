import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
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

function decorateQuestRef(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    category: row.category == null ? null : String(row.category),
    questType: row.quest_type == null ? null : String(row.quest_type),
    difficulty: row.difficulty == null ? null : Number(row.difficulty),
    requestPlaces:
      row.request_places == null ? null : String(row.request_places),
    skills: asJsonArray(row.skills).map((item) => ({
      name: String(item?.name || ''),
      level:
        item?.level == null || item?.level === ''
          ? null
          : Number(item.level),
    })),
  }
}

/**
 * 퀘스트 인덱스
 * - byName: 퀘스트 이름 → ref (연결 퀘스트 문구용)
 * - byDiscoveryName: 퀘스트.discovery_name → ref (발견 방법 소스)
 */
async function loadQuestIndexes() {
  const sql = getSql()
  const rows = await sql`
    SELECT
      id, slug, name, category, quest_type, difficulty,
      request_places, skills, discovery_name
    FROM quests
    WHERE enabled = TRUE
  `
  /** @type {Map<string, object>} */
  const byName = new Map()
  /** @type {Map<string, object>} */
  const byDiscoveryName = new Map()
  for (const row of rows) {
    const ref = decorateQuestRef(row)
    const nameKey = normalizeName(ref.name)
    if (nameKey) byName.set(nameKey, ref)
    const discKey = normalizeName(row.discovery_name)
    if (discKey && !byDiscoveryName.has(discKey)) {
      byDiscoveryName.set(discKey, ref)
    }
  }
  return { byName, byDiscoveryName }
}

function lookupQuestRef(byName, text) {
  const name = extractQuestNameFromRef(text)
  if (!name) return null
  return byName.get(normalizeName(name)) || null
}

/** 발견 방법 매칭: 퀘스트.discovery_name 우선, 없으면 acquireName 추출 */
function resolveAcquireQuest(discovery, byName, byDiscoveryName) {
  const fromQuest = byDiscoveryName.get(normalizeName(discovery.name))
  if (fromQuest) return fromQuest
  if (discovery.acquireType === '퀘스트') {
    return lookupQuestRef(byName, discovery.acquireName)
  }
  return null
}

/** 위키형 acquire_name 본문 (타입 괄호 제외) */
function buildAcquireNameFromQuest(quest) {
  if (!quest?.name) return null
  const category = String(quest.category || quest.questType || '').trim()
  const skillParts = (quest.skills || [])
    .map((skill) => {
      const name = String(skill?.name || '').trim()
      if (!name) return ''
      return skill.level != null && Number.isFinite(Number(skill.level))
        ? `${name} ${skill.level}`
        : name
    })
    .filter(Boolean)
  let skillsClause = ''
  if (quest.difficulty != null && Number.isFinite(Number(quest.difficulty))) {
    skillsClause = skillParts.length
      ? `${quest.difficulty} ${skillParts.join(', ')}`
      : String(quest.difficulty)
  } else {
    skillsClause = skillParts.join(', ')
  }
  const places = String(quest.requestPlaces || '').trim()
  let body = ''
  if (category) body += `${category} | `
  body += quest.name
  if (skillsClause) body += ` (${skillsClause})`
  if (places) body += ` - ${places}`
  return body
}

function attachQuestLinks(discovery, byName, byDiscoveryName) {
  const acquireQuest = resolveAcquireQuest(
    discovery,
    byName,
    byDiscoveryName,
  )
  return {
    ...discovery,
    acquireQuest,
    linkedQuests: discovery.linkedQuests.map((item) => ({
      ...item,
      quest:
        !item.tag || item.tag === '퀘스트'
          ? lookupQuestRef(byName, item.title || item.raw)
          : null,
    })),
  }
}

async function withQuestLinks(discovery) {
  const { byName, byDiscoveryName } = await loadQuestIndexes()
  return attachQuestLinks(discovery, byName, byDiscoveryName)
}

async function withQuestLinksMany(discoveries) {
  const { byName, byDiscoveryName } = await loadQuestIndexes()
  return discoveries.map((discovery) =>
    attachQuestLinks(discovery, byName, byDiscoveryName),
  )
}

/**
 * 퀘스트.discovery_name 기준으로 발견 방법(acquire) 일괄 동기화
 * @returns {Promise<{ matched: number, updated: number }>}
 */
export async function syncDiscoveryAcquireFromQuests() {
  const sql = getSql()
  const { byDiscoveryName } = await loadQuestIndexes()
  if (!byDiscoveryName.size) return { matched: 0, updated: 0 }

  const rows = await sql`
    SELECT id, name, acquire_type, acquire_name
    FROM discoveries
    WHERE enabled = TRUE
  `
  let matched = 0
  let updated = 0
  for (const row of rows) {
    const quest = byDiscoveryName.get(normalizeName(row.name))
    if (!quest) continue
    matched += 1
    const acquireName = buildAcquireNameFromQuest(quest)
    if (!acquireName) continue
    const sameType = String(row.acquire_type || '') === '퀘스트'
    const sameName = String(row.acquire_name || '') === acquireName
    if (sameType && sameName) continue
    await sql`
      UPDATE discoveries
      SET
        acquire_type = '퀘스트',
        acquire_name = ${acquireName}
      WHERE id = ${Number(row.id)}
    `
    updated += 1
  }
  return { matched, updated }
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

/** @param {number} id */
export async function deleteDiscovery(id) {
  const sql = getSql()
  const discoveryId = Number(id)
  if (!Number.isFinite(discoveryId)) throw new Error('잘못된 발견물 ID입니다.')
  const rows = await sql`
    UPDATE discoveries SET enabled = FALSE
    WHERE id = ${discoveryId} AND enabled = TRUE
    RETURNING id
  `
  if (!rows[0]) throw new Error('발견물을 찾을 수 없습니다.')
  await bumpCatalogStat('discoveries', -1)
  return { ok: true }
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

export async function getDiscoveryById(id) {
  const sql = getSql()
  const discoveryId = Number(id)
  if (!Number.isFinite(discoveryId)) return null
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
    WHERE d.id = ${discoveryId} AND d.enabled = TRUE
    LIMIT 1
  `
  return rows[0] ? withQuestLinks(decorateDiscovery(rows[0])) : null
}

/**
 * 발견물 부분 갱신
 * @param {number} id
 * @param {{ rank?: number | null }} patch
 */
export async function updateDiscoveryFields(id, patch) {
  const sql = getSql()
  const discoveryId = Number(id)
  if (!Number.isFinite(discoveryId)) throw new Error('잘못된 발견물 ID입니다.')

  const current = await getDiscoveryById(discoveryId)
  if (!current) throw new Error('발견물을 찾을 수 없습니다.')

  if ('rank' in patch) {
    let rank = current.rank
    if (patch.rank == null || patch.rank === '') {
      rank = null
    } else {
      const n = Number(patch.rank)
      if (!Number.isInteger(n) || n < 0 || n > 10) {
        throw new Error('난이도는 0~10 정수여야 합니다.')
      }
      rank = n
    }
    await sql`UPDATE discoveries SET rank = ${rank} WHERE id = ${discoveryId}`
  }

  return getDiscoveryById(discoveryId)
}

async function findIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug, enabled FROM discoveries
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

/**
 * 정규화된 이름으로 발견물 참조 일괄 조회
 * @param {string[]} names
 * @returns {Promise<Map<string, { id: number, slug: string, name: string }>>}
 */
export async function lookupDiscoveriesByNames(names) {
  /** @type {Map<string, { id: number, slug: string, name: string }>} */
  const map = new Map()
  const normalized = [
    ...new Set(
      (names || [])
        .map((n) => normalizeName(n))
        .filter(Boolean),
    ),
  ]
  if (!normalized.length) return map

  const sql = getSql()
  const rows = await sql`
    SELECT id, slug, name FROM discoveries
    WHERE enabled = TRUE
      AND TRIM(BOTH FROM regexp_replace(name, '\\s+', ' ', 'g')) = ANY(${normalized})
  `
  for (const row of rows) {
    const key = normalizeName(row.name)
    map.set(key, {
      id: Number(row.id),
      slug: String(row.slug),
      name: String(row.name),
    })
  }
  return map
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
    await bumpCatalogStatIfGrew('discoveries', existing.enabled)
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

  await bumpCatalogStat('discoveries', 1)
  return getDiscoveryBySlug(slug)
}
