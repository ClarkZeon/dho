import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

/**
 * @typedef {{
 *   id: string,
 *   username: string,
 *   nickname: string,
 *   passwordHash: string,
 *   salt: string,
 *   role: 'admin' | 'member',
 *   level: number,
 *   xp: number,
 *   lastLoginAt: string | null,
 *   createdAt: string
 * }} User
 */

/** @param {Record<string, unknown>} row */
function rowToUser(row) {
  const username = String(row.username)
  const role =
    row.role === 'admin' || username === 'admin' ? 'admin' : 'member'
  return {
    id: String(row.id),
    username,
    nickname: String(row.nickname),
    passwordHash: String(row.password_hash),
    salt: String(row.salt),
    role,
    level:
      Number.isFinite(Number(row.level)) && Number(row.level) >= 1
        ? Math.floor(Number(row.level))
        : 1,
    xp:
      Number.isFinite(Number(row.xp)) && Number(row.xp) >= 0
        ? Math.floor(Number(row.xp))
        : 0,
    lastLoginAt: row.last_login_at
      ? new Date(/** @type {string | Date} */ (row.last_login_at)).toISOString()
      : null,
    createdAt: new Date(
      /** @type {string | Date} */ (row.created_at),
    ).toISOString(),
  }
}

export async function ensureUserStore() {
  if (!hasDatabaseUrl()) {
    throw new Error(
      'DATABASE_URL 이 없습니다. Vercel Neon을 연결하거나 .env 에 DATABASE_URL 을 설정하세요.',
    )
  }
  await runSqlFile('sql/004_users_sessions.sql')
  await ensureAdminBootstrap()
}

async function ensureAdminBootstrap() {
  const sql = getSql()
  const admins = await sql`
    SELECT id FROM users WHERE role = 'admin' LIMIT 1
  `
  if (admins.length > 0) return

  const first = await sql`
    SELECT id FROM users ORDER BY created_at ASC LIMIT 1
  `
  if (first.length === 0) return

  await sql`
    UPDATE users SET role = 'admin' WHERE id = ${first[0].id}
  `
}

/** @returns {Promise<User[]>} */
export async function listUsers() {
  const sql = getSql()
  const rows = await sql`
    SELECT id, username, nickname, password_hash, salt, role, level, xp,
           last_login_at, created_at
    FROM users
    ORDER BY created_at ASC
  `
  return rows.map(rowToUser)
}

/** @param {string} id */
export async function getUserById(id) {
  const sql = getSql()
  const rows = await sql`
    SELECT id, username, nickname, password_hash, salt, role, level, xp,
           last_login_at, created_at
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `
  return rows[0] ? rowToUser(rows[0]) : null
}

/** @param {string} username */
export async function getUserByUsername(username) {
  const sql = getSql()
  const rows = await sql`
    SELECT id, username, nickname, password_hash, salt, role, level, xp,
           last_login_at, created_at
    FROM users
    WHERE username = ${username}
    LIMIT 1
  `
  return rows[0] ? rowToUser(rows[0]) : null
}

/** @param {string} nickname */
export async function getUserByNickname(nickname) {
  const sql = getSql()
  const rows = await sql`
    SELECT id, username, nickname, password_hash, salt, role, level, xp,
           last_login_at, created_at
    FROM users
    WHERE nickname = ${nickname}
    LIMIT 1
  `
  return rows[0] ? rowToUser(rows[0]) : null
}

/**
 * @param {string} q
 * @param {string} excludeUserId
 * @param {number} [limit]
 */
export async function searchUsers(q, excludeUserId, limit = 10) {
  const sql = getSql()
  const pattern = `%${q}%`
  const rows = await sql`
    SELECT id, username, nickname, level
    FROM users
    WHERE id <> ${excludeUserId}
      AND (username ILIKE ${pattern} OR nickname ILIKE ${pattern})
    ORDER BY username ASC
    LIMIT ${limit}
  `
  return rows.map((row) => ({
    id: String(row.id),
    username: String(row.username),
    nickname: String(row.nickname),
    level: Number(row.level) || 1,
  }))
}

/** @param {User} user */
export async function createUser(user) {
  const sql = getSql()
  try {
    await sql`
      INSERT INTO users (
        id, username, nickname, password_hash, salt, role, level, xp,
        last_login_at, created_at
      ) VALUES (
        ${user.id},
        ${user.username},
        ${user.nickname},
        ${user.passwordHash},
        ${user.salt},
        ${user.role},
        ${user.level},
        ${user.xp},
        ${user.lastLoginAt},
        ${user.createdAt}
      )
    `
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String(/** @type {{ code?: string }} */ (err).code)
        : ''
    const message = err instanceof Error ? err.message : String(err)
    if (code === '23505' || /duplicate key|unique constraint/i.test(message)) {
      if (/username/i.test(message)) throw new Error('USERNAME_TAKEN')
      if (/nickname/i.test(message)) throw new Error('NICKNAME_TAKEN')
      throw new Error('USERNAME_TAKEN')
    }
    throw err
  }
  return user
}

/** @param {User} user */
export async function updateUser(user) {
  const sql = getSql()
  await sql`
    UPDATE users SET
      nickname = ${user.nickname},
      password_hash = ${user.passwordHash},
      salt = ${user.salt},
      role = ${user.role},
      level = ${user.level},
      xp = ${user.xp},
      last_login_at = ${user.lastLoginAt}
    WHERE id = ${user.id}
  `
  return user
}

/**
 * 세션 추가 (기존 세션 유지 — 긴 로그인 수명 / 다중 기기)
 * @param {string} userId
 * @param {string} token
 * @param {string} createdAt
 */
export async function createSession(userId, token, createdAt) {
  const sql = getSql()
  await sql`
    INSERT INTO sessions (token, user_id, created_at)
    VALUES (${token}, ${userId}, ${createdAt})
  `
}

/** @param {string} token */
export async function deleteSessionByToken(token) {
  const sql = getSql()
  await sql`DELETE FROM sessions WHERE token = ${token}`
}

/** @param {string} userId */
export async function deleteSessionsByUserId(userId) {
  const sql = getSql()
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`
}

/** @param {string} userId */
export async function deleteUser(userId) {
  const sql = getSql()
  await deleteSessionsByUserId(userId)
  await sql`DELETE FROM users WHERE id = ${userId}`
}

/** @param {string} token */
export async function getAuthUserByToken(token) {
  const sql = getSql()
  const rows = await sql`
    SELECT u.id, u.username, u.nickname, u.password_hash, u.salt, u.role,
           u.level, u.xp, u.last_login_at, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token}
    LIMIT 1
  `
  return rows[0] ? rowToUser(rows[0]) : null
}
