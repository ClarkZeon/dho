import type {
  BoardPost,
  BoardSummary,
  MessageItem,
  Session,
  ShipDetail,
  User,
} from '../types'

const SESSION_KEY = 'dho.session'
const LEGACY_USER_KEY = 'dho.user'

export function loadSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
  if (!raw) {
    // 이전 세션(토큰 없음)은 무효 → 재로그인
    localStorage.removeItem(LEGACY_USER_KEY)
    sessionStorage.removeItem(LEGACY_USER_KEY)
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Session
    if (!parsed?.token || !parsed?.user?.id) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSession(session: Session, remember: boolean) {
  const raw = JSON.stringify(session)
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(LEGACY_USER_KEY)
  sessionStorage.removeItem(LEGACY_USER_KEY)
  if (remember) localStorage.setItem(SESSION_KEY, raw)
  else sessionStorage.setItem(SESSION_KEY, raw)
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(LEGACY_USER_KEY)
  sessionStorage.removeItem(LEGACY_USER_KEY)
}

async function request<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    token?: string | null
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  const res = await fetch(path, {
    method: options.method || (options.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || '요청에 실패했습니다.')
  }
  return data
}

export function signup(body: {
  username: string
  nickname: string
  password: string
  passwordConfirm: string
}) {
  return request<{ user: User }>('/api/auth/signup', { body })
}

export function login(body: { username: string; password: string }) {
  return request<{
    user: User
    token: string
    reward?: { dailyXp: number; gainedLevels: number }
  }>('/api/auth/login', { body })
}

export function logout(token: string) {
  return request<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
    token,
  })
}

export function searchUsers(token: string, q: string) {
  return request<{ users: Array<Pick<User, 'id' | 'username' | 'nickname' | 'level'>> }>(
    `/api/users/search?q=${encodeURIComponent(q)}`,
    { token },
  )
}

export function fetchInbox(token: string) {
  return request<{ messages: MessageItem[] }>('/api/messages/inbox', { token })
}

export function fetchSent(token: string) {
  return request<{ messages: MessageItem[] }>('/api/messages/sent', { token })
}

export function fetchUnreadCount(token: string) {
  return request<{ count: number }>('/api/messages/unread-count', { token })
}

export function fetchMessage(token: string, id: string) {
  return request<{ message: MessageItem; thread: MessageItem[] }>(
    `/api/messages/${id}`,
    { token },
  )
}

export function sendMessage(
  token: string,
  body: { to: string; subject: string; body: string },
) {
  return request<{ message: MessageItem }>('/api/messages', { token, body })
}

export function replyMessage(token: string, id: string, body: string) {
  return request<{ message: MessageItem }>(`/api/messages/${id}/reply`, {
    token,
    body: { body },
  })
}

export function fetchBoards(token: string, preview = false) {
  return request<{ boards: BoardSummary[] }>(
    `/api/boards${preview ? '?preview=1' : ''}`,
    { token },
  )
}

export function fetchBoardPosts(token: string, boardId: string) {
  return request<{
    board: BoardSummary
    total: number
    posts: BoardPost[]
  }>(`/api/boards/${boardId}/posts`, { token })
}

export function fetchBoardPost(token: string, boardId: string, postId: string) {
  return request<{ board: BoardSummary; post: BoardPost }>(
    `/api/boards/${boardId}/posts/${postId}`,
    { token },
  )
}

export function createBoardPost(
  token: string,
  boardId: string,
  body: { title: string; body: string; isPinned?: boolean },
) {
  return request<{ post: BoardPost }>(`/api/boards/${boardId}/posts`, {
    token,
    body,
  })
}

export function fetchShips(token: string) {
  return request<{ ships: ShipDetail[] }>('/api/ships', { token })
}

export function fetchShip(token: string, slug: string) {
  return request<{ ship: ShipDetail }>(`/api/ships/${encodeURIComponent(slug)}`, {
    token,
  })
}
