import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchEntryPermits } from '../lib/api'
import { matchesEntryPermitQuery } from '../lib/entryPermitSearch'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { EntryPermitDetail } from '../types'
import { DetailModal } from './DetailModal'
import { EntryPermitDetailView } from './EntryPermitDetailView'
import { SortableTh } from './SortableTh'

type EntryPermitCatalogProps = {
  token: string
}

type SortKey = 'name' | 'altName'

export function EntryPermitCatalog({ token }: EntryPermitCatalogProps) {
  const [items, setItems] = useState<EntryPermitDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<EntryPermitDetail | null>(null)
  const [query, setQuery] = useState('')
  const { sortKey, sortDir, toggleSort, sortRows } = useTableSort<SortKey>()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchEntryPermits(token)
        if (!alive) return
        setItems(res.entryPermits)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '입항허가 목록을 불러오지 못했습니다.',
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
    items.filter((item) => matchesEntryPermitQuery(item, query)),
    (item, key) => item[key],
    (a, b) => a.id - b.id,
    compareIdDesc,
  )

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>입항허가</h1>
          <p>등록된 입항허가와 택일 퀘스트를 확인합니다.</p>
        </div>
      </div>

      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·도시·퀘스트로 검색"
          aria-label="입항허가 검색"
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
                <th className="col-desk">도시</th>
                <th className="col-desk">퀘스트 수</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => {
                const questCount = (item.cityQuests || []).reduce(
                  (sum, c) => sum + c.quests.length,
                  0,
                )
                return (
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
                    <td className="col-desk">{item.altName || '-'}</td>
                    <td className="col-desk">
                      {(item.cityQuests || []).map((c) => c.city).join(', ') ||
                        '-'}
                    </td>
                    <td className="col-desk">{questCount}</td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    {items.length === 0
                      ? '등록된 입항허가가 없습니다.'
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
          title="입항허가 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <EntryPermitDetailView permit={detail} />
        </DetailModal>
      )}
    </section>
  )
}
