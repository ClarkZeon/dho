import { randomBytes } from 'node:crypto'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   writeRole: 'admin' | 'member' | 'none',
 *   previewCount: number,
 *   sortOrder: number,
 *   enabled: boolean
 * }} Board
 *
 * @typedef {{
 *   id: string,
 *   boardId: string,
 *   authorId: string,
 *   title: string,
 *   body: string,
 *   isPinned: boolean,
 *   isDeleted: boolean,
 *   createdAt: string,
 *   updatedAt: string
 * }} Post
 */

const DEFAULT_BOARDS = [
  {
    id: 'notice',
    title: '공지',
    description: '운영·점검·업데이트 안내',
    writeRole: 'admin',
    previewCount: 5,
    sortOrder: 1,
    enabled: true,
  },
  {
    id: 'free',
    title: '자유',
    description: '잡담과 일상 이야기',
    writeRole: 'member',
    previewCount: 5,
    sortOrder: 2,
    enabled: true,
  },
  {
    id: 'guide',
    title: '공략',
    description: '항해·교역·전투 팁',
    writeRole: 'member',
    previewCount: 5,
    sortOrder: 3,
    enabled: true,
  },
]

/** 시드 게시글 ID 고정 — 인스턴스마다 랜덤 ID가 바뀌지 않게 */
const SEED_POSTS = [
  {
    id: 'seed-notice-open',
    boardId: 'notice',
    authorId: 'system',
    title: 'DHO Light 오픈 안내',
    body: 'DHO Light에 오신 것을 환영합니다.\n\n공지·자유·공략 게시판과 쪽지·선박 도구를 이용할 수 있습니다.',
    isPinned: true,
  },
  {
    id: 'seed-notice-features',
    boardId: 'notice',
    authorId: 'system',
    title: '쪽지·레벨 기능 안내',
    body: '로그인 후 쪽지함과 레벨(일일 XP)을 이용할 수 있습니다.\n자세한 규칙은 docs 폴더의 문서를 참고해 주세요.',
    isPinned: false,
  },
]

function nowIso() {
  return new Date().toISOString()
}

/** @param {Record<string, unknown>} row */
function rowToBoard(row) {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description || ''),
    writeRole:
      row.write_role === 'admin' || row.write_role === 'none'
        ? row.write_role
        : 'member',
    previewCount: Number(row.preview_count) || 5,
    sortOrder: Number(row.sort_order) || 0,
    enabled: row.enabled !== false,
  }
}

/** @param {Record<string, unknown>} row */
function rowToPost(row) {
  return {
    id: String(row.id),
    boardId: String(row.board_id),
    authorId: String(row.author_id),
    title: String(row.title),
    body: String(row.body),
    isPinned: Boolean(row.is_pinned),
    isDeleted: Boolean(row.is_deleted),
    createdAt: new Date(/** @type {string|Date} */ (row.created_at)).toISOString(),
    updatedAt: new Date(/** @type {string|Date} */ (row.updated_at)).toISOString(),
  }
}

export async function ensureBoardStore() {
  if (!hasDatabaseUrl()) {
    throw new Error('DATABASE_URL 이 없습니다.')
  }
  await runSqlFile('sql/005_boards_messages.sql')
  const sql = getSql()

  for (const board of DEFAULT_BOARDS) {
    await sql`
      INSERT INTO boards (
        id, title, description, write_role, preview_count, sort_order, enabled
      ) VALUES (
        ${board.id}, ${board.title}, ${board.description}, ${board.writeRole},
        ${board.previewCount}, ${board.sortOrder}, ${board.enabled}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        write_role = EXCLUDED.write_role,
        preview_count = EXCLUDED.preview_count,
        sort_order = EXCLUDED.sort_order,
        enabled = EXCLUDED.enabled
    `
  }

  // 예전 ship 게시판 제거
  await sql`DELETE FROM boards WHERE id = 'ship'`

  const countRows = await sql`SELECT COUNT(*)::int AS n FROM posts`
  const count = Number(countRows[0]?.n || 0)
  if (count === 0) {
    const createdAt = nowIso()
    for (const post of SEED_POSTS) {
      await sql`
        INSERT INTO posts (
          id, board_id, author_id, title, body, is_pinned, is_deleted,
          created_at, updated_at
        ) VALUES (
          ${post.id}, ${post.boardId}, ${post.authorId}, ${post.title},
          ${post.body}, ${post.isPinned}, FALSE, ${createdAt}, ${createdAt}
        )
        ON CONFLICT (id) DO NOTHING
      `
    }
  }
}

/** @returns {Promise<Board[]>} */
export async function loadBoards() {
  const sql = getSql()
  const rows = await sql`
    SELECT id, title, description, write_role, preview_count, sort_order, enabled
    FROM boards
    WHERE enabled = TRUE
    ORDER BY sort_order ASC
  `
  return rows.map(rowToBoard)
}

/** @returns {Promise<Post[]>} */
export async function loadPosts() {
  const sql = getSql()
  const rows = await sql`
    SELECT id, board_id, author_id, title, body, is_pinned, is_deleted,
           created_at, updated_at
    FROM posts
    ORDER BY created_at DESC
  `
  return rows.map(rowToPost)
}

/** @param {string} boardId */
export async function listPostsForBoard(boardId) {
  const sql = getSql()
  const rows = await sql`
    SELECT id, board_id, author_id, title, body, is_pinned, is_deleted,
           created_at, updated_at
    FROM posts
    WHERE board_id = ${boardId} AND is_deleted = FALSE
    ORDER BY is_pinned DESC, created_at DESC
  `
  return rows.map(rowToPost)
}

/** @param {string} boardId @param {string} postId */
export async function getPost(boardId, postId) {
  const sql = getSql()
  const rows = await sql`
    SELECT id, board_id, author_id, title, body, is_pinned, is_deleted,
           created_at, updated_at
    FROM posts
    WHERE id = ${postId} AND board_id = ${boardId} AND is_deleted = FALSE
    LIMIT 1
  `
  return rows[0] ? rowToPost(rows[0]) : null
}

/** @param {Post} post */
export async function insertPost(post) {
  const sql = getSql()
  await sql`
    INSERT INTO posts (
      id, board_id, author_id, title, body, is_pinned, is_deleted,
      created_at, updated_at
    ) VALUES (
      ${post.id}, ${post.boardId}, ${post.authorId}, ${post.title},
      ${post.body}, ${post.isPinned}, ${post.isDeleted},
      ${post.createdAt}, ${post.updatedAt}
    )
  `
  return post
}

/** @deprecated 전체 rewrite 대신 insertPost 사용 */
export async function savePosts(_posts) {
  throw new Error('savePosts is removed; use insertPost')
}

export function canWriteBoard(board, user) {
  if (!board || !user) return false
  if (board.writeRole === 'none') return false
  if (board.writeRole === 'admin') return user.role === 'admin'
  if (board.writeRole === 'member') {
    return user.role === 'admin' || user.role === 'member'
  }
  return false
}

export function decorateAuthor(authorId, users) {
  if (authorId === 'system') {
    return { id: 'system', username: 'system', nickname: '운영', role: 'admin' }
  }
  const user = users.find((u) => u.id === authorId)
  if (!user) {
    return { id: authorId, username: 'unknown', nickname: '알 수 없음', role: 'member' }
  }
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role || 'member',
  }
}

export function decoratePost(post, users) {
  return {
    id: post.id,
    boardId: post.boardId,
    title: post.title,
    body: post.body,
    isPinned: Boolean(post.isPinned),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: decorateAuthor(post.authorId, users),
  }
}

export function validatePostTitle(title) {
  if (typeof title !== 'string') return '제목을 입력하세요.'
  const value = title.trim()
  if (value.length < 1 || value.length > 80) return '제목은 1~80자로 입력하세요.'
  return null
}

export function validatePostBody(body) {
  if (typeof body !== 'string') return '내용을 입력하세요.'
  const value = body.trim()
  if (value.length < 1 || value.length > 10000) return '내용은 1~10000자로 입력하세요.'
  return null
}

export function createPost({ boardId, authorId, title, body, isPinned = false }) {
  const createdAt = nowIso()
  return {
    id: randomBytes(8).toString('hex'),
    boardId,
    authorId,
    title: title.trim(),
    body: body.trim(),
    isPinned: Boolean(isPinned),
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
  }
}
