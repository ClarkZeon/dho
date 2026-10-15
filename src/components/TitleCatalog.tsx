import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchTitles } from '../lib/api'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { TitleDetail } from '../types'
import { DetailModal } from './DetailModal'
import { SortableTh } from './SortableTh'
import { TitleDetailView } from './TitleDetailView'

const PAGE_SIZE = 15

type TitleCatalogProps = {
  token: string
}

type SortKey = 'name' | 'effect' | 'requirement'

export function TitleCatalog({ token }: TitleCatalogProps) {
  const [titles, setTitles] = useState<TitleDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<TitleDetail | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const { sortKey, sortDir, toggleSort, sortRows } = useTableSort<SortKey>()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchTitles(token)
        if (!alive) return
        setTitles(res.titles)
        setPage(0)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '호칭 목록을 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  useEffect(() => {
    setPage(0)
  }, [query, sortKey, sortDir])

  const filtered = titles.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const hay = [
      item.name,
      item.altName,
      item.effect,
      item.requirement,
      item.description,
    ]
      .filter((v) => v != null && v !== '')
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  const rows = sortRows(
    filtered,
    (item, key) => item[key],
    (a, b) => a.id - b.id,
    compareIdDesc,
  )
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>호칭</h1>
          <p>등록된 호칭을 확인하고 상세를 엽니다.</p>
        </div>
      </div>

      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·효과·필요로 검색"
          aria-label="호칭 검색"
          autoComplete="off"
          disabled={loading}
        />
      </label>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="form-note">불러오는 중…</p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <SortableTh
                    label="이름"
                    sortKey="name"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableTh
                    className="col-desk"
                    label="효과"
                    sortKey="effect"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableTh
                    className="col-desk"
                    label="필요"
                    sortKey="requirement"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                    tabIndex={0}
                    onClick={() => setDetail(item)}
                    onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setDetail(item)
                      }
                    }}
                  >
                    <td>{item.name}</td>
                    <td className="col-desk">{item.effect || '-'}</td>
                    <td className="col-desk">{item.requirement || '-'}</td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={3}>
                      {titles.length === 0
                        ? '등록된 호칭이 없습니다.'
                        : '검색 결과가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > PAGE_SIZE ? (
            <div className="catalog-pager">
              <button
                type="button"
                className="admin-btn"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                이전
              </button>
              <span>
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                className="admin-btn"
                disabled={safePage >= pageCount - 1}
                onClick={() =>
                  setPage((p) => Math.min(pageCount - 1, p + 1))
                }
              >
                다음
              </button>
            </div>
          ) : null}
        </>
      )}

      {detail && (
        <DetailModal
          title="호칭 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <TitleDetailView title={detail} />
        </DetailModal>
      )}
    </section>
  )
}
