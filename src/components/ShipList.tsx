import { useState, type KeyboardEvent } from 'react'
import { useTableSort } from '../lib/tableSort'
import type { ShipDetail } from '../types'
import { SortableTh } from './SortableTh'

const PAGE_SIZE = 15

type ShipSortKey =
  | 'name'
  | 'category'
  | 'size'
  | 'form'
  | 'level'
  | 'acquireType'
  | 'acquireMethod'

type ShipListProps = {
  ships: ShipDetail[]
  onOpen: (ship: ShipDetail) => void
  emptyText?: string
}

function matchesShipQuery(ship: ShipDetail, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    ship.name,
    ship.slug,
    ship.category,
    ship.size,
    ship.form,
    ship.material,
    ship.acquireType,
    ship.acquireMethod,
    ship.description,
    ship.adventureLv,
    ship.tradeLv,
    ship.battleLv,
  ]
    .filter((v) => v != null && v !== '')
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

export function ShipList({
  ships,
  onOpen,
  emptyText = '등록된 선박이 없습니다.',
}: ShipListProps) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<ShipSortKey>()

  const filtered = sortRows(
    ships.filter((ship) => matchesShipQuery(ship, query)),
    (ship, key) => {
      if (key === 'level') {
        return (
          ship.adventureLv * 1_000_000 + ship.tradeLv * 1_000 + ship.battleLv
        )
      }
      return ship[key]
    },
    (a, b) => a.id - b.id,
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )

  function handleSort(key: ShipSortKey) {
    toggleSort(key)
    setPage(0)
  }

  return (
    <div className="ship-list">
      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
          placeholder="이름·분류·크기·획득으로 검색"
          aria-label="선박 검색"
          autoComplete="off"
        />
      </label>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <SortableTh
                label="이름"
                sortKey="name"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="분류"
                sortKey="category"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="크기"
                sortKey="size"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="형태"
                sortKey="form"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="레벨"
                sortKey="level"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="획득 구분"
                sortKey="acquireType"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="획득 방법"
                sortKey="acquireMethod"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((ship, index) => (
              <tr
                key={ship.id}
                className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                tabIndex={0}
                onClick={() => onOpen(ship)}
                onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpen(ship)
                  }
                }}
              >
                <td>{ship.name}</td>
                <td>{ship.category || '-'}</td>
                <td>{ship.size || '-'}</td>
                <td>{ship.form || '-'}</td>
                <td>
                  모{ship.adventureLv}/교{ship.tradeLv}/전{ship.battleLv}
                </td>
                <td>{ship.acquireType || '-'}</td>
                <td>{ship.acquireMethod || '-'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  {ships.length === 0 ? emptyText : '검색 결과가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="catalog-pager" aria-label="선박 목록 페이지">
          <button
            type="button"
            className="admin-btn"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            이전
          </button>
          <span>
            {safePage + 1} / {totalPages}
            <em>
              · {filtered.length}개
              {query.trim() ? ` (전체 ${ships.length})` : ''}
            </em>
          </span>
          <button
            type="button"
            className="admin-btn"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}
