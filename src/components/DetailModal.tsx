import { useEffect, type CSSProperties, type ReactNode } from 'react'

type DetailModalProps = {
  title: string
  label: string
  onClose: () => void
  children: ReactNode
  /** 중첩 모달일 때 위로 쌓음 (1 = 한 단계 위) */
  stack?: number
}

let openModalCount = 0

/** 관리자·유저 사이트 공용 상세 모달 */
export function DetailModal({
  title,
  label,
  onClose,
  children,
  stack = 0,
}: DetailModalProps) {
  useEffect(() => {
    openModalCount += 1
    const myDepth = openModalCount
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      // 맨 위 모달만 닫기
      if (myDepth !== openModalCount) return
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      openModalCount -= 1
      document.body.style.overflow = openModalCount > 0 ? 'hidden' : prev
      window.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  const style = {
    zIndex: 80 + Math.max(0, stack) * 10,
  } as CSSProperties

  return (
    <div
      className={`admin-modal${stack > 0 ? ' is-stacked' : ''}`}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button
        type="button"
        className="admin-modal-backdrop"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="admin-modal-panel">
        <header className="admin-modal-head">
          <p>{title}</p>
          <button type="button" className="admin-btn" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
  )
}
