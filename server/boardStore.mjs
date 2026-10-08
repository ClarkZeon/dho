import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getWritableDataDir } from './paths.mjs'

function dataDir() {
  return getWritableDataDir()
}

export function boardsFile() {
  return path.join(dataDir(), 'boards.json')
}

export function postsFile() {
  return path.join(dataDir(), 'posts.json')
}

/**
 * 공통 게시판 정의 (추후 MySQL boards 테이블)
 * writeRole: admin | member | none
 *
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
 * 공통 게시글 (추후 MySQL posts 테이블 — board_id로 구분)
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

function nowIso() {
  return new Date().toISOString()
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

async function writeJson(file, data) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export async function ensureBoardStore() {
  let boards = await readJson(boardsFile(), null)
  if (!Array.isArray(boards) || boards.length === 0) {
    boards = DEFAULT_BOARDS
    await writeJson(boardsFile(), boards)
  } else if (boards.some((b) => b.id === 'ship')) {
    // 선박은 게시판이 아니라 독립 대메뉴로 분리
    boards = boards.filter((b) => b.id !== 'ship')
    await writeJson(boardsFile(), boards)
  }

  let posts = await readJson(postsFile(), null)
  if (!Array.isArray(posts)) {
    posts = []
  }

  if (posts.length === 0) {
    const createdAt = nowIso()
    posts = [
      {
        id: randomBytes(8).toString('hex'),
        boardId: 'notice',
        authorId: 'system',
        title: 'DHO Light 오픈 안내',
        body: 'DHO Light에 오신 것을 환영합니다.\n\n공지사항은 공통 게시글 테이블(posts)을 사용하며, 자유·공략 등 다른 게시판도 동일한 구조로 확장할 수 있습니다.',
        isPinned: true,
        isDeleted: false,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: randomBytes(8).toString('hex'),
        boardId: 'notice',
        authorId: 'system',
        title: '쪽지·레벨 기능 안내',
        body: '로그인 후 쪽지함과 레벨(일일 XP)을 이용할 수 있습니다.\n자세한 규칙은 docs 폴더의 문서를 참고해 주세요.',
        isPinned: false,
        isDeleted: false,
        createdAt,
        updatedAt: createdAt,
      },
    ]
    await writeJson(postsFile(), posts)
  }
}

/** @returns {Promise<Board[]>} */
export async function loadBoards() {
  const boards = await readJson(boardsFile(), DEFAULT_BOARDS)
  return boards
    .filter((b) => b.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
}

/** @returns {Promise<Post[]>} */
export async function loadPosts() {
  return readJson(postsFile(), [])
}

/** @param {Post[]} posts */
export async function savePosts(posts) {
  await writeJson(postsFile(), posts)
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
