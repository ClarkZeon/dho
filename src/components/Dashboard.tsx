import { useCallback, useEffect, useState } from 'react'
import { fetchBoards, fetchUnreadCount } from '../lib/api'
import type { BoardSummary, User } from '../types'
import { BoardView } from './BoardView'
import { Messages } from './Messages'
import { DiscoveryCatalog } from './DiscoveryCatalog'
import { FieldCatalog } from './FieldCatalog'
import { LanguageCatalog } from './LanguageCatalog'
import { PortCatalog } from './PortCatalog'
import { QuestCatalog } from './QuestCatalog'
import { ShipAccel } from './ShipAccel'
import { ShipCompare } from './ShipCompare'
import { ShipInfo } from './ShipInfo'
import { ShipMaterialCatalog } from './ShipMaterialCatalog'
import { SlideMenu, type MenuTarget } from './SlideMenu'

type View =
  | { name: 'home' }
  | { name: 'messages' }
  | { name: 'board'; boardId: string; postId?: string }
  | { name: 'ship-info' }
  | { name: 'ship-accel' }
  | { name: 'ship-compare' }
  | { name: 'ship-materials' }
  | { name: 'quests' }
  | { name: 'ports' }
  | { name: 'discoveries' }
  | { name: 'languages' }
  | { name: 'fields' }

type DashboardProps = {
  user: User
  token: string
  onLogout: () => void
  onToast: (message: string) => void
}

/** 홈은 해시 없음(깨끗한 URL). 하위 페이지만 #/… 사용 */
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
    case 'ship-materials':
      return '#/ship-materials'
    case 'quests':
      return '#/quests'
    case 'ports':
      return '#/ports'
    case 'discoveries':
      return '#/discoveries'
    case 'languages':
      return '#/languages'
    case 'fields':
      return '#/fields'
    case 'board':
      return view.postId
        ? `#/board/${encodeURIComponent(view.boardId)}/${encodeURIComponent(view.postId)}`
        : `#/board/${encodeURIComponent(view.boardId)}`
    default:
      return ''
  }
}

function currentUrlWithHash(hash: string) {
  return `${window.location.pathname}${window.location.search}${hash}`
}

function applyViewUrl(view: View) {
  const hash = viewToHash(view)
  const nextUrl = currentUrlWithHash(hash)
  const now = currentUrlWithHash(window.location.hash)
  if (now === nextUrl) return
  // 홈으로 갈 때 hash='' 만 쓰면 주소에 `#` 잔여가 남을 수 있어 pathname으로 교체
  window.history.pushState(null, '', nextUrl)
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
  if (parts[0] === 'ship-materials') return { name: 'ship-materials' }
  if (parts[0] === 'quests') return { name: 'quests' }
  if (parts[0] === 'ports') return { name: 'ports' }
  if (parts[0] === 'discoveries') return { name: 'discoveries' }
  if (parts[0] === 'languages') return { name: 'languages' }
  if (parts[0] === 'fields') return { name: 'fields' }
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
  if (view.name === 'ship-materials') return { name: 'ship-materials' }
  if (view.name === 'quests') return { name: 'quests' }
  if (view.name === 'ports') return { name: 'ports' }
  if (view.name === 'discoveries') return { name: 'discoveries' }
  if (view.name === 'languages') return { name: 'languages' }
  if (view.name === 'fields') return { name: 'fields' }
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
      applyViewUrl(next)
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
    // 예전 홈 URL `#/` · `#` 정리
    if (window.location.hash === '#/' || window.location.hash === '#') {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`,
      )
    }

    function syncFromLocation() {
      const next = hashToView(window.location.hash)
      setView((prev) => {
        if (viewsEqual(prev, next)) return prev
        if (next.name === 'home') void refreshBoards()
        return next
      })
    }

    window.addEventListener('hashchange', syncFromLocation)
    window.addEventListener('popstate', syncFromLocation)
    return () => {
      window.removeEventListener('hashchange', syncFromLocation)
      window.removeEventListener('popstate', syncFromLocation)
    }
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
    if (target.name === 'ship-materials') {
      go({ name: 'ship-materials' })
      return
    }
    if (target.name === 'quests') {
      go({ name: 'quests' })
      return
    }
    if (target.name === 'ports') {
      go({ name: 'ports' })
      return
    }
    if (target.name === 'discoveries') {
      go({ name: 'discoveries' })
      return
    }
    if (target.name === 'languages') {
      go({ name: 'languages' })
      return
    }
    if (target.name === 'fields') {
      go({ name: 'fields' })
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
                <p>게시판·선박·퀘스트·항구·언어를 한곳에서 바로 엽니다.</p>
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

            <section className="dash-section" aria-labelledby="dash-tools-heading">
              <header className="dash-section-head">
                <h2 id="dash-tools-heading">자료 · 도구</h2>
                <p>메뉴에 있는 선박·퀘스트·항구·언어로 바로 이동합니다.</p>
              </header>
              <div className="dash-link-groups">
                <div className="dash-link-group">
                  <h3>선박</h3>
                  <div className="dash-links">
                    <button
                      type="button"
                      className="dash-link"
                      onClick={() => go({ name: 'ship-info' })}
                    >
                      <strong>선박 정보</strong>
                      <span>스펙·건조 정보</span>
                    </button>
                    <button
                      type="button"
                      className="dash-link"
                      onClick={() => go({ name: 'ship-accel' })}
                    >
                      <strong>가속도 계산기</strong>
                      <span>가속·선회 분석</span>
                    </button>
                    <button
                      type="button"
                      className="dash-link"
                      onClick={() => go({ name: 'ship-compare' })}
                    >
                      <strong>선박 비교</strong>
                      <span>선박 스펙 대조</span>
                    </button>
                    <button
                      type="button"
                      className="dash-link"
                      onClick={() => go({ name: 'ship-materials' })}
                    >
                      <strong>선박 재료</strong>
                      <span>재료 목록·상세</span>
                    </button>
                  </div>
                </div>

                <div className="dash-link-group">
                  <h3>항해 자료</h3>
                  <div className="dash-links">
                    <button
                      type="button"
                      className="dash-link"
                      onClick={() => go({ name: 'quests' })}
                    >
                      <strong>퀘스트</strong>
                      <span>퀘스트 목록·연계</span>
                    </button>
                    <button
                      type="button"
                      className="dash-link"
                      onClick={() => go({ name: 'ports' })}
                    >
                      <strong>항구</strong>
                      <span>항구·도시 정보</span>
                    </button>
                    <button
                      type="button"
                      className="dash-link"
                      onClick={() => go({ name: 'discoveries' })}
                    >
                      <strong>발견물</strong>
                      <span>발견물 목록·상세</span>
                    </button>
                    <button
                      type="button"
                      className="dash-link"
                      onClick={() => go({ name: 'languages' })}
                    >
                      <strong>언어</strong>
                      <span>언어·습득 정보</span>
                    </button>
                    <button
                      type="button"
                      className="dash-link"
                      onClick={() => go({ name: 'fields' })}
                    >
                      <strong>필드</strong>
                      <span>필드·육지 조사</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="dash-section" aria-labelledby="dash-boards-heading">
              <header className="dash-section-head">
                <h2 id="dash-boards-heading">커뮤니티</h2>
                <p>공지·자유·공략·기능 요청 게시판 미리보기입니다.</p>
              </header>

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
            </section>
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
            onToast={onToast}
            onClearPostId={() => {
              const next = { name: 'board' as const, boardId: view.boardId }
              setView(next)
              window.history.replaceState(null, '', currentUrlWithHash(viewToHash(next)))
            }}
          />
        )}

        {view.name === 'ship-info' && <ShipInfo token={token} />}

        {view.name === 'ship-accel' && <ShipAccel token={token} />}

        {view.name === 'ship-compare' && <ShipCompare token={token} />}

        {view.name === 'ship-materials' && (
          <ShipMaterialCatalog token={token} />
        )}

        {view.name === 'quests' && (
          <QuestCatalog token={token} isAdmin={user.role === 'admin'} />
        )}

        {view.name === 'ports' && <PortCatalog token={token} />}

        {view.name === 'discoveries' && <DiscoveryCatalog token={token} />}

        {view.name === 'languages' && <LanguageCatalog token={token} />}

        {view.name === 'fields' && <FieldCatalog token={token} />}

      </main>
    </div>
  )
}
