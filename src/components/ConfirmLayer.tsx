import { useEffect, type CSSProperties } from 'react'

type ConfirmLayerProps = {
  title?: string
  message: string
  cancelLabel?: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm?: () => void
  stack?: number
}

let openConfirmCount = 0

/** 카탈로그 점프 등 — 닫기 / 확인 액션이 있는 레이어 */
export function ConfirmLayer({
  title = '확인',
  message,
  cancelLabel = '닫기',
  confirmLabel,
  onCancel,
  onConfirm,
  stack = 0,
}: ConfirmLayerProps) {
  useEffect(() => {
    openConfirmCount += 1
    const myDepth = openConfirmCount
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (myDepth !== openConfirmCount) return
      event.stopImmediatePropagation()
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      openConfirmCount -= 1
      document.body.style.overflow = openConfirmCount > 0 ? 'hidden' : prev
      window.removeEventListener('keydown', onKey, true)
    }
  }, [onCancel])

  const style = {
    zIndex: 90 + Math.max(0, stack) * 10,
  } as CSSProperties

  return (
    <div
      className={`admin-modal${stack > 0 ? ' is-stacked' : ''}`}
      style={style}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="admin-modal-backdrop"
        aria-label="닫기"
        onClick={onCancel}
      />
      <div className="admin-modal-panel catalog-confirm-panel">
        <div className="admin-modal-body catalog-confirm-body">
          <p className="catalog-jump-miss" role="alert">
            {message}
          </p>
          <div className="catalog-confirm-actions">
            <button type="button" className="admin-btn" onClick={onCancel}>
              {cancelLabel}
            </button>
            {confirmLabel && onConfirm ? (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
