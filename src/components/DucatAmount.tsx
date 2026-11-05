import type { ReactNode } from 'react'

/** 두캇 통화 기호 (Ɖ) */
export function DucatMark() {
  return <span className="ducat-mark">Ɖ</span>
}

/**
 * `700두캇` / `90,000 두캇` / 숫자 → `700Ɖ` 형태로 표시.
 * 두캇 표기가 없으면 원문(또는 숫자)만.
 */
export function DucatAmount({
  value,
}: {
  value: string | number | null | undefined
}): ReactNode {
  if (value == null) return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return (
      <>
        {value.toLocaleString('ko-KR')}
        <DucatMark />
      </>
    )
  }

  const text = String(value).trim()
  if (!text) return null

  const onlyAmount = text.match(/^([\d,]+(?:\.\d+)?)\s*(두캇|두카트)?$/i)
  if (onlyAmount) {
    return (
      <>
        {onlyAmount[1]}
        {onlyAmount[2] ? <DucatMark /> : null}
      </>
    )
  }

  if (!/두캇|두카트/i.test(text)) return text

  const parts = text.split(/(두캇|두카트)/i)
  return parts.map((part, i) =>
    /^(두캇|두카트)$/i.test(part) ? <DucatMark key={`d-${i}`} /> : part,
  )
}
