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
  | { name: 'skills' }
  | { name: 'jobs' }
  | { name: 'refine' }
  | { name: 'consumables' }
  | { name: 'ports' }
  | { name: 'regions' }
  | { name: 'sea-areas' }
  | { name: 'fields' }
  | { name: 'users' }

type MenuSectionId =
  | 'community'
  | 'ships'
  | 'records'
  | 'character'
  | 'items'
  | 'world'
  | 'manage'

const MENU_SECTIONS_KEY = 'dho.slideMenu.sections'
const MENU_SECTION_IDS: MenuSectionId[] = [
  'community',
  'ships',
  'records',
  'character',
  'items',
  'world',
  'manage',
]

function loadOpenSections(): Set<MenuSectionId> {
  try {
    const raw = localStorage.getItem(MENU_SECTIONS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(
      parsed.filter((id): id is MenuSectionId =>
        MENU_SECTION_IDS.includes(id as MenuSectionId),
      ),
    )
  } catch {
    return new Set()
  }
}

function saveOpenSections(sections: Set<MenuSectionId>) {
  localStorage.setItem(MENU_SECTIONS_KEY, JSON.stringify([...sections]))
}

type SlideMenuProps = {
  open: boolean
  user: User
  boards: BoardSummary[]
  active: MenuTarget
  onClose: () => void
  onNavigate: (target: MenuTarget) => void
  onLogout: () => void
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
    loadOpenSections,
  )
  const isAdmin = user.role === 'admin'

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  function go(target: MenuTarget) {
    onNavigate(target)
  }

  function toggleSection(id: MenuSectionId) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveOpenSections(next)
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
  const characterActive =
    active.name === 'skills' ||
    active.name === 'jobs' ||
    active.name === 'refine'
  const itemsActive = active.name === 'consumables'
  const worldActive =
    active.name === 'ports' ||
    active.name === 'regions' ||
    active.name === 'sea-areas' ||
    active.name === 'fields'
  const manageActive = active.name === 'users'

  const sectionHasActive: Record<MenuSectionId, boolean> = {
    community: communityActive,
    ships: shipsActive,
    records: recordsActive,
    character: characterActive,
    items: itemsActive,
    world: worldActive,
    manage: manageActive,
  }

  // 현재 활성 페이지가 속하지 않은 열린 섹션은 닫기
  useEffect(() => {
    setOpenSections((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const id of prev) {
        if (!sectionHasActive[id]) {
          next.delete(id)
          changed = true
        }
      }
      if (!changed) return prev
      saveOpenSections(next)
      return next
    })
  }, [
    communityActive,
    shipsActive,
    recordsActive,
    characterActive,
    itemsActive,
    worldActive,
    manageActive,
  ])

  return (
    <div
      className={`slide-menu ${open ? 'open' : ''}`}
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
      <aside
        className="slide-menu-panel"
        role="navigation"
        aria-label="사이트 메뉴"
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
          <button
            type="button"
            className="slide-menu-close"
            aria-label="메뉴 접기"
            onClick={onClose}
          >
            접기
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

          <MenuSection
            id="character"
            title="캐릭터"
            open={openSections.has('character')}
            active={characterActive}
            onToggle={toggleSection}
          >
            <button
              type="button"
              className={active.name === 'skills' ? 'active' : ''}
              onClick={() => go({ name: 'skills' })}
            >
              스킬
            </button>
            <button
              type="button"
              className={active.name === 'jobs' ? 'active' : ''}
              onClick={() => go({ name: 'jobs' })}
            >
              직업
            </button>
            <button
              type="button"
              className={active.name === 'refine' ? 'active' : ''}
              onClick={() => go({ name: 'refine' })}
            >
              연성
            </button>
          </MenuSection>

          <MenuSection
            id="items"
            title="아이템"
            open={openSections.has('items')}
            active={itemsActive}
            onToggle={toggleSection}
          >
            <button
              type="button"
              className={active.name === 'consumables' ? 'active' : ''}
              onClick={() => go({ name: 'consumables' })}
            >
              소비품
            </button>
          </MenuSection>

          <MenuSection
            id="world"
            title="월드"
            open={openSections.has('world')}
            active={worldActive}
            onToggle={toggleSection}
          >
            <button
              type="button"
              className={active.name === 'ports' ? 'active' : ''}
              onClick={() => go({ name: 'ports' })}
            >
              도시
            </button>
            <button
              type="button"
              className={active.name === 'regions' ? 'active' : ''}
              onClick={() => go({ name: 'regions' })}
            >
              지역
            </button>
            <button
              type="button"
              className={active.name === 'sea-areas' ? 'active' : ''}
              onClick={() => go({ name: 'sea-areas' })}
            >
              해역
            </button>
            <button
              type="button"
              className={active.name === 'fields' ? 'active' : ''}
              onClick={() => go({ name: 'fields' })}
            >
              육지
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
