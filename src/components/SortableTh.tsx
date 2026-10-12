import type { SortDir } from '../lib/tableSort'

type SortableThProps<K extends string> = {
  label: string
  sortKey: K
  activeKey: K | null
  dir: SortDir
  onSort: (key: K) => void
  align?: 'left' | 'center'
  className?: string
}

export function SortableTh<K extends string>({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
  className,
}: SortableThProps<K>) {
  const active = activeKey === sortKey
  return (
    <th
      className={['sortable-th', `align-${align}`, className]
        .filter(Boolean)
        .join(' ')}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className={`table-sort${active ? ' is-active' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <span className="table-sort-mark" aria-hidden="true">
          {active ? (dir === 'asc' ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  )
}
