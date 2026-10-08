import 'dotenv/config'
import { createServer } from 'node:http'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  canWriteBoard,
  createPost,
  decoratePost,
  ensureBoardStore,
  loadBoards,
  loadPosts,
  savePosts,
  validatePostBody,
  validatePostTitle,
} from './boardStore.mjs'
import { hasDatabaseUrl } from './db.mjs'
import { getWritableDataDir } from './paths.mjs'
import {
  ensureShipStore,
  getShipBySlug,
  listShipLookups,
  listShips,
} from './shipStore.mjs'
import {
  createUser,
  deleteSessionByToken,
  getAuthUserByToken,
  getUserByNickname,
  getUserByUsername,
  listUsers,
  createSession,
  searchUsers,
  updateUser,
  ensureUserStore,
} from './userStore.mjs'

const PORT = Number(process.env.API_PORT || 17778)
const DAILY_LOGIN_XP = 20

function messagesFile() {
  return path.join(getWritableDataDir(), 'messages.json')
}

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

async function ensureFile(file, fallback) {
  try {
    await readFile(file, 'utf8')
  } catch {
    await writeFile(file, fallback, 'utf8')
  }
}

async function ensureStore() {
  await mkdir(getWritableDataDir(), { recursive: true })
  await ensureFile(messagesFile(), '[]\n')
  await ensureBoardStore()
  await ensureShipStore()
  if (hasDatabaseUrl()) {
    await ensureUserStore()
  } else {
    console.warn(
      '[dho] DATABASE_URL 없음 — 인증은 Neon 연결 후 동작합니다. (.env.example 참고)',
    )
  }
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

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

async function writeJson(file, data) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

/** @returns {Promise<Message[]>} */
async function loadMessages() {
  return readJson(messagesFile())
}

/** @param {Message[]} messages */
async function saveMessages(messages) {
  await writeJson(messagesFile(), messages)
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
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
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
  }
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

    if (req.method === 'GET' && pathname === '/api/messages/unread-count') {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }

      const messages = await loadMessages()
      const count = messages.filter(
        (m) => m.toUserId === authUser.id && !m.readAt,
      ).length
      sendJson(res, 200, { count })
      return
    }

    if (req.method === 'GET' && pathname === '/api/messages/inbox') {
      const authUser = await getAuthUser(req)
      if (!authUser) {
        sendJson(res, 401, { error: '로그인이 필요합니다.' })
        return
      }

      const users = await listUsers()
      const messages = await loadMessages()
      const inbox = messages
        .filter((m) => m.toUserId === authUser.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((m) => decorateMessage(m, users, authUser.id))

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
      const messages = await loadMessages()
      const sent = messages
        .filter((m) => m.fromUserId === authUser.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((m) => decorateMessage(m, users, authUser.id))

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
      const messages = await loadMessages()
      const index = messages.findIndex((m) => m.id === messageId)
      if (index < 0) {
        sendJson(res, 404, { error: '쪽지를 찾을 수 없습니다.' })
        return
      }

      const message = messages[index]
      if (message.fromUserId !== authUser.id && message.toUserId !== authUser.id) {
        sendJson(res, 403, { error: '쪽지를 볼 권한이 없습니다.' })
        return
      }

      if (message.toUserId === authUser.id && !message.readAt) {
        messages[index] = { ...message, readAt: new Date().toISOString() }
        await saveMessages(messages)
      }

      const thread = messages
        .filter((m) => m.threadId === message.threadId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((m) => decorateMessage(m, users, authUser.id))

      sendJson(res, 200, {
        message: decorateMessage(messages[index], users, authUser.id),
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

      const messages = await loadMessages()
      messages.push(message)
      await saveMessages(messages)

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
      const messages = await loadMessages()
      const parent = messages.find((m) => m.id === parentId)
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

      messages.push(reply)
      await saveMessages(messages)

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
        const posts = (await loadPosts())
          .filter((p) => p.boardId === boardId && !p.isDeleted)
          .sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
            return b.createdAt.localeCompare(a.createdAt)
          })

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
        const posts = await loadPosts()
        posts.push(post)
        await savePosts(posts)

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
      const post = (await loadPosts()).find(
        (p) => p.id === postId && p.boardId === boardId && !p.isDeleted,
      )
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

    sendJson(res, 404, { error: 'Not found' })
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
