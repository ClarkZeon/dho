import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import type { BoardSummary, User } from '../types'

export type MenuTarget =
  | { name: 'home' }
  | { name: 'messages' }
  | { name: 'board'; boardId: string }
  | { name: 'ship-info' }
  | { name: 'ship-accel' }
  | { name: 'ship-compare' }
  | { name: 'quests' }
  | { name: 'ports' }
  | { name: 'languages' }
  | { name: 'ship-materials' }

type MenuSectionId = 'community' | 'ships' | 'voyage'

type SlideMenuProps = {
  open: boolean
  user: User
  boards: BoardSummary[]
  unread: number
  active: MenuTarget
  onClose: () => void
  onNavigate: (target: MenuTarget) => void
  onLogout: () => void
}

function sectionForActive(active: MenuTarget): MenuSectionId | null {
  if (active.name === 'board') return 'community'
  if (
    active.name === 'ship-info' ||
    active.name === 'ship-accel' ||
    active.name === 'ship-compare' ||
    active.name === 'ship-materials'
  ) {
    return 'ships'
  }
  if (
    active.name === 'quests' ||
    active.name === 'ports' ||
    active.name === 'languages'
  ) {
    return 'voyage'
  }
  return null
}

function MenuSection({
  id,
  title,
  open,
  active,
  onToggle,
  children,
}: {
  id: MenuSectionId
  title: string
  open: boolean
  active: boolean
  onToggle: (id: MenuSectionId) => void
  children: ReactNode
}) {
  function toggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    onToggle(id)
  }

  return (
    <div className={`slide-menu-group ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className={`slide-menu-parent ${active ? 'active' : ''}`}
        aria-expanded={open}
        onClick={toggle}
      >
        <span>{title}</span>
        <span className="slide-menu-caret" aria-hidden="true" />
      </button>
      {open && <div className="slide-menu-sub">{children}</div>}
    </div>
  )
}

export function SlideMenu({
  open,
  user,
  boards,
  unread,
  active,
  onClose,
  onNavigate,
  onLogout,
}: SlideMenuProps) {
  const [openSections, setOpenSections] = useState<Set<MenuSectionId>>(
    () => new Set(),
  )

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const section = sectionForActive(active)
    setOpenSections(section ? new Set([section]) : new Set())
  }, [open, active])

  function go(target: MenuTarget) {
    onNavigate(target)
    onClose()
  }

  function toggleSection(id: MenuSectionId) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const communityActive = active.name === 'board'
  const shipsActive =
    active.name === 'ship-info' ||
    active.name === 'ship-accel' ||
    active.name === 'ship-compare' ||
    active.name === 'ship-materials'
  const voyageActive =
    active.name === 'quests' ||
    active.name === 'ports' ||
    active.name === 'languages'

  return (
    <div className={`slide-menu ${open ? 'open' : ''}`} aria-hidden={!open}>
      <button
        type="button"
        className="slide-menu-backdrop"
        aria-label="메뉴 닫기"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />

      <aside
        className="slide-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="사이트 메뉴"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="slide-menu-head">
          <div>
            <p className="slide-menu-brand">
              DHO <em>Light</em>
            </p>
            <p className="slide-menu-user">
              Lv.{user.level} · {user.nickname}
            </p>
          </div>
          <button type="button" className="slide-menu-close" onClick={onClose}>
            닫기
          </button>
        </header>

        <nav className="slide-menu-nav">
          <button
            type="button"
            className={active.name === 'home' ? 'active' : ''}
            onClick={() => go({ name: 'home' })}
          >
            대시보드
          </button>
          <button
            type="button"
            className={active.name === 'messages' ? 'active' : ''}
            onClick={() => go({ name: 'messages' })}
          >
            <span>쪽지함</span>
            {unread > 0 && <span className="topbar-badge">{unread}</span>}
          </button>
          {user.role === 'admin' && (
            <a className="slide-menu-link" href="/admin">
              관리자
            </a>
          )}

          <MenuSection
            id="community"
            title="커뮤니티"
            open={openSections.has('community')}
            active={communityActive}
            onToggle={toggleSection}
          >
            {boards.map((board) => (
              <button
                key={board.id}
                type="button"
                className={
                  active.name === 'board' && active.boardId === board.id
                    ? 'active'
                    : ''
                }
                onClick={() => go({ name: 'board', boardId: board.id })}
              >
                {board.title}
              </button>
            ))}
          </MenuSection>

          <MenuSection
            id="ships"
            title="선박"
            open={openSections.has('ships')}
            active={shipsActive}
            onToggle={toggleSection}
          >
            <button
              type="button"
              className={active.name === 'ship-info' ? 'active' : ''}
              onClick={() => go({ name: 'ship-info' })}
            >
              선박 정보
            </button>
            <button
              type="button"
              className={active.name === 'ship-accel' ? 'active' : ''}
              onClick={() => go({ name: 'ship-accel' })}
            >
              선박 가속도 계산기
            </button>
            <button
              type="button"
              className={active.name === 'ship-compare' ? 'active' : ''}
              onClick={() => go({ name: 'ship-compare' })}
            >
              선박 비교
            </button>
            <button
              type="button"
              className={active.name === 'ship-materials' ? 'active' : ''}
              onClick={() => go({ name: 'ship-materials' })}
            >
              선박 재료
            </button>
          </MenuSection>

          <MenuSection
            id="voyage"
            title="항해 자료"
            open={openSections.has('voyage')}
            active={voyageActive}
            onToggle={toggleSection}
          >
            <button
              type="button"
              className={active.name === 'quests' ? 'active' : ''}
              onClick={() => go({ name: 'quests' })}
            >
              퀘스트
            </button>
            <button
              type="button"
              className={active.name === 'ports' ? 'active' : ''}
              onClick={() => go({ name: 'ports' })}
            >
              항구
            </button>
            <button
              type="button"
              className={active.name === 'languages' ? 'active' : ''}
              onClick={() => go({ name: 'languages' })}
            >
              언어
            </button>
          </MenuSection>
        </nav>

        <footer className="slide-menu-foot">
          <button type="button" className="slide-menu-logout" onClick={onLogout}>
            로그아웃
          </button>
        </footer>
      </aside>
    </div>
  )
}
