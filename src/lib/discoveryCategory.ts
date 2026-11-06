/** 발견물 분류 표기: `지리·천문 » 지리` */
export function formatDiscoveryCategoryLabel(
  category: string | null | undefined,
  categoryGroup?: string | null,
): string | null {
  const leaf = String(category || '').trim()
  if (!leaf) return null
  const group = String(categoryGroup || '').trim()
  if (group && group !== leaf) return `${group} » ${leaf}`
  return leaf
}
