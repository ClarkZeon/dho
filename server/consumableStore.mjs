import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export async function ensureConsumableStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/019_consumables.sql')
  await runSqlFile('sql/031_consumable_detail_extra.sql')
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

function asPurchaseRows(value) {
  return asJsonArray(value).map((item) => ({
    npc: String(item?.npc || ''),
    region: String(item?.region || ''),
    place: String(item?.place || ''),
  }))
}

function asInfoRows(value) {
  return asJsonArray(value)
    .map((item) => {
      if (typeof item === 'string') {
        const name = item.trim()
        return name ? { name, detail: null } : null
      }
      const name = String(item?.name || item?.label || item?.title || '').trim()
      if (!name) return null
      const detailRaw = item?.detail ?? item?.content ?? item?.note ?? null
      const detail =
        detailRaw == null || String(detailRaw).trim() === ''
          ? null
          : String(detailRaw).trim()
      return { name, detail }
    })
    .filter(Boolean)
}

function decorateConsumable(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    category: row.category == null ? null : String(row.category),
    useEffect: row.use_effect == null ? null : String(row.use_effect),
    acquireMethods: asJsonArray(row.acquire_methods).map(String),
    purchases: asPurchaseRows(row.purchases),
    productions: asInfoRows(row.productions),
    quests: asInfoRows(row.quests),
    itemUses: asInfoRows(row.item_uses),
    treasureBoxes: asInfoRows(row.treasure_boxes),
    events: asInfoRows(row.events),
    landResurveys: asInfoRows(row.land_resurveys),
    pets: asInfoRows(row.pets),
  }
}

export async function listConsumables() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM consumables WHERE enabled = TRUE ORDER BY sort_order, id
  `
  return rows.map(decorateConsumable)
}

export async function getConsumableBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM consumables WHERE slug = ${slug} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateConsumable(rows[0]) : null
}

export async function getConsumableById(id) {
  const sql = getSql()
  const consumableId = Number(id)
  if (!Number.isFinite(consumableId)) return null
  const rows = await sql`
    SELECT * FROM consumables WHERE id = ${consumableId} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateConsumable(rows[0]) : null
}

function asNullableText(value) {
  const t = value == null ? '' : String(value).trim()
  return t || null
}

function asMethodList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[·,，/|｜\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  throw new Error('획득 방법 형식이 올바르지 않습니다.')
}

function syncAcquireMethods(current, patch) {
  const methods = [...current]
  const checks = [
    ['purchases', '구입'],
    ['productions', '생산'],
    ['quests', '퀘스트'],
    ['itemUses', '아이템 사용'],
    ['treasureBoxes', '트레져박스'],
    ['events', '이벤트'],
    ['landResurveys', '육지 재조사'],
    ['pets', '애완동물'],
  ]
  for (const [key, label] of checks) {
    if (!(key in patch)) continue
    const rows = Array.isArray(patch[key]) ? patch[key] : []
    if (rows.length > 0 && !methods.includes(label)) methods.push(label)
  }
  return methods
}

/**
 * @param {number} id
 * @param {Record<string, unknown>} patch
 */
export async function updateConsumableFields(id, patch) {
  const sql = getSql()
  const consumableId = Number(id)
  if (!Number.isFinite(consumableId)) throw new Error('잘못된 소비품 ID입니다.')

  const current = await getConsumableById(consumableId)
  if (!current) throw new Error('소비품을 찾을 수 없습니다.')

  const category =
    'category' in patch ? asNullableText(patch.category) : current.category
  const useEffect =
    'useEffect' in patch ? asNullableText(patch.useEffect) : current.useEffect
  let acquireMethods =
    'acquireMethods' in patch
      ? asMethodList(patch.acquireMethods)
      : current.acquireMethods

  const purchases =
    'purchases' in patch ? asPurchaseRows(patch.purchases) : current.purchases
  const productions =
    'productions' in patch ? asInfoRows(patch.productions) : current.productions
  const quests = 'quests' in patch ? asInfoRows(patch.quests) : current.quests
  const itemUses =
    'itemUses' in patch ? asInfoRows(patch.itemUses) : current.itemUses
  const treasureBoxes =
    'treasureBoxes' in patch
      ? asInfoRows(patch.treasureBoxes)
      : current.treasureBoxes
  const events = 'events' in patch ? asInfoRows(patch.events) : current.events
  const landResurveys =
    'landResurveys' in patch
      ? asInfoRows(patch.landResurveys)
      : current.landResurveys
  const pets = 'pets' in patch ? asInfoRows(patch.pets) : current.pets

  if (!('acquireMethods' in patch)) {
    acquireMethods = syncAcquireMethods(acquireMethods, {
      purchases,
      productions,
      quests,
      itemUses,
      treasureBoxes,
      events,
      landResurveys,
      pets,
    })
  }

  await sql`
    UPDATE consumables SET
      category = ${category},
      use_effect = ${useEffect},
      acquire_methods = ${JSON.stringify(acquireMethods)},
      purchases = ${JSON.stringify(purchases)},
      productions = ${JSON.stringify(productions)},
      quests = ${JSON.stringify(quests)},
      item_uses = ${JSON.stringify(itemUses)},
      treasure_boxes = ${JSON.stringify(treasureBoxes)},
      events = ${JSON.stringify(events)},
      land_resurveys = ${JSON.stringify(landResurveys)},
      pets = ${JSON.stringify(pets)}
    WHERE id = ${consumableId}
  `
  return getConsumableById(consumableId)
}

/** @param {number} id */
export async function deleteConsumable(id) {
  const sql = getSql()
  const consumableId = Number(id)
  if (!Number.isFinite(consumableId)) throw new Error('잘못된 소비품 ID입니다.')
  const rows = await sql`
    UPDATE consumables SET enabled = FALSE
    WHERE id = ${consumableId} AND enabled = TRUE
    RETURNING id
  `
  if (!rows[0]) throw new Error('소비품을 찾을 수 없습니다.')
  await bumpCatalogStat('consumables', -1)
  return { ok: true }
}

async function findIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug, enabled FROM consumables
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

/** 텍스트 파싱 결과로 소비품 등록. 동일 이름이면 내용 갱신 */
export async function upsertConsumableFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeName(parsed.name)
  if (!name) throw new Error('소비품 이름이 없습니다.')

  const existing = await findIdByName(sql, name)
  const methodsJson = JSON.stringify(parsed.acquireMethods || [])
  const purchasesJson = JSON.stringify(parsed.purchases || [])
  const productionsJson = JSON.stringify(parsed.productions || [])
  const questsJson = JSON.stringify(parsed.quests || [])
  const itemUsesJson = JSON.stringify(parsed.itemUses || [])
  const treasureBoxesJson = JSON.stringify(parsed.treasureBoxes || [])
  const eventsJson = JSON.stringify(parsed.events || [])
  const landResurveysJson = JSON.stringify(parsed.landResurveys || [])
  const petsJson = JSON.stringify(parsed.pets || [])

  if (existing) {
    await sql`
      UPDATE consumables SET
        name = ${name},
        description = ${parsed.description},
        category = ${parsed.category},
        use_effect = ${parsed.useEffect},
        acquire_methods = ${methodsJson},
        purchases = ${purchasesJson},
        productions = ${productionsJson},
        quests = ${questsJson},
        item_uses = ${itemUsesJson},
        treasure_boxes = ${treasureBoxesJson},
        events = ${eventsJson},
        land_resurveys = ${landResurveysJson},
        pets = ${petsJson},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    await bumpCatalogStatIfGrew('consumables', existing.enabled)
    return getConsumableBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash = await sql`
      SELECT id FROM consumables WHERE slug = ${attempt} LIMIT 1
    `
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows = await sql`
    SELECT COALESCE(MAX(id), 0) AS max_id FROM consumables
  `
  const id = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM consumables
  `
  const sortOrder = Number(sortRows[0].max_sort) + 1

  await sql`
    INSERT INTO consumables (
      id, slug, name, description, category, use_effect,
      acquire_methods, purchases, productions, quests, item_uses,
      treasure_boxes, events, land_resurveys, pets,
      enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${parsed.description}, ${parsed.category},
      ${parsed.useEffect}, ${methodsJson}, ${purchasesJson},
      ${productionsJson}, ${questsJson}, ${itemUsesJson},
      ${treasureBoxesJson}, ${eventsJson}, ${landResurveysJson}, ${petsJson},
      TRUE, ${sortOrder}
    )
  `

  await bumpCatalogStat('consumables', 1)
  return getConsumableBySlug(slug)
}
