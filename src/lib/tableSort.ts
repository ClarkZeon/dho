import { useState } from 'react'

export type SortDir = 'asc' | 'desc'

export function compareSortValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
) {
  const aEmpty = a == null || a === ''
  const bEmpty = b == null || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'ko', { numeric: true })
}

/** 최근 수정(updatedAt) 우선, 없으면 id 큰 값 우선 */
export function compareIdDesc<
  T extends { id: number; updatedAt?: string | null },
>(a: T, b: T) {
  const aU = a.updatedAt || ''
  const bU = b.updatedAt || ''
  if (aU !== bU) return bU.localeCompare(aU)
  return b.id - a.id
}

/** 초기에는 정렬하지 않음. 헤더를 누른 뒤에만 order by 적용.
 *  idleCompare 가 있으면 미정렬 상태에서만 기본 순서에 사용 (예: 최신순)
 */
export function useTableSort<K extends string>(
  defaultKey: K | null = null,
  defaultDir: SortDir = 'asc',
) {
  const [sortKey, setSortKey] = useState<K | null>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  function toggleSort(key: K) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function sortRows<T>(
    rows: readonly T[],
    getValue: (row: T, key: K) => string | number | null | undefined,
    tieBreak?: (a: T, b: T) => number,
    idleCompare?: (a: T, b: T) => number,
  ): T[] {
    if (!sortKey) {
      if (!idleCompare) return [...rows]
      return [...rows].sort(idleCompare)
    }
    const key = sortKey
    return [...rows].sort((a, b) => {
      let cmp = compareSortValues(getValue(a, key), getValue(b, key))
      if (cmp === 0 && tieBreak) cmp = tieBreak(a, b)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  function clearSort() {
    setSortKey(null)
    setSortDir(defaultDir)
  }

  return {
    sortKey,
    sortDir,
    toggleSort,
    sortRows,
    clearSort,
    setSortKey,
    setSortDir,
  }
}
