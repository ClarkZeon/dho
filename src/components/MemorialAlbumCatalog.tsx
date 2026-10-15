import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchMemorialAlbums } from '../lib/api'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { MemorialAlbumDetail } from '../types'
import { DetailModal } from './DetailModal'
import { MemorialAlbumDetailView } from './MemorialAlbumDetailView'
import { SortableTh } from './SortableTh'

type MemorialAlbumCatalogProps = {
  token: string
}

type SortKey = 'name' | 'category' | 'rewardNpc' | 'itemCount'

export function MemorialAlbumCatalog({ token }: MemorialAlbumCatalogProps) {
  const [albums, setAlbums] = useState<MemorialAlbumDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<MemorialAlbumDetail | null>(null)
  const [query, setQuery] = useState('')
  const { sortKey, sortDir, toggleSort, sortRows } = useTableSort<SortKey>()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchMemorialAlbums(token)
        if (!alive) return
        setAlbums(res.memorialAlbums)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '메모리얼 앨범 목록을 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const filtered = albums.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const hay = [
      item.name,
      item.category,
      item.rewardNpc,
      item.rewardItem,
      item.description,
      ...(item.items || []).map((r) => r.name),
      ...(item.items || []).map((r) => r.note),
    ]
      .filter((v) => v != null && v !== '')
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  const rows = sortRows(
    filtered,
    (item, key) => {
      if (key === 'itemCount') return item.itemCount ?? item.items.length
      return item[key]
    },
    (a, b) => a.id - b.id,
    compareIdDesc,
  )

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>메모리얼 앨범</h1>
          <p>등록된 메모리얼 앨범을 확인하고 상세를 엽니다.</p>
        </div>
      </div>

      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·분류·항목으로 검색"
          aria-label="메모리얼 앨범 검색"
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
                  label="보상 NPC"
                  sortKey="rewardNpc"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="항목"
                  sortKey="itemCount"
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
                  <td className="col-desk">{item.rewardNpc || '-'}</td>
                  <td className="col-desk">
                    {item.itemCount ?? item.items.length}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    {albums.length === 0
                      ? '등록된 메모리얼 앨범이 없습니다.'
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
          title="메모리얼 앨범 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <MemorialAlbumDetailView album={detail} trackCompletion />
        </DetailModal>
      )}
    </section>
  )
}
