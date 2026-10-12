import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchPorts } from '../lib/api'
import { matchesPortQuery } from '../lib/portSearch'
import { useTableSort } from '../lib/tableSort'
import type { PortDetail } from '../types'
import { DetailModal } from './DetailModal'
import { PortDetailView } from './PortDetailView'
import { SortableTh } from './SortableTh'

type PortCatalogProps = {
  token: string
}

type PortSortKey =
  | 'name'
  | 'category'
  | 'region'
  | 'seaArea'
  | 'entryPermit'
  | 'language'

export function PortCatalog({ token }: PortCatalogProps) {
  const [ports, setPorts] = useState<PortDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<PortDetail | null>(null)
  const [query, setQuery] = useState('')
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<PortSortKey>()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchPorts(token)
        if (!alive) return
        setPorts(res.ports)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '항구(도시) 목록을 불러오지 못했습니다.',
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
    ports.filter((port) => matchesPortQuery(port, query)),
    (port, key) => port[key],
    (a, b) => a.id - b.id,
  )

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>항구(도시)</h1>
          <p>등록된 항구(도시)를 확인하고 상세를 엽니다.</p>
        </div>
      </div>

      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·지역·해역·언어로 검색"
          aria-label="항구 검색"
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
                  label="해역"
                  sortKey="seaArea"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="입항허가"
                  sortKey="entryPermit"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="언어"
                  sortKey="language"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((port, index) => (
                <tr
                  key={port.id}
                  className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                  tabIndex={0}
                  onClick={() => setDetail(port)}
                  onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setDetail(port)
                    }
                  }}
                >
                  <td>{port.name}</td>
                  <td className="col-desk">{port.category || '-'}</td>
                  <td className="col-desk">{port.region || '-'}</td>
                  <td className="col-desk">{port.seaArea || '-'}</td>
                  <td className="col-desk">{port.entryPermit || '-'}</td>
                  <td className="col-desk">{port.language || '-'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    {ports.length === 0
                      ? '등록된 항구(도시)가 없습니다.'
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
          title="항구(도시) 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <PortDetailView port={detail} />
        </DetailModal>
      )}
    </section>
  )
}
