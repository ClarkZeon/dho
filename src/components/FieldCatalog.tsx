import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchFields } from '../lib/api'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { FieldDetail } from '../types'
import { DetailModal } from './DetailModal'
import { FieldDetailView } from './FieldDetailView'
import { SortableTh } from './SortableTh'

type FieldCatalogProps = {
  token: string
}

type FieldSortKey = 'name' | 'fieldKind' | 'region' | 'seaArea'

export function FieldCatalog({ token }: FieldCatalogProps) {
  const [fields, setFields] = useState<FieldDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<FieldDetail | null>(null)
  const [query, setQuery] = useState('')
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<FieldSortKey>()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchFields(token)
        if (!alive) return
        setFields(res.fields)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '필드 목록을 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const filtered = fields.filter((field) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const hay = [field.name, field.fieldKind, field.region, field.seaArea]
      .filter((v) => v != null && v !== '')
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  const rows = sortRows(
    filtered,
    (field, key) => field[key],
    (a, b) => a.id - b.id,
    compareIdDesc,
  )

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>필드</h1>
          <p>등록된 필드를 확인하고 육지 조사·보상을 봅니다.</p>
        </div>
      </div>

      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·종류·지역·해역으로 검색"
          aria-label="필드 검색"
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
                  label="종류"
                  sortKey="fieldKind"
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
                <th className="col-desk">좌표</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((field, index) => (
                <tr
                  key={field.id}
                  className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                  tabIndex={0}
                  onClick={() => setDetail(field)}
                  onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setDetail(field)
                    }
                  }}
                >
                  <td>{field.name}</td>
                  <td className="col-desk">{field.fieldKind || '-'}</td>
                  <td className="col-desk">{field.region || '-'}</td>
                  <td className="col-desk">{field.seaArea || '-'}</td>
                  <td className="col-desk">
                    {field.coordX != null && field.coordY != null
                      ? `${field.coordX}, ${field.coordY}`
                      : '-'}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    {fields.length === 0
                      ? '등록된 필드가 없습니다.'
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
          title="필드 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <FieldDetailView field={detail} />
        </DetailModal>
      )}
    </section>
  )
}
