import { parsePortCategory } from './portCategories'

/** 분류 `프랑스본거지` / `프랑스 » 본거지` → 국가 깃발 (papayaplay countries CDN) */
export const COUNTRY_FLAG_IDS: Record<string, string> = {
  프랑스: '68dd7eed-7343-4d0e-936b-ed98573fe492',
  잉글랜드: 'f1cb4725-6c5e-4968-9c8f-610b0aca38ae',
  네덜란드: 'cbf1b26a-a611-43a7-964a-0c4169310b41',
}

/** 국가 머리말 → 도시명 그라데이션 */
export const COUNTRY_TITLE_GRADIENTS: Record<string, string> = {
  프랑스:
    'linear-gradient(100deg, #002395 0%, #3a5fbf 38%, #c81e3a 72%, #ed2939 100%)',
  포르투갈:
    'linear-gradient(100deg, #006600 0%, #2f8f2f 40%, #c8102e 78%, #ff0000 100%)',
  잉글랜드:
    'linear-gradient(100deg, #5c0a0a 0%, #8b0000 35%, #c8102e 70%, #9b1b1b 100%)',
  네덜란드:
    'linear-gradient(100deg, #ae1c28 0%, #c94a52 32%, #f5f5f5 50%, #3a5f9a 72%, #21468b 100%)',
}

export function countryTitleGradient(
  head: string | null | undefined,
): string | null {
  if (!head) return null
  return COUNTRY_TITLE_GRADIENTS[head] || null
}

export function countryNameFromCategory(
  category: string | null | undefined,
): string | null {
  return parsePortCategory(category).head
}

export function countryFlagPathFromCategory(
  category: string | null | undefined,
): string | null {
  const head = countryNameFromCategory(category)
  if (!head) return null
  const id = COUNTRY_FLAG_IDS[head]
  return id ? `/countries/${id}.png` : null
}

/** 저장된 도시/국가 깃발이 없으면 본거지/영지 분류로 국가 깃발 추론 */
export function resolvePortFlagSrc(
  flagImage: string | null | undefined,
  category: string | null | undefined,
): string | null {
  const stored = String(flagImage || '').trim()
  if (stored) return stored
  return countryFlagPathFromCategory(category)
}

export { parsePortCategory } from './portCategories'
