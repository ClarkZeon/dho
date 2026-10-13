import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export async function ensureSeaAreaStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/024_sea_areas.sql')
  await runSqlFile('sql/025_sea_area_detail.sql')
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

/** 위키 구형(items 문자열) → 항목별 행으로 펼침 */
function decorateCollectItems(raw) {
  /** @type {Array<object>} */
  const out = []
  for (const item of asJsonArray(raw)) {
    const source = String(item?.source || '기타')
    const rank =
      item?.rank == null || item?.rank === '' ? null : Number(item.rank)
    const type = item?.type == null || item?.type === '' ? null : String(item.type)
    const recommendSpot =
      item?.recommendSpot == null || item?.recommendSpot === ''
        ? null
        : String(item.recommendSpot)
    const canExchange =
      typeof item?.canExchange === 'boolean' ? item.canExchange : null
    const canRelease =
      typeof item?.canRelease === 'boolean' ? item.canRelease : null

    if (item?.name) {
      out.push({
        source,
        name: String(item.name),
        rank,
        type,
        recommendSpot,
        canExchange,
        canRelease,
      })
      continue
    }

    const names = String(item?.items || '')
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
    for (const name of names) {
      out.push({
        source,
        name,
        rank,
        type,
        recommendSpot,
        canExchange,
        canRelease,
      })
    }
  }
  return out
}

function decorateRegions(row) {
  const fromJson = asJsonArray(row.regions)
    .map((v) => String(v || '').trim())
    .filter(Boolean)
  if (fromJson.length) return fromJson
  const single = row.region == null ? '' : String(row.region).trim()
  return single ? [single] : []
}

function decorateSeaArea(row) {
  const regions = decorateRegions(row)
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    altName: row.alt_name == null ? null : String(row.alt_name),
    description:
      row.description == null ? null : String(row.description),
    category: row.category == null ? null : String(row.category),
    region: regions[0] || (row.region == null ? null : String(row.region)),
    regions,
    boundNorth: row.bound_north == null ? null : Number(row.bound_north),
    boundWest: row.bound_west == null ? null : Number(row.bound_west),
    boundSouth: row.bound_south == null ? null : Number(row.bound_south),
    boundEast: row.bound_east == null ? null : Number(row.bound_east),
    wave: row.wave == null ? null : Number(row.wave),
    current: row.current == null ? null : Number(row.current),
    maxSpeedBonus:
      row.max_speed_bonus == null ? null : String(row.max_speed_bonus),
    places: asJsonArray(row.places).map((item) => ({
      kind: String(item?.kind || ''),
      name: String(item?.name || ''),
    })),
    collectItems: decorateCollectItems(row.collect_items),
    destinations: asJsonArray(row.destinations).map((item) => ({
      source: String(item?.source || '보물지도'),
      discovery: String(item?.discovery || ''),
      content: String(item?.content || ''),
    })),
    seaNpcs: asJsonArray(row.sea_npcs).map((item) => ({
      fleetCount:
        item?.fleetCount == null || item?.fleetCount === ''
          ? null
          : Number(item.fleetCount),
      trait: item?.trait == null || item?.trait === ''
        ? null
        : String(item.trait),
      names: Array.isArray(item?.names)
        ? item.names.map(String)
        : String(item?.names || '')
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean),
    })),
  }
}

export async function listSeaAreas() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM sea_areas WHERE enabled = TRUE ORDER BY id DESC
  `
  return rows.map(decorateSeaArea)
}

export async function getSeaAreaBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM sea_areas WHERE slug = ${slug} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateSeaArea(rows[0]) : null
}

export async function getSeaAreaById(id) {
  const sql = getSql()
  const seaAreaId = Number(id)
  if (!Number.isFinite(seaAreaId)) return null
  const rows = await sql`
    SELECT * FROM sea_areas WHERE id = ${seaAreaId} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateSeaArea(rows[0]) : null
}

/**
 * 해역 필드 부분/전체 갱신 (상세 폼 저장)
 * @param {number} id
 * @param {Record<string, unknown>} patch
 */
export async function updateSeaAreaFields(id, patch) {
  const sql = getSql()
  const seaAreaId = Number(id)
  if (!Number.isFinite(seaAreaId)) throw new Error('잘못된 해역 ID입니다.')

  const current = await getSeaAreaById(seaAreaId)
  if (!current) throw new Error('해역을 찾을 수 없습니다.')

  const next = { ...current }

  if ('name' in patch) {
    const name = normalizeName(patch.name)
    if (!name) throw new Error('해역 이름이 필요합니다.')
    next.name = name
  }
  if ('altName' in patch) {
    next.altName =
      patch.altName == null || String(patch.altName).trim() === ''
        ? null
        : String(patch.altName).trim()
  }
  if ('description' in patch) {
    next.description =
      patch.description == null || String(patch.description).trim() === ''
        ? null
        : String(patch.description).trim()
  }
  if ('category' in patch) {
    next.category =
      patch.category == null || String(patch.category).trim() === ''
        ? null
        : String(patch.category).trim()
  }
  if ('regions' in patch) {
    if (!Array.isArray(patch.regions)) {
      throw new Error('지역 형식이 올바르지 않습니다.')
    }
    next.regions = patch.regions
      .map((r) => String(r || '').trim())
      .filter(Boolean)
    next.region = next.regions[0] || null
  }
  for (const key of [
    'boundNorth',
    'boundWest',
    'boundSouth',
    'boundEast',
    'wave',
    'current',
  ]) {
    if (key in patch) {
      const raw = patch[key]
      if (raw == null || raw === '') {
        next[key] = null
      } else {
        const n = Number(raw)
        if (!Number.isFinite(n)) throw new Error(`${key} 값이 올바르지 않습니다.`)
        next[key] = n
      }
    }
  }
  if ('maxSpeedBonus' in patch) {
    next.maxSpeedBonus =
      patch.maxSpeedBonus == null || String(patch.maxSpeedBonus).trim() === ''
        ? null
        : String(patch.maxSpeedBonus).trim()
  }
  if ('places' in patch) {
    if (!Array.isArray(patch.places)) throw new Error('장소 형식이 올바르지 않습니다.')
    next.places = patch.places.map((item) => ({
      kind: String(item?.kind || ''),
      name: String(item?.name || ''),
    }))
  }
  if ('collectItems' in patch) {
    if (!Array.isArray(patch.collectItems)) {
      throw new Error('수집 아이템 형식이 올바르지 않습니다.')
    }
    next.collectItems = patch.collectItems.map((item) => ({
      source: String(item?.source || '기타'),
      name: String(item?.name || ''),
      rank:
        item?.rank == null || item?.rank === ''
          ? null
          : Number(item.rank),
      type: item?.type == null || item?.type === '' ? null : String(item.type),
      recommendSpot:
        item?.recommendSpot == null || item?.recommendSpot === ''
          ? null
          : String(item.recommendSpot),
      canExchange:
        typeof item?.canExchange === 'boolean' ? item.canExchange : null,
      canRelease:
        typeof item?.canRelease === 'boolean' ? item.canRelease : null,
    }))
  }
  if ('destinations' in patch) {
    if (!Array.isArray(patch.destinations)) {
      throw new Error('목적지 형식이 올바르지 않습니다.')
    }
    next.destinations = patch.destinations.map((item) => ({
      source: String(item?.source || '보물지도'),
      discovery: String(item?.discovery || ''),
      content: String(item?.content || ''),
    }))
  }
  if ('seaNpcs' in patch) {
    if (!Array.isArray(patch.seaNpcs)) {
      throw new Error('해상 NPC 형식이 올바르지 않습니다.')
    }
    next.seaNpcs = patch.seaNpcs.map((item) => ({
      fleetCount:
        item?.fleetCount == null || item?.fleetCount === ''
          ? null
          : Number(item.fleetCount),
      trait:
        item?.trait == null || item?.trait === ''
          ? null
          : String(item.trait),
      names: Array.isArray(item?.names)
        ? item.names.map(String)
        : String(item?.names || '')
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean),
    }))
  }

  const placesJson = JSON.stringify(next.places || [])
  const collectJson = JSON.stringify(next.collectItems || [])
  const destJson = JSON.stringify(next.destinations || [])
  const npcJson = JSON.stringify(next.seaNpcs || [])
  const regionsJson = JSON.stringify(next.regions || [])

  await sql`
    UPDATE sea_areas SET
      name = ${next.name},
      alt_name = ${next.altName},
      description = ${next.description},
      category = ${next.category},
      region = ${next.region},
      regions = ${regionsJson},
      bound_north = ${next.boundNorth},
      bound_west = ${next.boundWest},
      bound_south = ${next.boundSouth},
      bound_east = ${next.boundEast},
      wave = ${next.wave},
      current = ${next.current},
      max_speed_bonus = ${next.maxSpeedBonus},
      places = ${placesJson},
      collect_items = ${collectJson},
      destinations = ${destJson},
      sea_npcs = ${npcJson}
    WHERE id = ${seaAreaId}
  `

  return getSeaAreaById(seaAreaId)
}

/** @param {number} id */
export async function deleteSeaArea(id) {
  const sql = getSql()
  const seaAreaId = Number(id)
  if (!Number.isFinite(seaAreaId)) throw new Error('잘못된 해역 ID입니다.')
  const rows = await sql`
    UPDATE sea_areas SET enabled = FALSE
    WHERE id = ${seaAreaId} AND enabled = TRUE
    RETURNING id
  `
  if (!rows[0]) throw new Error('해역을 찾을 수 없습니다.')
  await bumpCatalogStat('sea_areas', -1)
  return { ok: true }
}

async function findIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug, enabled FROM sea_areas
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

/** 텍스트 파싱 결과로 해역 등록. 동일 이름이면 내용 갱신 */
export async function upsertSeaAreaFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeName(parsed.name)
  if (!name) throw new Error('해역 이름이 없습니다.')

  const existing = await findIdByName(sql, name)
  const regions = Array.isArray(parsed.regions)
    ? parsed.regions.map((r) => String(r || '').trim()).filter(Boolean)
    : parsed.region
      ? [String(parsed.region).trim()].filter(Boolean)
      : []
  const region = regions[0] || parsed.region || null
  const placesJson = JSON.stringify(parsed.places || [])
  const collectJson = JSON.stringify(parsed.collectItems || [])
  const destJson = JSON.stringify(parsed.destinations || [])
  const npcJson = JSON.stringify(parsed.seaNpcs || [])
  const regionsJson = JSON.stringify(regions)

  if (existing) {
    await sql`
      UPDATE sea_areas SET
        name = ${name},
        alt_name = ${parsed.altName ?? null},
        description = ${parsed.description ?? null},
        category = ${parsed.category},
        region = ${region},
        regions = ${regionsJson},
        bound_north = ${parsed.boundNorth},
        bound_west = ${parsed.boundWest},
        bound_south = ${parsed.boundSouth},
        bound_east = ${parsed.boundEast},
        wave = ${parsed.wave},
        current = ${parsed.current},
        max_speed_bonus = ${parsed.maxSpeedBonus},
        places = ${placesJson},
        collect_items = ${collectJson},
        destinations = ${destJson},
        sea_npcs = ${npcJson},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    await bumpCatalogStatIfGrew('sea_areas', existing.enabled)
    return getSeaAreaBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash = await sql`
      SELECT id FROM sea_areas WHERE slug = ${attempt} LIMIT 1
    `
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows = await sql`
    SELECT COALESCE(MAX(id), 0) AS max_id FROM sea_areas
  `
  const id = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM sea_areas
  `
  const sortOrder = Number(sortRows[0].max_sort) + 1

  await sql`
    INSERT INTO sea_areas (
      id, slug, name, alt_name, description, category, region, regions,
      bound_north, bound_west, bound_south, bound_east,
      wave, current, max_speed_bonus,
      places, collect_items, destinations, sea_npcs,
      enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${parsed.altName ?? null},
      ${parsed.description ?? null}, ${parsed.category}, ${region},
      ${regionsJson},
      ${parsed.boundNorth}, ${parsed.boundWest}, ${parsed.boundSouth},
      ${parsed.boundEast}, ${parsed.wave}, ${parsed.current},
      ${parsed.maxSpeedBonus},
      ${placesJson}, ${collectJson}, ${destJson}, ${npcJson},
      TRUE, ${sortOrder}
    )
  `

  await bumpCatalogStat('sea_areas', 1)
  return getSeaAreaBySlug(slug)
}
