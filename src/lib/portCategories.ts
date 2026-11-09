/**
 * 도시(항구) 분류
 *
 * - `나라 » 본거지` / `나라 » 영지` / `나라 » 개척지` (국가 소속)
 * - `동맹항`
 * - `해석점`
 * 추가 분류는 사용자가 알려주면 여기만 갱신.
 */

export const PORT_NATION_KINDS = ['본거지', '영지', '개척지'] as const

export type PortNationKind = (typeof PORT_NATION_KINDS)[number]

/** 국가 깃발·히어로 모티브 — 본거지·영지·개척지 */
export const PORT_FLAG_KINDS = ['본거지', '영지', '개척지'] as const

export type PortFlagKind = (typeof PORT_FLAG_KINDS)[number]

/** 국가 접두 없이 단독으로 쓰는 분류 */
export const PORT_SIMPLE_CATEGORIES = ['동맹항', '해석점'] as const

/** 편집 셀렉트 기본 옵션 (국가 패턴 값은 현재값으로 보존) */
export const PORT_CATEGORIES = [...PORT_SIMPLE_CATEGORIES]

export type PortCategoryParts = {
  head: string | null
  kind: string | null
  raw: string
}

function isNationKind(value: string): value is PortNationKind {
  return (PORT_NATION_KINDS as readonly string[]).includes(value)
}

function isFlagKind(value: string): value is PortFlagKind {
  return (PORT_FLAG_KINDS as readonly string[]).includes(value)
}

/** `프랑스 » 본거지` / `네덜란드>>개척지` / `프랑스본거지` / `동맹항` */
export function parsePortCategory(
  category: string | null | undefined,
): PortCategoryParts {
  const raw = String(category || '').trim()
  if (!raw) return { head: null, kind: null, raw: '' }

  const sep = raw.split(/\s*»\s*|\s*>>\s*|\s*›\s*/)
  if (sep.length >= 2) {
    const head = sep[0].trim()
    const kind = sep.slice(1).join(' » ').trim()
    // 나라 » 본거지|영지|개척지 만 국가 패턴으로 인정
    if (head && isNationKind(kind)) return { head, kind, raw }
  }

  // 긴 종류명 우선 (개척지 > 본거지/영지)
  const kinds = [...PORT_NATION_KINDS].sort((a, b) => b.length - a.length)
  for (const kind of kinds) {
    const spaced = raw.match(new RegExp(`^(.+?)\\s+${kind}$`))
    if (spaced?.[1]?.trim()) {
      return { head: spaced[1].trim(), kind, raw }
    }
    const glued = raw.match(new RegExp(`^(.+?)${kind}$`))
    if (glued?.[1]?.trim() && glued[1].trim() !== kind) {
      return { head: glued[1].trim(), kind, raw }
    }
  }

  return { head: null, kind: null, raw }
}

export function isNationPortCategory(
  category: string | null | undefined,
): boolean {
  const parts = parsePortCategory(category)
  return Boolean(parts.head && parts.kind && isNationKind(parts.kind))
}

/** 깃발 모티브 대상 — 본거지·영지·개척지 */
export function isFlagPortCategory(
  category: string | null | undefined,
): boolean {
  const parts = parsePortCategory(category)
  return Boolean(parts.head && parts.kind && isFlagKind(parts.kind))
}

export function formatNationPortCategory(country: string, kind: PortNationKind) {
  return `${country.trim()} » ${kind}`
}
