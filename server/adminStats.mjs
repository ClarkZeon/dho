import { getSql } from './db.mjs'

function asCount(rows) {
  return Number(rows?.[0]?.n) || 0
}

/** 관리자 대시보드용 건수 — COUNT만 수행 */
export async function loadAdminCatalogCounts() {
  const sql = getSql()
  const [
    users,
    ships,
    quests,
    ports,
    discoveries,
    languages,
    materials,
    featureRequests,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM users`,
    sql`SELECT COUNT(*)::int AS n FROM ships WHERE enabled = TRUE`,
    sql`SELECT COUNT(*)::int AS n FROM quests WHERE enabled = TRUE`,
    sql`SELECT COUNT(*)::int AS n FROM ports WHERE enabled = TRUE`,
    sql`SELECT COUNT(*)::int AS n FROM discoveries WHERE enabled = TRUE`,
    sql`SELECT COUNT(*)::int AS n FROM library_languages WHERE enabled = TRUE`,
    sql`SELECT COUNT(*)::int AS n FROM ship_materials WHERE enabled = TRUE`,
    sql`
      SELECT COUNT(*)::int AS n FROM posts
      WHERE board_id = 'feature' AND is_deleted = FALSE
    `,
  ])

  return {
    users: asCount(users),
    ships: asCount(ships),
    quests: asCount(quests),
    ports: asCount(ports),
    discoveries: asCount(discoveries),
    languages: asCount(languages),
    materials: asCount(materials),
    featureRequests: asCount(featureRequests),
  }
}
