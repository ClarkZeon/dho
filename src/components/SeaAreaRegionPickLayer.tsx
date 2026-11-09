import { useEffect, type CSSProperties } from 'react'

type SeaAreaRegionPickLayerProps = {
  rawRegion: string
  candidates: string[]
  onCancel: () => void
  /** 선택한 지역 이름(통째 또는 1차/2차…)으로 점프 */
  onPick: (regionName: string) => void
  stack?: number
}

let openRegionPickCount = 0

/** 쉼표로 묶인 해역 지역 — 1개(통째) / 1차·2차… 중 고르기 */
export function SeaAreaRegionPickLayer({
  rawRegion,
  candidates,
  onCancel,
  onPick,
  stack = 0,
}: SeaAreaRegionPickLayerProps) {
  useEffect(() => {
    openRegionPickCount += 1
    const myDepth = openRegionPickCount
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (myDepth !== openRegionPickCount) return
      event.stopImmediatePropagation()
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      openRegionPickCount -= 1
      document.body.style.overflow =
        openRegionPickCount > 0 ? 'hidden' : prev
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
      role="dialog"
      aria-modal="true"
      aria-label="지역 선택"
    >
      <button
        type="button"
        className="admin-modal-backdrop"
        aria-label="닫기"
        onClick={onCancel}
      />
      <div className="admin-modal-panel quest-dest-confirm-panel">
        <div className="admin-modal-body quest-dest-confirm-body">
          <h2 className="quest-dest-confirm-title">지역 선택</h2>
          <p className="quest-dest-confirm-raw">
            쉼표로 묶인 지역입니다. 하나로 열지, 나눠서 열지 고르세요.
            <strong>{rawRegion}</strong>
          </p>
          <p className="quest-dest-confirm-ask">어느 표기로 열까요?</p>
          <div className="quest-dest-confirm-count-actions">
            <button
              type="button"
              className="admin-btn"
              onClick={() => onPick(rawRegion)}
            >
              하나로 · {rawRegion}
            </button>
            {candidates.map((name, index) => (
              <button
                key={`${name}-${index}`}
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => onPick(name)}
              >
                {index + 1}차 · {name}
              </button>
            ))}
          </div>
          <div className="catalog-confirm-actions">
            <button type="button" className="admin-btn" onClick={onCancel}>
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** `유럽 북부, 유럽 극북부` → `['유럽 북부', '유럽 극북부']` */
export function splitSeaRegionCandidates(
  raw: string | null | undefined,
): string[] {
  return String(raw || '')
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
}
