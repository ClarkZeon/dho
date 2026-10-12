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

/** 초기에는 정렬하지 않음. 헤더를 누른 뒤에만 order by 적용 */
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
  ): T[] {
    if (!sortKey) return [...rows]
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
