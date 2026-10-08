import { useCallback, useEffect, useState } from 'react'
import { fetchBoards, fetchUnreadCount } from '../lib/api'
import type { BoardSummary, User } from '../types'
import { BoardView } from './BoardView'
import { Messages } from './Messages'
import { ShipAccel } from './ShipAccel'
import { ShipCompare } from './ShipCompare'
import { ShipInfo } from './ShipInfo'
import { SlideMenu, type MenuTarget } from './SlideMenu'

type View =
  | { name: 'home' }
  | { name: 'messages' }
  | { name: 'board'; boardId: string; postId?: string }
  | { name: 'ship-info' }
  | { name: 'ship-accel' }
  | { name: 'ship-compare' }

type DashboardProps = {
  user: User
  token: string
  onLogout: () => void
  onToast: (message: string) => void
}

function viewToHash(view: View): string {
  switch (view.name) {
    case 'messages':
      return '#/messages'
    case 'ship-info':
      return '#/ship-info'
    case 'ship-accel':
      return '#/ship-accel'
    case 'ship-compare':
      return '#/ship-compare'
    case 'board':
      return view.postId
        ? `#/board/${encodeURIComponent(view.boardId)}/${encodeURIComponent(view.postId)}`
        : `#/board/${encodeURIComponent(view.boardId)}`
    default:
      return '#/'
  }
}

function hashToView(hash: string): View {
  const raw = hash.replace(/^#/, '').trim()
  const path = raw.startsWith('/') ? raw : `/${raw}`
  const parts = path.split('/').filter(Boolean)

  if (parts.length === 0) return { name: 'home' }
  if (parts[0] === 'messages') return { name: 'messages' }
  if (parts[0] === 'ship-info') return { name: 'ship-info' }
  if (parts[0] === 'ship-accel') return { name: 'ship-accel' }
  if (parts[0] === 'ship-compare') return { name: 'ship-compare' }
  if (parts[0] === 'board' && parts[1]) {
    return {
      name: 'board',
      boardId: decodeURIComponent(parts[1]),
      postId: parts[2] ? decodeURIComponent(parts[2]) : undefined,
    }
  }
  return { name: 'home' }
}

function viewsEqual(a: View, b: View): boolean {
  if (a.name !== b.name) return false
  if (a.name === 'board' && b.name === 'board') {
    return a.boardId === b.boardId && a.postId === b.postId
  }
  return true
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function BoardPanel({
  board,
  onOpen,
  onOpenPost,
}: {
  board: BoardSummary
  onOpen: () => void
  onOpenPost: (postId: string) => void
}) {
  const posts = board.posts || []

  return (
    <section className="board-panel" aria-labelledby={`board-${board.id}`}>
      <header className="board-panel-head">
        <div>
          <h2 id={`board-${board.id}`}>{board.title}</h2>
          <p>{board.description}</p>
        </div>
        <button type="button" className="text-link board-more" onClick={onOpen}>
          더보기
        </button>
      </header>

      {posts.length === 0 ? (
        <p className="board-empty">아직 게시글이 없습니다.</p>
      ) : (
        <ul className="board-list">
          {posts.map((post) => (
            <li key={post.id}>
              <button
                type="button"
                className="board-item"
                onClick={() => onOpenPost(post.id)}
              >
                <span className="board-item-title">
                  {post.isPinned && <em className="pin-tag">공지</em>}
                  {post.title}
                </span>
                <span className="board-item-meta">
                  {post.author.nickname} · {formatDate(post.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function toMenuTarget(view: View): MenuTarget {
  if (view.name === 'board') return { name: 'board', boardId: view.boardId }
  if (view.name === 'messages') return { name: 'messages' }
  if (view.name === 'ship-info') return { name: 'ship-info' }
  if (view.name === 'ship-accel') return { name: 'ship-accel' }
  if (view.name === 'ship-compare') return { name: 'ship-compare' }
  return { name: 'home' }
}

export function Dashboard({ user, token, onLogout, onToast }: DashboardProps) {
  const [view, setView] = useState<View>(() => hashToView(window.location.hash))
  const [menuOpen, setMenuOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [boardsError, setBoardsError] = useState('')

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetchUnreadCount(token)
      setUnread(res.count)
    } catch {
      // ignore
    }
  }, [token])

  const refreshBoards = useCallback(async () => {
    try {
      setBoardsError('')
      const res = await fetchBoards(token, true)
      setBoards(res.boards)
    } catch (err) {
      setBoardsError(
        err instanceof Error ? err.message : '게시판을 불러오지 못했습니다.',
      )
    }
  }, [token])

  const go = useCallback(
    (next: View) => {
      setView((prev) => (viewsEqual(prev, next) ? prev : next))
      const nextHash = viewToHash(next)
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash
      }
      if (next.name === 'home') void refreshBoards()
    },
    [refreshBoards],
  )

  useEffect(() => {
    void refreshUnread()
    void refreshBoards()
    const timer = window.setInterval(() => {
      void refreshUnread()
    }, 15000)
    return () => window.clearInterval(timer)
  }, [refreshUnread, refreshBoards])

  useEffect(() => {
    if (!window.location.hash || window.location.hash === '#') {
      window.history.replaceState(null, '', '#/')
    }

    function onHashChange() {
      const next = hashToView(window.location.hash)
      setView((prev) => {
        if (viewsEqual(prev, next)) return prev
        if (next.name === 'home') void refreshBoards()
        return next
      })
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [refreshBoards])

  function navigate(target: MenuTarget) {
    if (target.name === 'home') {
      go({ name: 'home' })
      return
    }
    if (target.name === 'messages') {
      go({ name: 'messages' })
      return
    }
    if (target.name === 'ship-info') {
      go({ name: 'ship-info' })
      return
    }
    if (target.name === 'ship-accel') {
      go({ name: 'ship-accel' })
      return
    }
    if (target.name === 'ship-compare') {
      go({ name: 'ship-compare' })
      return
    }
    go({ name: 'board', boardId: target.boardId })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="menu-toggle"
            aria-label="메뉴 열기"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
          <button
            type="button"
            className="topbar-mark-btn"
            onClick={() => navigate({ name: 'home' })}
          >
            <span className="topbar-mark">
              DHO <em>Light</em>
            </span>
          </button>
        </div>
        <div className="topbar-user">
          <button
            type="button"
            className={`topbar-nav-btn ${view.name === 'messages' ? 'active' : ''}`}
            onClick={() => navigate({ name: 'messages' })}
          >
            쪽지
            {unread > 0 && <span className="topbar-badge">{unread}</span>}
          </button>
          <span className="topbar-level">Lv.{user.level}</span>
          <span className="topbar-nickname" title={`@${user.username}`}>
            {user.nickname}
          </span>
          <button type="button" className="topbar-logout" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </header>

      <SlideMenu
        open={menuOpen}
        user={user}
        boards={boards}
        unread={unread}
        active={toMenuTarget(view)}
        onClose={() => setMenuOpen(false)}
        onNavigate={navigate}
        onLogout={onLogout}
      />

      <main className="home-main">
        {view.name === 'home' && (
          <>
            <div className="dash-head">
              <div>
                <h1>대시보드</h1>
                <p>게시판을 모아 보는 메인 화면입니다.</p>
              </div>

              <section className="level-card compact" aria-label="레벨 정보">
                <div className="level-card-head">
                  <strong>Lv.{user.level}</strong>
                  <span>
                    {user.xp} / {user.xpToNext} XP
                  </span>
                </div>
                <div
                  className="level-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={user.xpToNext}
                  aria-valuenow={user.xp}
                >
                  <span
                    style={{
                      width: `${Math.min(100, (user.xp / user.xpToNext) * 100)}%`,
                    }}
                  />
                </div>
              </section>
            </div>

            {boardsError && (
              <p className="form-note error" role="alert">
                {boardsError}
              </p>
            )}

            <div className="board-grid">
              {boards.map((board) => (
                <BoardPanel
                  key={board.id}
                  board={board}
                  onOpen={() => go({ name: 'board', boardId: board.id })}
                  onOpenPost={(postId) =>
                    go({ name: 'board', boardId: board.id, postId })
                  }
                />
              ))}
            </div>
          </>
        )}

        {view.name === 'messages' && (
          <Messages
            token={token}
            user={user}
            onToast={onToast}
            onUnreadChange={setUnread}
          />
        )}

        {view.name === 'board' && (
          <BoardView
            token={token}
            user={user}
            boardId={view.boardId}
            initialPostId={view.postId}
            onBack={() => navigate({ name: 'home' })}
            onToast={onToast}
          />
        )}

        {view.name === 'ship-info' && (
          <ShipInfo token={token} onBack={() => navigate({ name: 'home' })} />
        )}

        {view.name === 'ship-accel' && (
          <ShipAccel onBack={() => navigate({ name: 'home' })} />
        )}

        {view.name === 'ship-compare' && (
          <ShipCompare token={token} onBack={() => navigate({ name: 'home' })} />
        )}

      </main>
    </div>
  )
}
