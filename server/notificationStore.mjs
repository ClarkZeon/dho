import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

/**
 * @typedef {{
 *   id: string,
 *   userId: string,
 *   type: string,
 *   title: string,
 *   body: string,
 *   refType: string | null,
 *   refId: string | null,
 *   createdAt: string,
 *   seenAt: string | null,
 * }} Notification
 */

/** @param {Record<string, unknown>} row */
function rowToNotification(row) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: String(row.type),
    title: String(row.title),
    body: row.body == null ? '' : String(row.body),
    refType: row.ref_type == null ? null : String(row.ref_type),
    refId: row.ref_id == null ? null : String(row.ref_id),
    createdAt: new Date(
      /** @type {string|Date} */ (row.created_at),
    ).toISOString(),
    seenAt: row.seen_at
      ? new Date(/** @type {string|Date} */ (row.seen_at)).toISOString()
      : null,
  }
}

export async function ensureNotificationStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/023_notifications.sql')
}

/** @param {string} userId */
export async function countUnseenNotifications(userId) {
  const sql = getSql()
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM notifications
    WHERE user_id = ${userId} AND seen_at IS NULL
  `
  return Number(rows[0]?.n || 0)
}

/**
 * @param {string} userId
 * @param {{ limit?: number }} [opts]
 */
export async function listNotifications(userId, opts = {}) {
  const sql = getSql()
  const limit = Math.min(Math.max(Number(opts.limit) || 30, 1), 100)
  const rows = await sql`
    SELECT
      id, user_id, type, title, body, ref_type, ref_id,
      created_at, seen_at
    FROM notifications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows.map(rowToNotification)
}

/** @param {Omit<Notification, 'seenAt'> & { seenAt?: string | null }} note */
export async function insertNotification(note) {
  const sql = getSql()
  await sql`
    INSERT INTO notifications (
      id, user_id, type, title, body, ref_type, ref_id, created_at, seen_at
    ) VALUES (
      ${note.id}, ${note.userId}, ${note.type}, ${note.title},
      ${note.body || ''}, ${note.refType}, ${note.refId},
      ${note.createdAt}, ${note.seenAt ?? null}
    )
  `
  return note
}

/**
 * 종 클릭: 미확인 알림을 모두 확인 처리 (빨간점 제거)
 * @param {string} userId
 */
export async function markAllNotificationsSeen(userId) {
  const sql = getSql()
  const seenAt = new Date().toISOString()
  const rows = await sql`
    UPDATE notifications
    SET seen_at = ${seenAt}
    WHERE user_id = ${userId} AND seen_at IS NULL
    RETURNING id
  `
  return { seenAt, updated: rows.length }
}

/**
 * 쪽지 수신 알림 생성
 * @param {{
 *   id: string,
 *   toUserId: string,
 *   fromNickname: string,
 *   subject: string,
 *   messageId: string,
 *   createdAt?: string,
 * }} params
 */
export async function notifyMessageReceived(params) {
  const createdAt = params.createdAt || new Date().toISOString()
  return insertNotification({
    id: params.id,
    userId: params.toUserId,
    type: 'message',
    title: '새 쪽지',
    body: `${params.fromNickname} · ${params.subject}`.slice(0, 200),
    refType: 'message',
    refId: params.messageId,
    createdAt,
    seenAt: null,
  })
}
