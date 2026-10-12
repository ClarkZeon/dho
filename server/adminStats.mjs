import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export const CATALOG_STAT_KEYS = [
  'users',
  'ships',
  'quests',
  'ports',
  'discoveries',
  'languages',
  'fields',
  'materials',
  'consumables',
  'feature_requests',
]

function asCount(rows) {
  return Number(rows?.[0]?.n) || 0
}

/** API 응답 키 (feature_requests → featureRequests) */
function toResponseCounts(map) {
  return {
    users: map.users || 0,
    ships: map.ships || 0,
    quests: map.quests || 0,
    ports: map.ports || 0,
    discoveries: map.discoveries || 0,
    languages: map.languages || 0,
    fields: map.fields || 0,
    materials: map.materials || 0,
    consumables: map.consumables || 0,
    featureRequests: map.feature_requests || 0,
  }
}

/** 실제 테이블 COUNT로 캐시 덮어쓰기 */
export async function reconcileCatalogStats() {
  const sql = getSql()
  const [
    users,
    ships,
    quests,
    ports,
    discoveries,
    languages,
    fields,
    materials,
    consumables,
    featureRequests,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM users`,
    sql`SELECT COUNT(*)::int AS n FROM ships WHERE enabled = TRUE`,
    sql`SELECT COUNT(*)::int AS n FROM quests WHERE enabled = TRUE`,
    sql`SELECT COUNT(*)::int AS n FROM ports WHERE enabled = TRUE`,
    sql`SELECT COUNT(*)::int AS n FROM discoveries WHERE enabled = TRUE`,
    sql`SELECT COUNT(*)::int AS n FROM library_languages WHERE enabled = TRUE`,
    sql`SELECT COUNT(*)::int AS n FROM fields WHERE enabled = TRUE`,
    sql`SELECT COUNT(*)::int AS n FROM ship_materials WHERE enabled = TRUE`,
    sql`SELECT COUNT(*)::int AS n FROM consumables WHERE enabled = TRUE`,
    sql`
      SELECT COUNT(*)::int AS n FROM posts
      WHERE board_id = 'feature' AND is_deleted = FALSE
    `,
  ])

  const values = {
    users: asCount(users),
    ships: asCount(ships),
    quests: asCount(quests),
    ports: asCount(ports),
    discoveries: asCount(discoveries),
    languages: asCount(languages),
    fields: asCount(fields),
    materials: asCount(materials),
    consumables: asCount(consumables),
    feature_requests: asCount(featureRequests),
  }

  for (const key of CATALOG_STAT_KEYS) {
    await sql`
      INSERT INTO catalog_stats (stat_key, count, updated_at)
      VALUES (${key}, ${values[key]}, NOW())
      ON CONFLICT (stat_key) DO UPDATE SET
        count = EXCLUDED.count,
        updated_at = NOW()
    `
  }

  return toResponseCounts(values)
}

export async function ensureCatalogStats() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/017_catalog_stats.sql')
  return reconcileCatalogStats()
}

/**
 * @param {string} key
 * @param {number} delta
 */
export async function bumpCatalogStat(key, delta) {
  if (!CATALOG_STAT_KEYS.includes(key)) return
  const n = Number(delta)
  if (!Number.isFinite(n) || n === 0) return
  try {
    const sql = getSql()
    await sql`
      INSERT INTO catalog_stats (stat_key, count, updated_at)
      VALUES (${key}, GREATEST(0, ${n}), NOW())
      ON CONFLICT (stat_key) DO UPDATE SET
        count = GREATEST(0, catalog_stats.count + ${n}),
        updated_at = NOW()
    `
  } catch (err) {
    console.warn('[catalog_stats] bump failed', key, delta, err)
  }
}

/** 신규 생성 또는 disabled→enabled 재활성일 때만 +1 */
export async function bumpCatalogStatIfGrew(key, wasEnabled) {
  if (wasEnabled === true) return
  await bumpCatalogStat(key, 1)
}

/** 관리자 대시보드용 건수 — 캐시 테이블 조회 */
export async function loadAdminCatalogCounts() {
  const sql = getSql()
  try {
    const rows = await sql`
      SELECT stat_key, count FROM catalog_stats
    `
    if (!rows.length) {
      return reconcileCatalogStats()
    }
    /** @type {Record<string, number>} */
    const map = {}
    for (const row of rows) {
      map[String(row.stat_key)] = Number(row.count) || 0
    }
    for (const key of CATALOG_STAT_KEYS) {
      if (map[key] == null) {
        return reconcileCatalogStats()
      }
    }
    return toResponseCounts(map)
  } catch {
    return reconcileCatalogStats()
  }
}
