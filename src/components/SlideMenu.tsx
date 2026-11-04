import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import type { BoardSummary, User } from '../types'
import { BrandMark } from './BrandMark'

export type MenuTarget =
  | { name: 'home' }
  | { name: 'messages' }
  | { name: 'board'; boardId: string }
  | { name: 'ship-info' }
  | { name: 'ship-accel' }
  | { name: 'ship-compare' }
  | { name: 'ship-materials' }
  | { name: 'discoveries' }
  | { name: 'quests' }
  | { name: 'users' }

type MenuSectionId = 'community' | 'ships' | 'records' | 'manage'

type SlideMenuProps = {
  open: boolean
  user: User
  boards: BoardSummary[]
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
  if (active.name === 'discoveries' || active.name === 'quests') return 'records'
  if (active.name === 'users') return 'manage'
  return null
}

function MenuSection({
  id,
  title,
  open,
  active,
  onToggle,
  admin,
  children,
}: {
  id: MenuSectionId
  title: string
  open: boolean
  active: boolean
  onToggle: (id: MenuSectionId) => void
  admin?: boolean
  children: ReactNode
}) {
  function toggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    onToggle(id)
  }

  return (
    <div
      className={`slide-menu-group${open ? ' is-open' : ''}${admin ? ' is-admin' : ''}`}
    >
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
  active,
  onClose,
  onNavigate,
  onLogout,
}: SlideMenuProps) {
  const [openSections, setOpenSections] = useState<Set<MenuSectionId>>(
    () => new Set(),
  )
  const isAdmin = user.role === 'admin'

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
  const recordsActive =
    active.name === 'discoveries' || active.name === 'quests'
  const manageActive = active.name === 'users'
  return (
    <div
      className={`slide-menu ${open ? 'open' : ''}`}
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
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
        aria-modal={open ? true : undefined}
        aria-label="사이트 메뉴"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="slide-menu-head">
          <div>
            <p className="slide-menu-brand">
              <BrandMark />
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
            id="records"
            title="기록"
            open={openSections.has('records')}
            active={recordsActive}
            onToggle={toggleSection}
          >
            <button
              type="button"
              className={active.name === 'discoveries' ? 'active' : ''}
              onClick={() => go({ name: 'discoveries' })}
            >
              발견물
            </button>
            <button
              type="button"
              className={active.name === 'quests' ? 'active' : ''}
              onClick={() => go({ name: 'quests' })}
            >
              퀘스트
            </button>
          </MenuSection>

          {isAdmin && (
            <MenuSection
              id="manage"
              title="관리"
              open={openSections.has('manage')}
              active={manageActive}
              onToggle={toggleSection}
              admin
            >
              <button
                type="button"
                className={active.name === 'users' ? 'active' : ''}
                onClick={() => go({ name: 'users' })}
              >
                회원
              </button>
            </MenuSection>
          )}
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
