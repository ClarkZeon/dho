import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useTableSort } from '../lib/tableSort'
import type { ShipDetail } from '../types'
import { SortableTh } from './SortableTh'

const PAGE_SIZE = 15

type ShipSortKey = 'name' | 'category' | 'size' | 'form' | 'level'

type ShipListProps = {
  ships: ShipDetail[]
  onOpen: (ship: ShipDetail) => void
  onDelete?: (ship: ShipDetail) => void
  deletingId?: number | null
  emptyText?: string
}

function matchesShipQuery(ship: ShipDetail, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    ship.name,
    ship.slug,
    ship.category,
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
  onDelete,
  deletingId = null,
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
  const colCount = onDelete ? 6 : 5

  function handleSort(key: ShipSortKey) {
    toggleSort(key)
    setPage(0)
  }

  function handleDeleteClick(
    event: MouseEvent<HTMLButtonElement>,
    ship: ShipDetail,
  ) {
    event.stopPropagation()
    onDelete?.(ship)
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
          placeholder="이름·분류로 검색"
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
                className="col-desk"
                label="분류"
                sortKey="category"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                className="col-desk"
                label="크기"
                sortKey="size"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                className="col-desk"
                label="형태"
                sortKey="form"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                className="col-desk"
                label="레벨"
                sortKey="level"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              {onDelete && <th className="col-desk">삭제</th>}
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
                <td className="col-desk">{ship.category || '-'}</td>
                <td className="col-desk">{ship.size || '-'}</td>
                <td className="col-desk">{ship.form || '-'}</td>
                <td className="col-desk">
                  모{ship.adventureLv}/교{ship.tradeLv}/전{ship.battleLv}
                </td>
                {onDelete && (
                  <td
                    className="admin-cell-control col-desk"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="admin-danger-btn"
                      disabled={deletingId === ship.id}
                      onClick={(e) => handleDeleteClick(e, ship)}
                    >
                      삭제
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={colCount}>
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
