import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import {
  lookupDiscoveriesByNames,
  syncDiscoveryAcquireFromQuests,
} from './discoveryStore.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'
import { splitChainAndLinked, stripWikiMapNoise } from './questTextParse.mjs'

function normalizeDiscoveryName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * @param {Array<Record<string, unknown>>} quests
 */
async function withDiscoveryRefs(quests) {
  const map = await lookupDiscoveriesByNames(
    quests.map((q) =>
      q.discoveryName == null ? '' : String(q.discoveryName),
    ),
  )
  return quests.map((quest) => {
    const key = normalizeDiscoveryName(
      quest.discoveryName == null ? '' : String(quest.discoveryName),
    )
    return {
      ...quest,
      discoveryRef: key ? map.get(key) || null : null,
    }
  })
}

export async function ensureQuestStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/008_quests.sql')
  await runSqlFile('sql/015_user_quest_completions.sql')
  await runSqlFile('sql/035_quest_prerequisites.sql')
}

function normalizeQuestName(name) {
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

function decorateQuest(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description:
      row.description == null
        ? null
        : stripWikiMapNoise(String(row.description)) || null,
    category: row.category == null ? null : String(row.category),
    questType: row.quest_type == null ? null : String(row.quest_type),
    difficulty: row.difficulty == null ? null : Number(row.difficulty),
    requestPlaces:
      row.request_places == null ? null : String(row.request_places),
    destination: row.destination == null ? null : String(row.destination),
    discoveryCategory:
      row.discovery_category == null ? null : String(row.discovery_category),
    discoveryRank:
      row.discovery_rank == null ? null : Number(row.discovery_rank),
    discoveryName:
      row.discovery_name == null ? null : String(row.discovery_name),
    skills: asJsonArray(row.skills),
    prerequisites: asJsonArray(row.prerequisites),
    rewardDucat: row.reward_ducat == null ? null : Number(row.reward_ducat),
    rewardAdvance:
      row.reward_advance == null ? null : Number(row.reward_advance),
    expDiscovery:
      row.exp_discovery == null ? null : Number(row.exp_discovery),
    expCard: row.exp_card == null ? null : Number(row.exp_card),
    expReport: row.exp_report == null ? null : Number(row.exp_report),
    fameReport: row.fame_report == null ? null : Number(row.fame_report),
    rewardItems: asJsonArray(row.reward_items),
    ...splitChainAndLinked(asJsonArray(row.chain_quests)),
    walkthrough:
      row.walkthrough == null
        ? null
        : stripWikiMapNoise(
            String(row.walkthrough),
            row.destination == null ? null : String(row.destination),
          ) || null,
    progress:
      row.progress == null
        ? null
        : stripWikiMapNoise(
            String(row.progress),
            row.destination == null ? null : String(row.destination),
          ) || null,
  }
}

const QUEST_SORT_COLS = {
  name: 'name',
  category: 'category',
  difficulty: 'difficulty',
  requestPlaces: 'request_places',
  destination: 'destination',
  discovery: 'discovery_name',
}

function questOrderClause(sort, dir) {
  const col = QUEST_SORT_COLS[sort]
  const d = dir === 'desc' ? 'DESC' : 'ASC'
  if (!col) return 'ORDER BY id DESC'
  return `ORDER BY ${col} ${d} NULLS LAST, id ${d}`
}

/**
 * @param {string | null | undefined} userId
 * @param {{ q?: string, limit?: number, offset?: number, sort?: string | null, dir?: string }} [opts]
 */
export async function listQuestsPage(userId = null, opts = {}) {
  const sql = getSql()
  const q = String(opts.q || '')
    .trim()
    .slice(0, 80)
    .replace(/[%_]/g, '')
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 15))
  const offset = Math.max(0, Number(opts.offset) || 0)
  const order = questOrderClause(opts.sort, opts.dir)

  const params = []
  let where = 'enabled = TRUE'
  if (q) {
    params.push(`%${q}%`)
    const p = `$${params.length}`
    where += ` AND (
      name ILIKE ${p}
      OR COALESCE(request_places, '') ILIKE ${p}
      OR COALESCE(destination, '') ILIKE ${p}
      OR COALESCE(discovery_name, '') ILIKE ${p}
      OR COALESCE(category, '') ILIKE ${p}
      OR COALESCE(quest_type, '') ILIKE ${p}
    )`
  }

  const countRows = await sql.query(
    `SELECT COUNT(*)::int AS n FROM quests WHERE ${where}`,
    params,
  )
  const total = Number(countRows[0]?.n) || 0

  params.push(limit)
  const limitP = `$${params.length}`
  params.push(offset)
  const offsetP = `$${params.length}`
  const rows = await sql.query(
    `SELECT * FROM quests WHERE ${where} ${order} LIMIT ${limitP} OFFSET ${offsetP}`,
    params,
  )

  /** @type {Map<number, string>} */
  const completedAtByQuestId = new Map()
  let completedCount = 0
  if (userId) {
    const ids = rows.map((row) => Number(row.id)).filter(Number.isFinite)
    const [pageCompletions, totalCompleted] = await Promise.all([
      ids.length
        ? sql`
            SELECT quest_id, completed_at
            FROM user_quest_completions
            WHERE user_id = ${userId}
              AND quest_id = ANY(${ids})
          `
        : Promise.resolve([]),
      sql`
        SELECT COUNT(*)::int AS n
        FROM user_quest_completions c
        INNER JOIN quests q ON q.id = c.quest_id AND q.enabled = TRUE
        WHERE c.user_id = ${userId}
      `,
    ])
    for (const row of pageCompletions) {
      const questId = Number(row.quest_id)
      if (!Number.isFinite(questId)) continue
      completedAtByQuestId.set(
        questId,
        new Date(/** @type {string|Date} */ (row.completed_at)).toISOString(),
      )
    }
    completedCount = Number(totalCompleted[0]?.n) || 0
  }

  const quests = rows.map((row) => {
    const quest = decorateQuest(row)
    const completedAt = completedAtByQuestId.get(quest.id) || null
    return {
      ...quest,
      completed: Boolean(completedAt),
      completedAt,
    }
  })
  return {
    quests: await withDiscoveryRefs(quests),
    total,
    completedCount,
    limit,
    offset,
  }
}

/**
 * @param {string | null | undefined} userId
 */
export async function listQuests(userId = null) {
  const page = await listQuestsPage(userId, { limit: 100, offset: 0 })
  return page.quests
}

/**
 * @param {string} userId
 * @param {number} questId
 * @param {boolean} completed
 */
export async function setUserQuestCompleted(userId, questId, completed) {
  const sql = getSql()
  const existing = await sql`
    SELECT id FROM quests WHERE id = ${questId} AND enabled = TRUE LIMIT 1
  `
  if (!existing[0]) throw new Error('퀘스트를 찾을 수 없습니다.')

  if (completed) {
    await sql`
      INSERT INTO user_quest_completions (user_id, quest_id, completed_at)
      VALUES (${userId}, ${questId}, NOW())
      ON CONFLICT (user_id, quest_id) DO UPDATE SET
        completed_at = EXCLUDED.completed_at
    `
  } else {
    await sql`
      DELETE FROM user_quest_completions
      WHERE user_id = ${userId} AND quest_id = ${questId}
    `
  }

  const rows = await sql`
    SELECT completed_at FROM user_quest_completions
    WHERE user_id = ${userId} AND quest_id = ${questId}
    LIMIT 1
  `
  const completedAt = rows[0]
    ? new Date(/** @type {string|Date} */ (rows[0].completed_at)).toISOString()
    : null
  return {
    questId,
    completed: Boolean(completedAt),
    completedAt,
  }
}

export async function getQuestBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM quests WHERE slug = ${slug} AND enabled = TRUE LIMIT 1
  `
  if (!rows[0]) return null
  const [quest] = await withDiscoveryRefs([decorateQuest(rows[0])])
  return quest
}

export async function getQuestById(id, userId = null) {
  const sql = getSql()
  const questId = Number(id)
  if (!Number.isFinite(questId)) return null
  const rows = await sql`
    SELECT * FROM quests WHERE id = ${questId} AND enabled = TRUE LIMIT 1
  `
  if (!rows[0]) return null
  const [quest] = await withDiscoveryRefs([decorateQuest(rows[0])])
  if (!userId) return quest
  const completions = await sql`
    SELECT completed_at FROM user_quest_completions
    WHERE user_id = ${userId} AND quest_id = ${questId}
    LIMIT 1
  `
  const completedAt = completions[0]
    ? new Date(
        /** @type {string|Date} */ (completions[0].completed_at),
      ).toISOString()
    : null
  return {
    ...quest,
    completed: Boolean(completedAt),
    completedAt,
  }
}

/** @param {number} id */
export async function deleteQuest(id) {
  const sql = getSql()
  const questId = Number(id)
  if (!Number.isFinite(questId)) throw new Error('잘못된 퀘스트 ID입니다.')
  const rows = await sql`
    UPDATE quests SET enabled = FALSE
    WHERE id = ${questId} AND enabled = TRUE
    RETURNING id
  `
  if (!rows[0]) throw new Error('퀘스트를 찾을 수 없습니다.')
  await bumpCatalogStat('quests', -1)
  return { ok: true }
}

function asNullableText(value) {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text : null
}

function asOptionalInt(value, label) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n)) throw new Error(`${label}은(는) 정수여야 합니다.`)
  return n
}

/**
 * 퀘스트 부분 갱신
 * @param {number} id
 * @param {Record<string, unknown>} patch
 */
export async function updateQuestFields(id, patch) {
  const sql = getSql()
  const questId = Number(id)
  if (!Number.isFinite(questId)) throw new Error('잘못된 퀘스트 ID입니다.')

  const current = await getQuestById(questId)
  if (!current) throw new Error('퀘스트를 찾을 수 없습니다.')

  const next = { ...current }

  if ('name' in patch) {
    const name = normalizeQuestName(patch.name)
    if (!name) throw new Error('퀘스트 이름이 필요합니다.')
    next.name = name
  }
  for (const key of [
    'description',
    'category',
    'questType',
    'requestPlaces',
    'destination',
    'discoveryCategory',
    'discoveryName',
    'walkthrough',
    'progress',
  ]) {
    if (key in patch) next[key] = asNullableText(patch[key])
  }
  if ('difficulty' in patch) {
    const difficulty = asOptionalInt(patch.difficulty, '난이도')
    if (difficulty != null && (difficulty < 0 || difficulty > 10)) {
      throw new Error('난이도는 0~10 정수여야 합니다.')
    }
    next.difficulty = difficulty
  }
  if ('discoveryRank' in patch) {
    next.discoveryRank = asOptionalInt(patch.discoveryRank, '발견물 난이도')
  }
  for (const key of [
    'rewardDucat',
    'rewardAdvance',
    'expDiscovery',
    'expCard',
    'expReport',
    'fameReport',
  ]) {
    if (key in patch) next[key] = asOptionalInt(patch[key], key)
  }
  if ('skills' in patch) {
    if (!Array.isArray(patch.skills)) throw new Error('스킬 형식이 올바르지 않습니다.')
    next.skills = patch.skills.map((item) => ({
      name: String(item?.name || ''),
      level:
        item?.level == null || item?.level === ''
          ? null
          : Number(item.level),
    }))
  }
  if ('prerequisites' in patch) {
    if (!Array.isArray(patch.prerequisites)) {
      throw new Error('선행 발견/퀘스트 형식이 올바르지 않습니다.')
    }
    next.prerequisites = patch.prerequisites
  }
  if ('rewardItems' in patch) {
    if (!Array.isArray(patch.rewardItems)) {
      throw new Error('보상 아이템 형식이 올바르지 않습니다.')
    }
    next.rewardItems = patch.rewardItems.map((item) => ({
      name: String(item?.name || ''),
      qty: item?.qty == null || item?.qty === '' ? null : Number(item.qty),
    }))
  }
  if ('chainQuests' in patch || 'linkedQuests' in patch) {
    next.chainQuests = Array.isArray(patch.chainQuests)
      ? patch.chainQuests
      : current.chainQuests
    next.linkedQuests = Array.isArray(patch.linkedQuests)
      ? patch.linkedQuests
      : current.linkedQuests
  }

  const skillsJson = JSON.stringify(next.skills || [])
  const prerequisitesJson = JSON.stringify(next.prerequisites || [])
  const itemsJson = JSON.stringify(next.rewardItems || [])
  const chainJson = JSON.stringify([
    ...(next.chainQuests || []),
    ...(next.linkedQuests || []).map((item) => ({
      ...item,
      relation: 'linked',
    })),
  ])

  await sql`
    UPDATE quests SET
      name = ${next.name},
      description = ${next.description},
      category = ${next.category},
      quest_type = ${next.questType},
      difficulty = ${next.difficulty},
      request_places = ${next.requestPlaces},
      destination = ${next.destination},
      discovery_category = ${next.discoveryCategory},
      discovery_rank = ${next.discoveryRank},
      discovery_name = ${next.discoveryName},
      skills = ${skillsJson},
      prerequisites = ${prerequisitesJson},
      reward_ducat = ${next.rewardDucat},
      reward_advance = ${next.rewardAdvance},
      exp_discovery = ${next.expDiscovery},
      exp_card = ${next.expCard},
      exp_report = ${next.expReport},
      fame_report = ${next.fameReport},
      reward_items = ${itemsJson},
      chain_quests = ${chainJson},
      walkthrough = ${next.walkthrough},
      progress = ${next.progress}
    WHERE id = ${questId}
  `

  return getQuestById(questId)
}

async function findQuestIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug, enabled FROM quests
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

/** 텍스트 파싱 결과로 퀘스트 등록. 동일 이름이면 내용 갱신 */
export async function upsertQuestFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeQuestName(parsed.name)
  if (!name) throw new Error('퀘스트 이름이 없습니다.')

  const existing = await findQuestIdByName(sql, name)
  const skillsJson = JSON.stringify(parsed.skills || [])
  const prerequisitesJson = JSON.stringify(parsed.prerequisites || [])
  const itemsJson = JSON.stringify(parsed.rewardItems || [])
  const chainJson = JSON.stringify([
    ...(parsed.chainQuests || []),
    ...(parsed.linkedQuests || []).map((item) => ({
      ...item,
      relation: 'linked',
    })),
  ])

  if (existing) {
    await sql`
      UPDATE quests SET
        name = ${name},
        description = ${parsed.description},
        category = ${parsed.category},
        quest_type = ${parsed.questType},
        difficulty = COALESCE(${parsed.difficulty}, difficulty),
        request_places = ${parsed.requestPlaces},
        destination = ${parsed.destination},
        discovery_category = ${parsed.discoveryCategory},
        discovery_rank = ${parsed.discoveryRank},
        discovery_name = ${parsed.discoveryName},
        skills = ${skillsJson},
        prerequisites = ${prerequisitesJson},
        reward_ducat = ${parsed.rewardDucat},
        reward_advance = ${parsed.rewardAdvance},
        exp_discovery = ${parsed.expDiscovery},
        exp_card = ${parsed.expCard},
        exp_report = ${parsed.expReport},
        fame_report = ${parsed.fameReport},
        reward_items = ${itemsJson},
        chain_quests = ${chainJson},
        walkthrough = ${parsed.walkthrough},
        progress = ${parsed.progress},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    await bumpCatalogStatIfGrew('quests', existing.enabled)
    if (parsed.discoveryName) await syncDiscoveryAcquireFromQuests()
    return getQuestBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash = await sql`SELECT id FROM quests WHERE slug = ${attempt} LIMIT 1`
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows = await sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM quests`
  const id = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM quests`
  const sortOrder = Number(sortRows[0].max_sort) + 1

  await sql`
    INSERT INTO quests (
      id, slug, name, description, category, quest_type, difficulty,
      request_places, destination,
      discovery_category, discovery_rank, discovery_name,
      skills, prerequisites, reward_ducat, reward_advance,
      exp_discovery, exp_card, exp_report, fame_report,
      reward_items, chain_quests, walkthrough, progress,
      enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${parsed.description},
      ${parsed.category}, ${parsed.questType}, ${parsed.difficulty},
      ${parsed.requestPlaces}, ${parsed.destination},
      ${parsed.discoveryCategory}, ${parsed.discoveryRank}, ${parsed.discoveryName},
      ${skillsJson}, ${prerequisitesJson},
      ${parsed.rewardDucat}, ${parsed.rewardAdvance},
      ${parsed.expDiscovery}, ${parsed.expCard}, ${parsed.expReport}, ${parsed.fameReport},
      ${itemsJson},
      ${chainJson},
      ${parsed.walkthrough}, ${parsed.progress},
      TRUE, ${sortOrder}
    )
  `

  await bumpCatalogStat('quests', 1)
  if (parsed.discoveryName) await syncDiscoveryAcquireFromQuests()
  return getQuestBySlug(slug)
}

/** @deprecated use upsertQuestFromParsed */
export async function insertQuestFromParsed(parsed) {
  return upsertQuestFromParsed(parsed)
}
