import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

/**
 * @typedef {{
 *   id: string,
 *   fromUserId: string,
 *   toUserId: string,
 *   subject: string,
 *   body: string,
 *   parentId: string | null,
 *   threadId: string,
 *   readAt: string | null,
 *   createdAt: string
 * }} Message
 */

/** @param {Record<string, unknown>} row */
function rowToMessage(row) {
  return {
    id: String(row.id),
    fromUserId: String(row.from_user_id),
    toUserId: String(row.to_user_id),
    subject: String(row.subject),
    body: String(row.body),
    parentId: row.parent_id == null ? null : String(row.parent_id),
    threadId: String(row.thread_id),
    readAt: row.read_at
      ? new Date(/** @type {string|Date} */ (row.read_at)).toISOString()
      : null,
    createdAt: new Date(
      /** @type {string|Date} */ (row.created_at),
    ).toISOString(),
  }
}

export async function ensureMessageStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/005_boards_messages.sql')
}

/** @param {string} userId */
export async function countUnread(userId) {
  const sql = getSql()
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM messages
    WHERE to_user_id = ${userId} AND read_at IS NULL
  `
  return Number(rows[0]?.n || 0)
}

/** @param {string} userId */
export async function listInbox(userId) {
  const sql = getSql()
  const rows = await sql`
    SELECT id, from_user_id, to_user_id, subject, body, parent_id, thread_id,
           read_at, created_at
    FROM messages
    WHERE to_user_id = ${userId}
    ORDER BY created_at DESC
  `
  return rows.map(rowToMessage)
}

/** @param {string} userId */
export async function listSent(userId) {
  const sql = getSql()
  const rows = await sql`
    SELECT id, from_user_id, to_user_id, subject, body, parent_id, thread_id,
           read_at, created_at
    FROM messages
    WHERE from_user_id = ${userId}
    ORDER BY created_at DESC
  `
  return rows.map(rowToMessage)
}

/** @param {string} id */
export async function getMessageById(id) {
  const sql = getSql()
  const rows = await sql`
    SELECT id, from_user_id, to_user_id, subject, body, parent_id, thread_id,
           read_at, created_at
    FROM messages
    WHERE id = ${id}
    LIMIT 1
  `
  return rows[0] ? rowToMessage(rows[0]) : null
}

/** @param {string} threadId */
export async function listThread(threadId) {
  const sql = getSql()
  const rows = await sql`
    SELECT id, from_user_id, to_user_id, subject, body, parent_id, thread_id,
           read_at, created_at
    FROM messages
    WHERE thread_id = ${threadId}
    ORDER BY created_at ASC
  `
  return rows.map(rowToMessage)
}

/** @param {Message} message */
export async function insertMessage(message) {
  const sql = getSql()
  await sql`
    INSERT INTO messages (
      id, from_user_id, to_user_id, subject, body, parent_id, thread_id,
      read_at, created_at
    ) VALUES (
      ${message.id}, ${message.fromUserId}, ${message.toUserId},
      ${message.subject}, ${message.body}, ${message.parentId},
      ${message.threadId}, ${message.readAt}, ${message.createdAt}
    )
  `
  return message
}

/** @param {string} id @param {string} readAt */
export async function markMessageRead(id, readAt) {
  const sql = getSql()
  await sql`
    UPDATE messages SET read_at = ${readAt}
    WHERE id = ${id} AND read_at IS NULL
  `
}
