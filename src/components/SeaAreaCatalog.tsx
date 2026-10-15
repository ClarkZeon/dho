import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchSeaAreas } from '../lib/api'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { SeaAreaDetail } from '../types'
import { DetailModal } from './DetailModal'
import { SeaAreaDetailView } from './SeaAreaDetailView'
import { SortableTh } from './SortableTh'

type SeaAreaCatalogProps = {
  token: string
}

type SeaAreaSortKey = 'name' | 'category' | 'region' | 'wave' | 'current'

export function SeaAreaCatalog({ token }: SeaAreaCatalogProps) {
  const [seaAreas, setSeaAreas] = useState<SeaAreaDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<SeaAreaDetail | null>(null)
  const [query, setQuery] = useState('')
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<SeaAreaSortKey>()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchSeaAreas(token)
        if (!alive) return
        setSeaAreas(res.seaAreas)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '해역 목록을 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const filtered = seaAreas.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const hay = [item.name, item.category, item.region, item.wave, item.current]
      .filter((v) => v != null && v !== '')
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  const rows = sortRows(
    filtered,
    (item, key) => item[key],
    (a, b) => b.id - a.id,
    compareIdDesc,
  )

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>해역</h1>
          <p>등록된 해역의 경계·수집·목적지·해상 NPC를 확인합니다.</p>
        </div>
      </div>

      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·분류·지역으로 검색"
          aria-label="해역 검색"
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
                  label="분류"
                  sortKey="category"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="지역"
                  sortKey="region"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="파도"
                  sortKey="wave"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="조류"
                  sortKey="current"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => (
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
                  <td className="col-desk">{item.category || '-'}</td>
                  <td className="col-desk">{item.region || '-'}</td>
                  <td className="col-desk">{item.wave ?? '-'}</td>
                  <td className="col-desk">{item.current ?? '-'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="form-note">
                    {seaAreas.length === 0
                      ? '등록된 해역이 없습니다.'
                      : '검색 결과가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <DetailModal
          title="해역 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <SeaAreaDetailView seaArea={detail} />
        </DetailModal>
      )}
    </section>
  )
}
