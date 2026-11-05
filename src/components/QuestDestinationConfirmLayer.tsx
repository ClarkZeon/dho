import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  joinQuestDestinationParts,
  splitQuestDestination,
} from '../lib/questDestination'

type StageCount = 1 | 2 | 3

type QuestDestinationConfirmLayerProps = {
  rawDestination: string
  cityNames?: readonly string[]
  landNames?: readonly string[]
  onCancel: () => void
  onConfirm: (normalizedDestination: string) => void
  stack?: number
}

let openDestConfirmCount = 0

function guessParts(
  raw: string,
  stageCount: StageCount,
  cityNames: readonly string[],
  landNames: readonly string[],
): string[] {
  const { steps } = splitQuestDestination(raw, { cityNames, landNames })
  const names = steps.map((s) => s.name)
  if (names.length === stageCount) return names
  if (stageCount === 1) return [raw]
  if (names.length > stageCount) {
    return [
      ...names.slice(0, stageCount - 1),
      names.slice(stageCount - 1).join(' '),
    ]
  }
  // 부족하면 앞은 추정, 나머지는 빈 칸
  const out = [...names]
  while (out.length < stageCount) out.push('')
  return out
}

/** 퀘스트 추가 전 — 목적지 단계 수·범위 수동 확인 */
export function QuestDestinationConfirmLayer({
  rawDestination,
  cityNames = [],
  landNames = [],
  onCancel,
  onConfirm,
  stack = 0,
}: QuestDestinationConfirmLayerProps) {
  const [phase, setPhase] = useState<'count' | 'ranges'>('count')
  const [stageCount, setStageCount] = useState<StageCount>(1)
  const [parts, setParts] = useState<string[]>([rawDestination])

  useEffect(() => {
    openDestConfirmCount += 1
    const myDepth = openDestConfirmCount
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (myDepth !== openDestConfirmCount) return
      event.stopImmediatePropagation()
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      openDestConfirmCount -= 1
      document.body.style.overflow =
        openDestConfirmCount > 0 ? 'hidden' : prev
      window.removeEventListener('keydown', onKey, true)
    }
  }, [onCancel])

  const preview = useMemo(
    () => joinQuestDestinationParts(parts.filter((p) => p.trim())),
    [parts],
  )

  const style = {
    zIndex: 90 + Math.max(0, stack) * 10,
  } as CSSProperties

  function chooseCount(count: StageCount) {
    setStageCount(count)
    setParts(guessParts(rawDestination, count, cityNames, landNames))
    setPhase('ranges')
  }

  function patchPart(index: number, value: string) {
    setParts((prev) => prev.map((p, i) => (i === index ? value : p)))
  }

  function submit() {
    const cleaned = parts.map((p) => p.trim()).filter(Boolean)
    if (cleaned.length !== stageCount) return
    onConfirm(joinQuestDestinationParts(cleaned))
  }

  const canSubmit =
    parts.length === stageCount &&
    parts.every((p) => p.trim().length > 0)

  return (
    <div
      className={`admin-modal${stack > 0 ? ' is-stacked' : ''}`}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label="목적지 단계 확인"
    >
      <button
        type="button"
        className="admin-modal-backdrop"
        aria-label="닫기"
        onClick={onCancel}
      />
      <div className="admin-modal-panel quest-dest-confirm-panel">
        <div className="admin-modal-body quest-dest-confirm-body">
          <h2 className="quest-dest-confirm-title">목적지 단계 확인</h2>
          <p className="quest-dest-confirm-raw">
            구분자가 없는 목적지입니다.
            <strong>{rawDestination}</strong>
          </p>

          {phase === 'count' ? (
            <>
              <p className="quest-dest-confirm-ask">
                이 목적지는 몇 단계로 나눌까요?
              </p>
              <div className="quest-dest-confirm-count-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => chooseCount(1)}
                >
                  1단계
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => chooseCount(2)}
                >
                  2단계
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => chooseCount(3)}
                >
                  3단계
                </button>
              </div>
              <div className="catalog-confirm-actions">
                <button type="button" className="admin-btn" onClick={onCancel}>
                  취소
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="quest-dest-confirm-ask">
                {stageCount}단계 범위를 확인해 주세요. (도시·육지 카탈로그
                이름이 있으면 채워 두었습니다)
              </p>
              <div className="quest-dest-confirm-fields">
                {parts.map((value, index) => (
                  <label key={`dest-stage-${index}`} className="field">
                    <span>{index + 1}단계</span>
                    <input
                      value={value}
                      onChange={(e) => patchPart(index, e.target.value)}
                      placeholder={`${index + 1}단계 지명`}
                      autoFocus={index === 0}
                    />
                  </label>
                ))}
              </div>
              {preview ? (
                <p className="quest-dest-confirm-preview">
                  저장 표기: <strong>{preview}</strong>
                </p>
              ) : null}
              <div className="catalog-confirm-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => setPhase('count')}
                >
                  이전
                </button>
                <button type="button" className="admin-btn" onClick={onCancel}>
                  취소
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  disabled={!canSubmit}
                  onClick={submit}
                >
                  이 범위로 저장
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
