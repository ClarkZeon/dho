import type {
  AdminUser,
  BoardPost,
  BoardSummary,
  MessageItem,
  Session,
  ShipDetail,
  User,
} from '../types'

const SESSION_KEY = 'dho.session'
const LEGACY_USER_KEY = 'dho.user'

type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null

/** 401 시 로그인 화면으로 보내는 핸들러 등록 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function loadSession(): Session | null {
  const raw =
    localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
  if (!raw) {
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

/** 세션은 항상 localStorage에 저장 (새로고침·재방문 유지) */
export function saveSession(session: Session, _remember = true) {
  const raw = JSON.stringify(session)
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(LEGACY_USER_KEY)
  sessionStorage.removeItem(LEGACY_USER_KEY)
  localStorage.setItem(SESSION_KEY, raw)
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
    /** true면 401 시 전역 로그아웃 핸들러를 호출하지 않음 */
    skipUnauthorizedHandler?: boolean
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

  const text = await res.text()
  let data: T & { error?: string }
  try {
    data = JSON.parse(text) as T & { error?: string }
  } catch {
    throw new Error(
      res.ok
        ? '서버 응답 형식이 올바르지 않습니다.'
        : 'API 서버에 연결하지 못했습니다. 배포 설정을 확인해 주세요.',
    )
  }
  if (!res.ok) {
    const message = data.error || '요청에 실패했습니다.'
    if (
      res.status === 401 &&
      !options.skipUnauthorizedHandler &&
      unauthorizedHandler
    ) {
      unauthorizedHandler()
    }
    throw new ApiError(message, res.status)
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

export function fetchMe(token: string) {
  return request<{ user: User }>('/api/auth/me', {
    token,
    skipUnauthorizedHandler: true,
  })
}

export function logout(token: string) {
  return request<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
    token,
    skipUnauthorizedHandler: true,
  })
}

export function searchUsers(token: string, q: string) {
  return request<{
    users: Array<Pick<User, 'id' | 'username' | 'nickname' | 'level'>>
  }>(`/api/users/search?q=${encodeURIComponent(q)}`, { token })
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
  return request<{ ship: ShipDetail }>(
    `/api/ships/${encodeURIComponent(slug)}`,
    { token },
  )
}

export function importShipText(token: string, text: string) {
  return request<{ ship: ShipDetail }>('/api/ships/import-text', {
    token,
    body: { text },
  })
}

export function fetchAdminUsers(token: string) {
  return request<{ users: AdminUser[] }>('/api/admin/users', { token })
}

export function updateAdminUserRole(
  token: string,
  userId: string,
  role: 'admin' | 'member',
) {
  return request<{ user: AdminUser }>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      token,
      body: { role },
    },
  )
}

export function deleteAdminUser(token: string, userId: string) {
  return request<{ ok: boolean }>(
    `/api/admin/users/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
      token,
    },
  )
}
