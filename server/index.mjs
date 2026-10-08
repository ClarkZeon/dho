import 'dotenv/config'
import { createServer } from 'node:http'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import {
  canWriteBoard,
  createPost,
  decoratePost,
  ensureBoardStore,
  getPost,
  insertPost,
  listPostsForBoard,
  loadBoards,
  loadPosts,
  validatePostBody,
  validatePostTitle,
} from './boardStore.mjs'
import { hasDatabaseUrl } from './db.mjs'
import {
  countUnread,
  ensureMessageStore,
  getMessageById,
  insertMessage,
  listInbox,
  listSent,
  listThread,
  markMessageRead,
} from './messageStore.mjs'
import {
  ensureShipStore,
  getShipBySlug,
  listShipLookups,
  listShips,
  upsertShipFromParsed,
} from './shipStore.mjs'
import { parseShipText } from './shipTextParse.mjs'
import {
  ensureQuestStore,
  listQuests,
  upsertQuestFromParsed,
} from './questStore.mjs'
import { parseQuestText } from './questTextParse.mjs'
import {
  createUser,
  deleteSessionByToken,
  getAuthUserByToken,
  getUserByNickname,
  getUserByUsername,
  listUsers,
  createSession,
  deleteUser,
  getUserById,
  searchUsers,
  updateUser,
  ensureUserStore,
} from './userStore.mjs'

const PORT = Number(process.env.API_PORT || 17778)
const DAILY_LOGIN_XP = 20

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
 *
 * @typedef {{ token: string, userId: string, createdAt: string }} Session
 *
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

async function ensureStore() {
  if (!hasDatabaseUrl()) {
    throw new Error(
      'DATABASE_URL 이 없습니다. Vercel Neon을 연결하거나 .env 에 DATABASE_URL 을 설정하세요.',
    )
  }
  await ensureUserStore()
  await ensureBoardStore()
  await ensureMessageStore()
  await ensureShipStore()
  await ensureQuestStore()
}

function requireAuthDb(res) {
  if (hasDatabaseUrl()) return true
  sendJson(res, 503, {
    error:
      '계정 DB(DATABASE_URL)가 설정되지 않았습니다. Vercel Storage에서 Neon을 연결하세요.',
  })
  return false
}

function xpNeeded(level) {
  return Math.max(1, level) * 100
}

/** @param {Partial<User>} user */
function normalizeUser(user) {
  const role =
    user.role === 'admin' || user.username === 'admin' ? 'admin' : 'member'
  return {
    ...user,
    role,
    level: Number.isFinite(user.level) && user.level >= 1 ? Math.floor(user.level) : 1,
    xp: Number.isFinite(user.xp) && user.xp >= 0 ? Math.floor(user.xp) : 0,
    lastLoginAt: typeof user.lastLoginAt === 'string' ? user.lastLoginAt : null,
  }
}

/**
 * @param {User} user
 * @param {number} amount
 */
function grantXp(user, amount) {
  let level = user.level
  let xp = user.xp + amount
  let gainedLevels = 0

  while (xp >= xpNeeded(level)) {
    xp -= xpNeeded(level)
    level += 1
    gainedLevels += 1
  }

  return {
    user: { ...user, level, xp },
    gainedLevels,
  }
}

function sameUtcDay(a, b) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt)
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(expectedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end(payload)
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function publicUser(user) {
  const level = user.level
  const xp = user.xp
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role || 'member',
    level,
    xp,
    xpToNext: xpNeeded(level),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
  }
}

/** @param {import('./userStore.mjs').User | { role?: string }} authUser */
function requireAdmin(authUser, res) {
  if (!authUser) {
    sendJson(res, 401, { error: '로그인이 필요합니다.' })
    return false
  }
  if (authUser.role !== 'admin') {
    sendJson(res, 403, { error: '관리자만 접근할 수 있습니다.' })
    return false
  }
  return true
}

function getBearerToken(req) {
  const header = req.headers.authorization
  if (!header || typeof header !== 'string') return null
  const [type, token] = header.split(' ')
  if (type !== 'Bearer' || !token) return null
  return token
}

async function getAuthUser(req) {
  if (!hasDatabaseUrl()) return null
  const token = getBearerToken(req)
  if (!token) return null
  return getAuthUserByToken(token)
}

function validateUsername(username) {
  if (typeof username !== 'string') return '아이디를 입력하세요.'
  const value = username.trim()
  if (value.length < 4 || value.length > 20) return '아이디는 4~20자로 입력하세요.'
  if (!/^[a-zA-Z0-9_]+$/.test(value)) return '아이디는 영문, 숫자, _ 만 사용할 수 있습니다.'
  return null
}

function validatePassword(password) {
  if (typeof password !== 'string') return '비밀번호를 입력하세요.'
  if (password.length < 8 || password.length > 64) return '비밀번호는 8~64자로 입력하세요.'
  return null
}

function validateNickname(nickname) {
  if (typeof nickname !== 'string') return '닉네임을 입력하세요.'
  const value = nickname.trim()
  if (value.length < 2 || value.length > 16) return '닉네임은 2~16자로 입력하세요.'
  return null
}

function validateSubject(subject) {
  if (typeof subject !== 'string') return '제목을 입력하세요.'
  const value = subject.trim()
  if (value.length < 1 || value.length > 60) return '제목은 1~60자로 입력하세요.'
  return null
}

function validateBody(body) {
  if (typeof body !== 'string') return '내용을 입력하세요.'
  const value = body.trim()
  if (value.length < 1 || value.length > 2000) return '내용은 1~2000자로 입력하세요.'
  return null
}

function findUserByHandle(users, handle) {
  const value = String(handle || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
  if (!value) return null
  return (
    users.find((u) => u.username === value) ||
    users.find((u) => u.nickname.toLowerCase() === value) ||
    null
  )
}

function decorateMessage(message, users, currentUserId) {
  const from = users.find((u) => u.id === message.fromUserId)
  const to = users.find((u) => u.id === message.toUserId)
  return {
    id: message.id,
    subject: message.subject,
    body: message.body,
    parentId: message.parentId,
    threadId: message.threadId,
    createdAt: message.createdAt,
    readAt: message.readAt,
    isRead: Boolean(message.readAt) || message.fromUserId === currentUserId,
    from: from
      ? { id: from.id, username: from.username, nickname: from.nickname }
      : { id: message.fromUserId, username: 'unknown', nickname: '알 수 없음' },
    to: to
      ? { id: to.id, username: to.username, nickname: to.nickname }
      : { id: message.toUserId, username: 'unknown', nickname: '알 수 없음' },
  }
}

let storeReady = null

export async function ensureReady() {
  if (!storeReady) storeReady = ensureStore()
  await storeReady
}

export async function handleRequest(req, res) {
  try {
    await ensureReady()

    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {})
      return
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const { pathname } = url

    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        authDb: hasDatabaseUrl() ? 'configured' : 'missing',
      })
      return
    }

    if (req.method === 'POST' && pathname === '/api/auth/signup') {
      if (!requireAuthDb(res)) return
      const body = await readBody(req)
      const usernameError = validateUsername(body.username)
      const passwordError = validatePassword(body.password)
      const nicknameError = validateNickname(body.nickname)

      if (usernameError || passwordError || nicknameError) {
        sendJson(res, 400, {
          error: usernameError || passwordError || nicknameError,
        })
        return
      }

      if (body.password !== body.passwordConfirm) {
        sendJson(res, 400, { error: '비밀번호 확인이 일치하지 않습니다.' })
        return
      }

      const username = String(body.username).trim().toLowerCase()
      const nickname = String(body.nickname).trim()

      if (await getUserByUsername(username)) {
        sendJson(res, 409, { error: '이미 사용 중인 아이디입니다.' })
        return
      }

      if (await getUserByNickname(nickname)) {
        sendJson(res, 409, { error: '이미 사용 중인 닉네임입니다.' })
        return
      }

      const { hash, salt } = hashPassword(body.password)
      const user = normalizeUser({
        id: randomBytes(8).toString('hex'),
        username,
        nickname,
        passwordHash: hash,
        salt,
        role: username === 'admin' ? 'admin' : 'member',
        level: 1,
        xp: 0,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
      })

      try {
        await createUser(user)
      } catch (err) {
        if (err instanceof Error && err.message === 'USERNAME_TAKEN') {
          sendJson(res, 409, { error: '이미 사용 중인 아이디입니다.' })
          return
        }
        if (err instanceof Error && err.message === 'NICKNAME_TAKEN') {
          sendJson(res, 409, { error: '이미 사용 중인 닉네임입니다.' })
          return
        }
        throw err
      }
      sendJson(res, 201, { user: publicUser(user) })
      return
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      if (!requireAuthDb(res)) return
      const body = await readBody(req)
      const usernameError = validateUsername(body.username)
      const passwordError = validatePassword(body.password)

      if (usernameError || passwordError) {
        sendJson(res, 400, { error: usernameError || passwordError })
        return
      }

      const username = String(body.username).trim().toLowerCase()
      const found = await getUserByUsername(username)

      if (!found || !verifyPassword(body.password, found.salt, found.passwordHash)) {
        sendJson(res, 401, { error: '아이디 또는 비밀번호가 올바르지 않습니다.' })
        return
      }

      let user = normalizeUser(found)
      let dailyXp = 0
      let gainedLevels = 0
      const now = new Date()
      const last = user.lastLoginAt ? new Date(user.lastLoginAt) : null
      const canClaimDaily = !last || Number.isNaN(last.getTime()) || !sameUtcDay(last, now)

      if (canClaimDaily) {
        const rewarded = grantXp(user, DAILY_LOGIN_XP)
        user = rewarded.user
        dailyXp = DAILY_LOGIN_XP
        gainedLevels = rewarded.gainedLevels
      }

      user = {
        ...user,
        lastLoginAt: now.toISOString(),
      }
      await updateUser(user)

      const token = randomBytes(24).toString('hex')
      await createSession(user.id, token, now.toISOString())

      sendJson(res, 200, {
        user: publicUser(user),
        token,
        reward: {
          dailyXp,
          gainedLevels,
        },
      })
      return
    }

    if (req.method === 'GET' && pathname === '/api/auth/me') {
      if (!requireAuthDb(res)) return
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }
      sendJson(res, 200, { user: publicUser(authUser) })
      return
    }

    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      const token = getBearerToken(req)
      if (token) {
        await deleteSessionByToken(token)
      }
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'GET' && pathname === '/api/users/search') {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }

      const q = (url.searchParams.get('q') || '').trim().toLowerCase()
      if (q.length < 1) {
        sendJson(res, 200, { users: [] })
        return
      }

      const matched = await searchUsers(q, authUser.id, 10)
      sendJson(res, 200, { users: matched })
      return
    }

    if (req.method === 'GET' && pathname === '/api/admin/users') {
      const authUser = await getAuthUser(req)
      if (!requireAdmin(authUser, res)) return
      const users = await listUsers()
      sendJson(res, 200, {
        users: users.map((u) => publicUser(u)),
      })
      return
    }

    const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
    if (adminUserMatch && (req.method === 'PATCH' || req.method === 'DELETE')) {
      const authUser = await getAuthUser(req)
      if (!requireAdmin(authUser, res)) return

      const targetId = decodeURIComponent(adminUserMatch[1])
      const target = await getUserById(targetId)
      if (!target) {
        sendJson(res, 404, { error: '사용자를 찾을 수 없습니다.' })
        return
      }

      const allUsers = await listUsers()
      const adminCount = allUsers.filter((u) => u.role === 'admin').length

      if (req.method === 'PATCH') {
        const body = await readBody(req)
        const nextRole = body.role === 'admin' ? 'admin' : body.role === 'member' ? 'member' : null
        if (!nextRole) {
          sendJson(res, 400, { error: '역할은 admin 또는 member 여야 합니다.' })
          return
        }
        if (target.id === authUser.id && nextRole !== 'admin') {
          sendJson(res, 400, { error: '자신의 관리자 권한은 해제할 수 없습니다.' })
          return
        }
        if (target.role === 'admin' && nextRole === 'member' && adminCount <= 1) {
          sendJson(res, 400, { error: '마지막 관리자의 역할은 변경할 수 없습니다.' })
          return
        }
        target.role = nextRole
        await updateUser(target)
        sendJson(res, 200, { user: publicUser(target) })
        return
      }

      if (target.id === authUser.id) {
        sendJson(res, 400, { error: '자신의 계정은 삭제할 수 없습니다.' })
        return
      }
      if (target.role === 'admin' && adminCount <= 1) {
        sendJson(res, 400, { error: '마지막 관리자는 삭제할 수 없습니다.' })
        return
      }
      await deleteUser(target.id)
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'GET' && pathname === '/api/messages/unread-count') {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }

      sendJson(res, 200, { count: await countUnread(authUser.id) })
      return
    }

    if (req.method === 'GET' && pathname === '/api/messages/inbox') {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }

      const users = await listUsers()
      const inbox = (await listInbox(authUser.id)).map((m) =>
        decorateMessage(m, users, authUser.id),
      )

      sendJson(res, 200, { messages: inbox })
      return
    }

    if (req.method === 'GET' && pathname === '/api/messages/sent') {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }

      const users = await listUsers()
      const sent = (await listSent(authUser.id)).map((m) =>
        decorateMessage(m, users, authUser.id),
      )

      sendJson(res, 200, { messages: sent })
      return
    }

    const messageMatch = pathname.match(/^\/api\/messages\/([^/]+)$/)
    if (req.method === 'GET' && messageMatch) {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }

      const messageId = messageMatch[1]
      const users = await listUsers()
      const message = await getMessageById(messageId)
      if (!message) {
        sendJson(res, 404, { error: '쪽지를 찾을 수 없습니다.' })
        return
      }

      if (message.fromUserId !== authUser.id && message.toUserId !== authUser.id) {
        sendJson(res, 403, { error: '쪽지를 볼 권한이 없습니다.' })
        return
      }

      if (message.toUserId === authUser.id && !message.readAt) {
        const readAt = new Date().toISOString()
        await markMessageRead(message.id, readAt)
        message.readAt = readAt
      }

      const thread = (await listThread(message.threadId)).map((m) =>
        decorateMessage(m, users, authUser.id),
      )

      sendJson(res, 200, {
        message: decorateMessage(message, users, authUser.id),
        thread,
      })
      return
    }

    if (req.method === 'POST' && pathname === '/api/messages') {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }

      const body = await readBody(req)
      const subjectError = validateSubject(body.subject)
      const bodyError = validateBody(body.body)
      if (subjectError || bodyError) {
        sendJson(res, 400, { error: subjectError || bodyError })
        return
      }

      const users = await listUsers()
      const toUser = findUserByHandle(users, body.to)
      if (!toUser) {
        sendJson(res, 404, { error: '받는 사람을 찾을 수 없습니다.' })
        return
      }
      if (toUser.id === authUser.id) {
        sendJson(res, 400, { error: '자신에게는 쪽지를 보낼 수 없습니다.' })
        return
      }

      const id = randomBytes(8).toString('hex')
      const message = {
        id,
        fromUserId: authUser.id,
        toUserId: toUser.id,
        subject: String(body.subject).trim(),
        body: String(body.body).trim(),
        parentId: null,
        threadId: id,
        readAt: null,
        createdAt: new Date().toISOString(),
      }

      await insertMessage(message)

      sendJson(res, 201, {
        message: decorateMessage(message, users, authUser.id),
      })
      return
    }

    const replyMatch = pathname.match(/^\/api\/messages\/([^/]+)\/reply$/)
    if (req.method === 'POST' && replyMatch) {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }

      const body = await readBody(req)
      const bodyError = validateBody(body.body)
      if (bodyError) {
        sendJson(res, 400, { error: bodyError })
        return
      }

      const parentId = replyMatch[1]
      const users = await listUsers()
      const parent = await getMessageById(parentId)
      if (!parent) {
        sendJson(res, 404, { error: '원본 쪽지를 찾을 수 없습니다.' })
        return
      }

      if (parent.fromUserId !== authUser.id && parent.toUserId !== authUser.id) {
        sendJson(res, 403, { error: '답장할 권한이 없습니다.' })
        return
      }

      const toUserId =
        parent.fromUserId === authUser.id ? parent.toUserId : parent.fromUserId
      if (toUserId === authUser.id) {
        sendJson(res, 400, { error: '답장 대상을 확인할 수 없습니다.' })
        return
      }

      const subject = parent.subject.startsWith('Re:')
        ? parent.subject
        : `Re: ${parent.subject}`

      const id = randomBytes(8).toString('hex')
      const reply = {
        id,
        fromUserId: authUser.id,
        toUserId,
        subject,
        body: String(body.body).trim(),
        parentId: parent.id,
        threadId: parent.threadId,
        readAt: null,
        createdAt: new Date().toISOString(),
      }

      await insertMessage(reply)

      sendJson(res, 201, {
        message: decorateMessage(reply, users, authUser.id),
      })
      return
    }

    if (req.method === 'GET' && pathname === '/api/ships') {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }
      const ships = await listShips()
      sendJson(res, 200, { ships })
      return
    }

    if (req.method === 'GET' && pathname === '/api/ships/lookups') {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }
      sendJson(res, 200, await listShipLookups())
      return
    }

    if (req.method === 'POST' && pathname === '/api/ships/import-text') {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }
      if (!requireAdmin(authUser, res)) return
      const body = await readBody(req)
      const text = typeof body.text === 'string' ? body.text : ''
      try {
        const parsed = parseShipText(text)
        const ship = await upsertShipFromParsed(parsed)
        sendJson(res, 201, { ship })
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : '선박 텍스트 파싱에 실패했습니다.',
        })
      }
      return
    }

    if (req.method === 'GET' && pathname === '/api/quests') {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }
      const quests = await listQuests()
      sendJson(res, 200, { quests })
      return
    }

    if (req.method === 'POST' && pathname === '/api/quests/import-text') {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }
      if (!requireAdmin(authUser, res)) return
      const body = await readBody(req)
      const text = typeof body.text === 'string' ? body.text : ''
      try {
        const parsed = parseQuestText(text)
        const quest = await upsertQuestFromParsed(parsed)
        sendJson(res, 201, { quest })
      } catch (err) {
        sendJson(res, 400, {
          error:
            err instanceof Error ? err.message : '퀘스트 텍스트 파싱에 실패했습니다.',
        })
      }
      return
    }

    const shipMatch = pathname.match(/^\/api\/ships\/([^/]+)$/)
    if (req.method === 'GET' && shipMatch) {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }
      const ship = await getShipBySlug(decodeURIComponent(shipMatch[1]))
      if (!ship) {
        sendJson(res, 404, { error: '선박을 찾을 수 없습니다.' })
        return
      }
      sendJson(res, 200, { ship })
      return
    }

    if (req.method === 'GET' && pathname === '/api/boards') {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }

      const boards = await loadBoards()
      const preview = url.searchParams.get('preview') === '1'
      const posts = preview ? await loadPosts() : []
      const users = preview ? await listUsers() : []

      sendJson(res, 200, {
        boards: boards.map((board) => {
          const item = {
            id: board.id,
            title: board.title,
            description: board.description,
            writeRole: board.writeRole,
            previewCount: board.previewCount,
            canWrite: canWriteBoard(board, authUser),
          }

          if (preview) {
            item.posts = posts
              .filter((p) => p.boardId === board.id && !p.isDeleted)
              .sort((a, b) => {
                if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
                return b.createdAt.localeCompare(a.createdAt)
              })
              .slice(0, board.previewCount || 5)
              .map((p) => decoratePost(p, users))
          }

          return item
        }),
      })
      return
    }

    const boardPostsMatch = pathname.match(/^\/api\/boards\/([^/]+)\/posts$/)
    if (boardPostsMatch) {
      const boardId = boardPostsMatch[1]
      const boards = await loadBoards()
      const board = boards.find((b) => b.id === boardId)
      if (!board) {
        sendJson(res, 404, { error: '게시판을 찾을 수 없습니다.' })
        return
      }

      if (req.method === 'GET') {
        const authUser = await getAuthUser(req)
        if (!authUser) {
          sendJson(res, 401, { error: '로그인이 필요합니다.' })
          return
        }

        const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 20)))
        const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))
        const users = await listUsers()
        const posts = await listPostsForBoard(boardId)

        sendJson(res, 200, {
          board: {
            id: board.id,
            title: board.title,
            description: board.description,
            writeRole: board.writeRole,
            canWrite: canWriteBoard(board, authUser),
          },
          total: posts.length,
          posts: posts.slice(offset, offset + limit).map((p) => decoratePost(p, users)),
        })
        return
      }

      if (req.method === 'POST') {
        const authUser = await getAuthUser(req)
        if (!authUser) {
          sendJson(res, 401, { error: '로그인이 필요합니다.' })
          return
        }
        if (!canWriteBoard(board, authUser)) {
          sendJson(res, 403, { error: '이 게시판에 글을 쓸 권한이 없습니다.' })
          return
        }

        const body = await readBody(req)
        const titleError = validatePostTitle(body.title)
        const bodyError = validatePostBody(body.body)
        if (titleError || bodyError) {
          sendJson(res, 400, { error: titleError || bodyError })
          return
        }

        const users = await listUsers()
        const post = createPost({
          boardId,
          authorId: authUser.id,
          title: body.title,
          body: body.body,
          isPinned: Boolean(body.isPinned) && authUser.role === 'admin',
        })
        await insertPost(post)

        sendJson(res, 201, { post: decoratePost(post, users) })
        return
      }
    }

    const postDetailMatch = pathname.match(/^\/api\/boards\/([^/]+)\/posts\/([^/]+)$/)
    if (req.method === 'GET' && postDetailMatch) {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }

      const [, boardId, postId] = postDetailMatch
      const boards = await loadBoards()
      const board = boards.find((b) => b.id === boardId)
      if (!board) {
        sendJson(res, 404, { error: '게시판을 찾을 수 없습니다.' })
        return
      }

      const users = await listUsers()
      const post = await getPost(boardId, postId)
      if (!post) {
        sendJson(res, 404, { error: '게시글을 찾을 수 없습니다.' })
        return
      }

      sendJson(res, 200, {
        board: {
          id: board.id,
          title: board.title,
          description: board.description,
          canWrite: canWriteBoard(board, authUser),
        },
        post: decoratePost(post, users),
      })
      return
    }

    sendJson(res, 404, { error: `요청한 API를 찾을 수 없습니다. (${req.method} ${pathname})` })
  } catch (error) {
    console.error(error)
    sendJson(res, 500, { error: '서버 오류가 발생했습니다.' })
  }
}

if (!process.env.VERCEL) {
  await ensureReady()
  const server = createServer((req, res) => {
    void handleRequest(req, res)
  })
  server.listen(PORT, () => {
    console.log(`DHO API listening on http://localhost:${PORT}`)
  })
}
