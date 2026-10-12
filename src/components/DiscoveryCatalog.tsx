import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchDiscoveries } from '../lib/api'
import { formatDiscoveryAcquire } from '../lib/discoveryAcquire'
import { useTableSort } from '../lib/tableSort'
import type { DiscoveryDetail } from '../types'
import { DetailModal } from './DetailModal'
import { DiscoveryDetailView } from './DiscoveryDetailView'
import { DiscoveryRankMark } from './DiscoveryRankMark'
import { SortableTh } from './SortableTh'

type DiscoveryCatalogProps = {
  token: string
}

type DiscoverySortKey = 'name' | 'category' | 'rank' | 'cardPoints' | 'acquire'

function acquireLabel(discovery: DiscoveryDetail) {
  return formatDiscoveryAcquire(discovery)
}

export function DiscoveryCatalog({ token }: DiscoveryCatalogProps) {
  const [discoveries, setDiscoveries] = useState<DiscoveryDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<DiscoveryDetail | null>(null)
  const [query, setQuery] = useState('')
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<DiscoverySortKey>()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchDiscoveries(token)
        if (!alive) return
        setDiscoveries(res.discoveries)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '발견물 목록을 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const filtered = discoveries.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const hay = [
      item.name,
      item.category,
      item.rank,
      item.acquireType,
      item.acquireName,
      acquireLabel(item),
      item.place,
    ]
      .filter((v) => v != null && v !== '')
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  const rows = sortRows(
    filtered,
    (item, key) => {
      if (key === 'acquire') return acquireLabel(item)
      return item[key]
    },
    (a, b) => a.id - b.id,
  )

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>발견물</h1>
          <p>등록된 발견물을 확인하고 상세를 엽니다.</p>
        </div>
      </div>

      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·분류·획득으로 검색"
          aria-label="발견물 검색"
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
                  label="등급"
                  sortKey="rank"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="카드"
                  sortKey="cardPoints"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="획득"
                  sortKey="acquire"
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
                  <td className="col-desk">
                    {item.rank != null ? (
                      <DiscoveryRankMark rank={item.rank} />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="col-desk">{item.cardPoints ?? '-'}</td>
                  <td className="col-desk">{acquireLabel(item) || '-'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    {discoveries.length === 0
                      ? '등록된 발견물이 없습니다.'
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
          title="발견물 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <DiscoveryDetailView discovery={detail} />
        </DetailModal>
      )}
    </section>
  )
}
