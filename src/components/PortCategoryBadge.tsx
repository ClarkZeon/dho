import { parsePortCategory } from '../lib/portCategories'

/** 도시 분류 뱃지 — 상세·리스트 공통 (`나라 » 본거지|영지` / 동맹항·해석점) */
export function PortCategoryBadge({
  category,
}: {
  category: string | null | undefined
}) {
  const raw = String(category || '').trim()
  if (!raw) {
    return <span className="quest-badge">항구 · 도시</span>
  }

  const parts = parsePortCategory(raw)
  if (parts.head && parts.kind) {
    return (
      <span
        className={`quest-badge port-category-badge${parts.kind === '영지' ? ' is-fief' : ''}${parts.kind === '본거지' ? ' is-home' : ''}`}
      >
        <em className="port-category-head">{parts.head}</em>
        <span className="port-category-sep" aria-hidden="true">
          »
        </span>
        <span className="port-category-kind">{parts.kind}</span>
      </span>
    )
  }

  return <span className="quest-badge">{raw}</span>
}
