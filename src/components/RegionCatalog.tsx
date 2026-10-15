import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchRegions } from '../lib/api'
import { matchesRegionQuery } from '../lib/regionSearch'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { RegionDetail } from '../types'
import { DetailModal } from './DetailModal'
import { RegionDetailView } from './RegionDetailView'
import { SortableTh } from './SortableTh'

type RegionCatalogProps = {
  token: string
}

type RegionSortKey = 'name' | 'altName'

export function RegionCatalog({ token }: RegionCatalogProps) {
  const [regions, setRegions] = useState<RegionDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<RegionDetail | null>(null)
  const [query, setQuery] = useState('')
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<RegionSortKey>()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchRegions(token)
        if (!alive) return
        setRegions(res.regions)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '지역 목록을 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const rows = sortRows(
    regions.filter((region) => matchesRegionQuery(region, query)),
    (region, key) => region[key],
    (a, b) => a.id - b.id,
    compareIdDesc,
  )

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>지역</h1>
          <p>등록된 지역의 해역 그룹을 확인합니다.</p>
        </div>
      </div>

      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·해역으로 검색"
          aria-label="지역 검색"
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
                  label="추가 이름"
                  sortKey="altName"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <th className="col-desk">해역 그룹</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((region, index) => (
                <tr
                  key={region.id}
                  className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                  tabIndex={0}
                  onClick={() => setDetail(region)}
                  onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setDetail(region)
                    }
                  }}
                >
                  <td>{region.name}</td>
                  <td className="col-desk">{region.altName || '-'}</td>
                  <td className="col-desk">
                    {(region.seaGroups || []).map((g) => g.group).join(', ') ||
                      '-'}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    {regions.length === 0
                      ? '등록된 지역이 없습니다.'
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
          title="지역 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <RegionDetailView region={detail} />
        </DetailModal>
      )}
    </section>
  )
}
