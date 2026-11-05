import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { fetchTreasureMaps } from '../lib/api'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { TreasureMapDetail } from '../types'
import { ConfirmLayer } from './ConfirmLayer'
import { DetailModal } from './DetailModal'
import { SortableTh } from './SortableTh'
import { TreasureMapDetailView } from './TreasureMapDetailView'

const PAGE_SIZE = 15

type TreasureMapCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
  /** 해시 `#/treasure-maps?q=` 검색어 */
  initialQuery?: string
  /** 해시 `#/treasure-maps?open=` 상세 자동 오픈 */
  openKey?: string
  /** 해시 `#/treasure-maps?add=1` — 검색어 채움 (등록은 관리자 패널) */
  initialAdd?: boolean
}

type SortKey = 'name' | 'category' | 'academicField' | 'destination'

export function TreasureMapCatalog({
  token,
  isAdmin = false,
  initialQuery = '',
  openKey = '',
  initialAdd = false,
}: TreasureMapCatalogProps) {
  const [maps, setMaps] = useState<TreasureMapDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<TreasureMapDetail | null>(null)
  const [query, setQuery] = useState(initialQuery)
  const [page, setPage] = useState(0)
  const [openMiss, setOpenMiss] = useState('')
  const openedKeyRef = useRef('')
  const { sortKey, sortDir, toggleSort, sortRows } = useTableSort<SortKey>()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchTreasureMaps(token)
        if (!alive) return
        setMaps(res.treasureMaps)
        setPage(0)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error ? err.message : '지도 목록을 불러오지 못했습니다.',
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
    if (initialQuery.trim()) setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    if (initialAdd && initialQuery.trim()) setQuery(initialQuery.trim())
  }, [initialAdd, initialQuery])

  useEffect(() => {
    const key = openKey.trim()
    if (!key || loading) return
    if (openedKeyRef.current === key) return
    openedKeyRef.current = key
    const lower = key.toLowerCase()
    const found = maps.find(
      (m) =>
        m.slug === key ||
        m.name.trim().toLowerCase() === lower ||
        m.name.trim() === key ||
        String(m.id) === key,
    )
    const label = initialQuery.trim() || key
    if (initialQuery.trim()) setQuery(initialQuery.trim())
    if (!found) {
      setOpenMiss(label)
      return
    }
    setOpenMiss('')
    setQuery(initialQuery.trim() || found.name)
    setDetail(found)
  }, [openKey, loading, maps, initialQuery])

  useEffect(() => {
    setPage(0)
  }, [query, sortKey, sortDir])

  const filtered = maps.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const hay = [
      item.name,
      item.category,
      item.academicField,
      item.destinationCity,
      item.destination,
      ...(item.libraries || []),
      ...(item.discoveries || []).map((d) => d.name),
    ]
      .filter((v) => v != null && v !== '')
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  const rows = sortRows(
    filtered,
    (item, key) => {
      if (key === 'destination') {
        return [item.destinationCity, item.destination].filter(Boolean).join(' ')
      }
      return item[key]
    },
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
          <h1>지도</h1>
          <p>보물지도의 목적지·발견물·보상을 확인합니다.</p>
        </div>
      </div>

      {error ? (
        <p className="form-note error" role="alert">
          {error}
        </p>
      ) : null}

      {openMiss ? (
        <ConfirmLayer
          title="확인"
          message={`「${openMiss}」 지도가 없습니다.`}
          onCancel={() => setOpenMiss('')}
          confirmLabel={isAdmin ? '확인' : undefined}
          onConfirm={
            isAdmin
              ? () => {
                  setQuery(openMiss)
                  setOpenMiss('')
                }
              : undefined
          }
        />
      ) : null}

      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·분류·목적지·발견물로 검색"
          aria-label="지도 검색"
          autoComplete="off"
        />
      </label>

      {loading && maps.length === 0 ? (
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
                  label="분류"
                  sortKey="category"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="학문"
                  sortKey="academicField"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="목적지"
                  sortKey="destination"
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
                  <td>{item.category || '-'}</td>
                  <td>{item.academicField || '-'}</td>
                  <td>{item.destination || item.destinationCity || '-'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4}>등록된 지도가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="form-actions">
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
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </button>
        </div>
      )}

      {detail && (
        <DetailModal
          title="지도 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <TreasureMapDetailView map={detail} />
        </DetailModal>
      )}
    </section>
  )
}
