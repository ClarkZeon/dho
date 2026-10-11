import type { ShipMaterialDetail, ShipMaterialEffect } from '../types'

export const MATERIAL_KIND_FILTERS = [
  '일반',
  '돛',
  '포문',
  '선체',
  '재질',
] as const

export const MATERIAL_STAT_COLUMNS = [
  '내구도',
  '세로돛',
  '가로돛',
  '조력',
  '선회',
  '내파',
  '장갑',
  '선실',
  '포실',
  '창고',
] as const

export type MaterialStatColumn = (typeof MATERIAL_STAT_COLUMNS)[number]

const STAT_ALIASES: Record<string, MaterialStatColumn> = {
  내구도: '내구도',
  세로돛: '세로돛',
  가로돛: '가로돛',
  조력: '조력',
  노: '조력',
  선회: '선회',
  내파: '내파',
  장갑: '장갑',
  선실: '선실',
  포실: '포실',
  포문: '포실',
  창고: '창고',
}

export function formatEffectRange(
  min: number | null | undefined,
  max: number | null | undefined,
) {
  if (min == null && max == null) return ''
  if (min == null) return String(max)
  if (max == null) return String(min)
  return `${min} ~ ${max}`
}

export function resolveStatColumn(stat: string): MaterialStatColumn | null {
  return STAT_ALIASES[String(stat || '').trim()] || null
}

export function effectsByColumn(
  effects: ShipMaterialEffect[] | null | undefined,
): Partial<Record<MaterialStatColumn, string>> {
  const out: Partial<Record<MaterialStatColumn, string>> = {}
  for (const effect of effects || []) {
    const col = resolveStatColumn(effect.stat)
    if (!col) continue
    const text = formatEffectRange(effect.min, effect.max)
    if (text) out[col] = text
  }
  return out
}

export function effectNumeric(
  effects: ShipMaterialEffect[] | null | undefined,
  column: MaterialStatColumn,
): number | null {
  for (const effect of effects || []) {
    if (resolveStatColumn(effect.stat) !== column) continue
    if (effect.max != null) return effect.max
    if (effect.min != null) return effect.min
  }
  return null
}

export type MaterialSortKey = 'id' | 'name' | MaterialStatColumn
export type MaterialSortDir = 'asc' | 'desc'

export function compareMaterials(
  a: ShipMaterialDetail,
  b: ShipMaterialDetail,
  key: MaterialSortKey,
  dir: MaterialSortDir,
) {
  const sign = dir === 'asc' ? 1 : -1
  let cmp = 0

  if (key === 'id') {
    cmp = a.id - b.id
  } else if (key === 'name') {
    cmp = a.name.localeCompare(b.name, 'ko')
  } else {
    const av = effectNumeric(a.effects, key)
    const bv = effectNumeric(b.effects, key)
    if (av == null && bv == null) cmp = 0
    else if (av == null) cmp = 1
    else if (bv == null) cmp = -1
    else cmp = av - bv
  }

  if (cmp === 0 && key !== 'id') cmp = a.id - b.id
  return cmp * sign
}

export function matchesMaterialKind(
  material: ShipMaterialDetail,
  kinds: Set<string>,
) {
  if (kinds.size === 0) return true
  const kind = String(material.materialKind || '').trim()
  if (!kind) return false
  for (const filter of kinds) {
    if (kind === filter || kind.includes(filter)) return true
  }
  return false
}

export function matchesMaterialQuery(
  material: ShipMaterialDetail,
  query: string,
) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    material.name,
    material.code,
    material.description,
    material.materialKind,
    material.materialLabel,
    ...(material.effects || []).map((e) => e.stat),
    ...(material.acquireMethods || []).flatMap((a) => [a.source, ...a.items]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}
