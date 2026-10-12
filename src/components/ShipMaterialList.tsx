import { useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  effectNumeric,
  effectsByColumn,
  matchesMaterialKind,
  matchesMaterialQuery,
  MATERIAL_KIND_FILTERS,
  MATERIAL_STAT_COLUMNS,
  type MaterialSortKey,
} from '../lib/shipMaterialStats'
import { useTableSort } from '../lib/tableSort'
import type { ShipMaterialDetail } from '../types'
import { SortableTh } from './SortableTh'

const PAGE_SIZE = 15

type ShipMaterialListProps = {
  materials: ShipMaterialDetail[]
  onOpen: (material: ShipMaterialDetail) => void
}

function buildPageWindow(current: number, total: number, maxButtons = 10) {
  if (total <= maxButtons) {
    return Array.from({ length: total }, (_, i) => i)
  }
  const half = Math.floor(maxButtons / 2)
  let start = Math.max(0, current - half)
  let end = start + maxButtons
  if (end > total) {
    end = total
    start = Math.max(0, end - maxButtons)
  }
  return Array.from({ length: end - start }, (_, i) => start + i)
}

export function ShipMaterialList({ materials, onOpen }: ShipMaterialListProps) {
  const [selectedKinds, setSelectedKinds] = useState<Set<string>>(
    () => new Set(),
  )
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const { sortKey, sortDir, toggleSort, sortRows, clearSort } =
    useTableSort<MaterialSortKey>()

  const filtered = sortRows(
    materials.filter(
      (material) =>
        matchesMaterialKind(material, selectedKinds) &&
        matchesMaterialQuery(material, query),
    ),
    (material, key) => {
      if (key === 'id') return material.id
      if (key === 'name') return material.name
      return effectNumeric(material.effects, key)
    },
    (a, b) => a.id - b.id,
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )
  const pageWindow = buildPageWindow(safePage, totalPages)

  function toggleKind(kind: string) {
    setSelectedKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
    setPage(0)
  }

  function handleSearch(event?: FormEvent) {
    event?.preventDefault()
    setQuery(draftQuery)
    setPage(0)
  }

  function handleReset() {
    setSelectedKinds(new Set())
    setDraftQuery('')
    setQuery('')
    clearSort()
    setPage(0)
  }

  function handleSort(key: MaterialSortKey) {
    toggleSort(key)
    setPage(0)
  }

  return (
    <div className="material-list">
      <div className="material-list-toolbar">
        <div className="material-list-kinds" role="group" aria-label="재료 종류">
          <span className="material-list-tag">선박 재료</span>
          {MATERIAL_KIND_FILTERS.map((kind) => (
            <label key={kind} className="material-list-check">
              <input
                type="checkbox"
                checked={selectedKinds.has(kind)}
                onChange={() => toggleKind(kind)}
              />
              <span>{kind}</span>
            </label>
          ))}
        </div>

        <form className="material-list-search" onSubmit={handleSearch}>
          <input
            type="search"
            value={draftQuery}
            onChange={(e) => setDraftQuery(e.target.value)}
            placeholder="재료 이름 검색"
            aria-label="선박 재료 검색"
            autoComplete="off"
          />
          <button type="submit" className="admin-btn admin-btn-primary">
            검색
          </button>
          <button type="button" className="admin-btn" onClick={handleReset}>
            초기화
          </button>
        </form>
      </div>

      <div className="admin-table-wrap material-list-table-wrap">
        <table className="admin-table material-list-table">
          <thead>
            <tr>
              <SortableTh
                label="번호"
                sortKey="id"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="center"
              />
              <SortableTh
                label="선박 재료"
                sortKey="name"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              {MATERIAL_STAT_COLUMNS.map((stat) => (
                <SortableTh
                  key={stat}
                  label={stat}
                  sortKey={stat}
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="center"
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((material, index) => {
              const stats = effectsByColumn(material.effects)
              return (
                <tr
                  key={material.id}
                  className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                  tabIndex={0}
                  onClick={() => onOpen(material)}
                  onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onOpen(material)
                    }
                  }}
                >
                  <td className="material-list-num">{material.id}</td>
                  <td>{material.name}</td>
                  {MATERIAL_STAT_COLUMNS.map((stat) => (
                    <td key={stat} className="material-list-stat">
                      {stats[stat] || ''}
                    </td>
                  ))}
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={2 + MATERIAL_STAT_COLUMNS.length}>
                  {materials.length === 0
                    ? '등록된 선박 재료가 없습니다.'
                    : '검색 결과가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="material-list-pager" aria-label="선박 재료 목록 페이지">
          <button
            type="button"
            className="text-link"
            disabled={safePage <= 0}
            onClick={() => setPage(0)}
          >
            &quot;첫 페이지&quot;
          </button>
          {pageWindow.map((pageIndex) => (
            <button
              key={pageIndex}
              type="button"
              className={`material-list-page${pageIndex === safePage ? ' is-current' : ''}`}
              onClick={() => setPage(pageIndex)}
            >
              {pageIndex + 1}
            </button>
          ))}
          <button
            type="button"
            className="text-link"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
          >
            &quot;끝 페이지&quot;
          </button>
        </div>
      )}
    </div>
  )
}
