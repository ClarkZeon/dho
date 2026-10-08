import { useEffect, useState, type MouseEvent } from 'react'
import type { BoardSummary, User } from '../types'

export type MenuTarget =
  | { name: 'home' }
  | { name: 'messages' }
  | { name: 'board'; boardId: string }
  | { name: 'ship-info' }
  | { name: 'ship-accel' }
  | { name: 'ship-compare' }

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
  const boardActive = active.name === 'board'
  const shipActive =
    active.name === 'ship-info' ||
    active.name === 'ship-accel' ||
    active.name === 'ship-compare'
  const [boardsOpen, setBoardsOpen] = useState(false)
  const [shipOpen, setShipOpen] = useState(false)

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
    setBoardsOpen(boardActive)
    setShipOpen(shipActive)
  }, [open, boardActive, shipActive])

  function go(target: MenuTarget) {
    onNavigate(target)
    onClose()
  }

  function toggleBoards(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    setBoardsOpen((prev) => !prev)
  }

  function toggleShip(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    setShipOpen((prev) => !prev)
  }

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
          <p className="slide-menu-label">바로가기</p>
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

          <p className="slide-menu-label">커뮤니티</p>
          <div className={`slide-menu-group ${boardsOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className={`slide-menu-parent ${boardActive ? 'active' : ''}`}
              aria-expanded={boardsOpen}
              onClick={toggleBoards}
            >
              <span>게시판</span>
              <span className="slide-menu-caret" aria-hidden="true" />
            </button>

            {boardsOpen && (
              <div className="slide-menu-sub">
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
              </div>
            )}
          </div>

          <p className="slide-menu-label">도구</p>
          <div className={`slide-menu-group ${shipOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className={`slide-menu-parent ${shipActive ? 'active' : ''}`}
              aria-expanded={shipOpen}
              onClick={toggleShip}
            >
              <span>선박</span>
              <span className="slide-menu-caret" aria-hidden="true" />
            </button>

            {shipOpen && (
              <div className="slide-menu-sub">
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
              </div>
            )}
          </div>
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
