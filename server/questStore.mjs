import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export async function ensureQuestStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/008_quests.sql')
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
    description: row.description == null ? null : String(row.description),
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
    rewardDucat: row.reward_ducat == null ? null : Number(row.reward_ducat),
    rewardAdvance:
      row.reward_advance == null ? null : Number(row.reward_advance),
    expDiscovery:
      row.exp_discovery == null ? null : Number(row.exp_discovery),
    expCard: row.exp_card == null ? null : Number(row.exp_card),
    expReport: row.exp_report == null ? null : Number(row.exp_report),
    fameReport: row.fame_report == null ? null : Number(row.fame_report),
    rewardItems: asJsonArray(row.reward_items),
    chainQuests: asJsonArray(row.chain_quests),
    walkthrough: row.walkthrough == null ? null : String(row.walkthrough),
    progress: row.progress == null ? null : String(row.progress),
  }
}

export async function listQuests() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM quests WHERE enabled = TRUE ORDER BY sort_order, id
  `
  return rows.map(decorateQuest)
}

export async function getQuestBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM quests WHERE slug = ${slug} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateQuest(rows[0]) : null
}

/** 텍스트 파싱 결과로 퀘스트 신규 등록 (동일 이름 거부) */
export async function insertQuestFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeQuestName(parsed.name)
  if (!name) throw new Error('퀘스트 이름이 없습니다.')

  const dup = await sql`
    SELECT id, name FROM quests
    WHERE TRIM(BOTH FROM regexp_replace(name, '\\s+', ' ', 'g')) = ${name}
    LIMIT 1
  `
  if (dup[0]) {
    throw new Error(`중복 퀘스트가 존재합니다. (「${dup[0].name}」)`)
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
      skills, reward_ducat, reward_advance,
      exp_discovery, exp_card, exp_report, fame_report,
      reward_items, chain_quests, walkthrough, progress,
      enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${parsed.description},
      ${parsed.category}, ${parsed.questType}, ${parsed.difficulty},
      ${parsed.requestPlaces}, ${parsed.destination},
      ${parsed.discoveryCategory}, ${parsed.discoveryRank}, ${parsed.discoveryName},
      ${JSON.stringify(parsed.skills || [])},
      ${parsed.rewardDucat}, ${parsed.rewardAdvance},
      ${parsed.expDiscovery}, ${parsed.expCard}, ${parsed.expReport}, ${parsed.fameReport},
      ${JSON.stringify(parsed.rewardItems || [])},
      ${JSON.stringify(parsed.chainQuests || [])},
      ${parsed.walkthrough}, ${parsed.progress},
      TRUE, ${sortOrder}
    )
  `

  return getQuestBySlug(slug)
}
