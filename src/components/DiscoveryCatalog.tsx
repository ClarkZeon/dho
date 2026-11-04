import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  deleteDiscovery,
  fetchDiscoveries,
  importDiscoveryText,
  updateDiscovery,
} from '../lib/api'
import { formatDiscoveryAcquire } from '../lib/discoveryAcquire'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { DiscoveryDetail } from '../types'
import { DetailModal } from './DetailModal'
import { DiscoveryDetailView } from './DiscoveryDetailView'
import { DiscoveryRankMark } from './DiscoveryRankMark'
import { SortableTh } from './SortableTh'

type DiscoveryCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
}

type DiscoverySortKey = 'name' | 'category' | 'rank' | 'cardPoints' | 'acquire'

function acquireLabel(discovery: DiscoveryDetail) {
  return formatDiscoveryAcquire(discovery)
}

export function DiscoveryCatalog({
  token,
  isAdmin = false,
  onToast,
}: DiscoveryCatalogProps) {
  const [discoveries, setDiscoveries] = useState<DiscoveryDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<DiscoveryDetail | null>(null)
  const [query, setQuery] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [busyRankId, setBusyRankId] = useState<number | null>(null)
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<DiscoverySortKey>()

  const loadDiscoveries = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchDiscoveries(token)
      setDiscoveries(res.discoveries)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '발견물 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadDiscoveries()
  }, [loadDiscoveries])

  function applyUpdate(discovery: DiscoveryDetail) {
    setDiscoveries((prev) =>
      prev.map((d) => (d.id === discovery.id ? discovery : d)),
    )
    setDetail((prev) => (prev?.id === discovery.id ? discovery : prev))
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importDiscoveryText(token, importText)
      setImportText('')
      setShowImport(false)
      setImportNote(
        `「${res.discovery.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast?.(`발견물 「${res.discovery.name}」 저장 완료`)
      await loadDiscoveries()
    } catch (err) {
      setImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(discovery: DiscoveryDetail) {
    if (!window.confirm(`「${discovery.name}」 발견물을 삭제할까요?`)) return
    setDeletingId(discovery.id)
    try {
      await deleteDiscovery(token, discovery.id)
      setDiscoveries((prev) => prev.filter((d) => d.id !== discovery.id))
      if (detail?.id === discovery.id) setDetail(null)
      onToast?.(`발견물 「${discovery.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRankChange(discovery: DiscoveryDetail, value: string) {
    const rank = value === '' ? null : Number(value)
    if (rank !== null && (!Number.isInteger(rank) || rank < 0 || rank > 10)) {
      return
    }
    if (rank === discovery.rank) return
    setBusyRankId(discovery.id)
    try {
      const res = await updateDiscovery(token, discovery.id, { rank })
      applyUpdate(res.discovery)
      onToast?.(`「${res.discovery.name}」 난이도 저장`)
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : '난이도 저장에 실패했습니다.',
      )
    } finally {
      setBusyRankId(null)
    }
  }

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
    compareIdDesc,
  )

  const colCount = isAdmin ? 6 : 5

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>발견물</h1>
          <p>
            {isAdmin
              ? '위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.'
              : '등록된 발견물을 확인하고 상세를 엽니다.'}
          </p>
        </div>
        {isAdmin && (
          <div className="admin-page-actions">
            <button
              type="button"
              className="btn-admin"
              onClick={() => void loadDiscoveries()}
              disabled={loading}
            >
              새로고침
            </button>
            <button
              type="button"
              className="btn-admin btn-admin-primary"
              onClick={() => {
                setShowImport((v) => !v)
                setImportNote('')
              }}
            >
              {showImport ? '닫기' : '발견물 추가'}
            </button>
          </div>
        )}
      </div>

      {isAdmin && showImport && (
        <form className="admin-import-form" onSubmit={handleImport}>
          <label className="field">
            <span>발견물 텍스트</span>
            <textarea
              className="quest-import-textarea"
              rows={16}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`발견물 | 비단뱀\n대형 뱀으로 특히 큰 것은 10m나 된다. …\n분류\t생물 » 대형생물\n난이도\t5\n카드 포인트\t6\n발견 경험치\t1,118\n카드 획득 경험치\t559\n보고시 명성\t559\n발견 방법\t[퀘스트] 모험 | 악어냐 물고기냐 (7 생태 조사 8, 생물학 10, 프랑스어 1) - 마르세이유`}
              disabled={importing}
            />
          </label>
          <div className="form-actions">
            <button
              type="submit"
              className="btn-admin btn-admin-primary"
              disabled={importing}
            >
              {importing ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      )}

      {importNote && (
        <p
          className={`form-note${
            /실패|못|오류|에러|중복/.test(importNote) ? ' error' : ''
          }`}
        >
          {importNote}
        </p>
      )}

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
                  label={isAdmin ? '난이도' : '등급'}
                  sortKey="rank"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label={isAdmin ? '카드P' : '카드'}
                  sortKey="cardPoints"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label={isAdmin ? '발견 방법' : '획득'}
                  sortKey="acquire"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                {isAdmin && <th className="col-desk">삭제</th>}
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
                  <td
                    className={`col-desk${isAdmin ? ' admin-cell-control col-diff' : ''}`}
                    onClick={isAdmin ? (e) => e.stopPropagation() : undefined}
                    onKeyDown={
                      isAdmin ? (e) => e.stopPropagation() : undefined
                    }
                  >
                    {isAdmin ? (
                      <select
                        className="quest-diff-select admin-control"
                        value={item.rank ?? ''}
                        disabled={busyRankId === item.id}
                        aria-label={`${item.name} 난이도`}
                        onChange={(e) =>
                          void handleRankChange(item, e.target.value)
                        }
                      >
                        <option value="">-</option>
                        {Array.from({ length: 11 }, (_, n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    ) : item.rank != null ? (
                      <DiscoveryRankMark rank={item.rank} />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="col-desk">{item.cardPoints ?? '-'}</td>
                  <td className="col-desk">{acquireLabel(item) || '-'}</td>
                  {isAdmin && (
                    <td
                      className="admin-cell-control col-desk"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="admin-danger-btn"
                        disabled={deletingId === item.id}
                        onClick={() => void handleDelete(item)}
                      >
                        삭제
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={colCount}>
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
          <DiscoveryDetailView
            discovery={detail}
            basicInfoEdit={
              isAdmin
                ? {
                    token,
                    onToast,
                    onSaved: applyUpdate,
                  }
                : undefined
            }
          />
        </DetailModal>
      )}
    </section>
  )
}
