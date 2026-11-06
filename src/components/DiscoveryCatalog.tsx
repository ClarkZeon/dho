import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  deleteDiscovery,
  fetchDiscoveries,
  importDiscoveryText,
  setDiscoveryCompletion,
  updateDiscovery,
} from '../lib/api'
import { formatDiscoveryAcquire } from '../lib/discoveryAcquire'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { DiscoveryDetail } from '../types'
import { ConfirmLayer } from './ConfirmLayer'
import { DetailModal } from './DetailModal'
import { DiscoveryDetailView } from './DiscoveryDetailView'
import { DiscoveryRankMark } from './DiscoveryRankMark'
import { SortableTh } from './SortableTh'

type DiscoveryCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
  /** 해시 `#/discoveries?q=` 검색어 */
  initialQuery?: string
  /** 해시 `#/discoveries?open=` 상세 자동 오픈 (slug 또는 이름) */
  openKey?: string
  /** 해시 `#/discoveries?add=1` — 관리자 발견물 추가 폼 오픈 */
  initialAdd?: boolean
}

type DiscoverySortKey =
  | 'name'
  | 'category'
  | 'rank'
  | 'cardPoints'
  | 'acquireKind'
  | 'acquire'
  | 'acquirePlaces'

function acquireLabel(discovery: DiscoveryDetail) {
  return formatDiscoveryAcquire(discovery)
}

/** `[퀘스트] 모험 | 이름 (스킬) - 의뢰장소` → 종류 / 발견방법 / 의뢰장소 */
function splitAcquireLabel(label: string | null | undefined): {
  kind: string | null
  detail: string
  places: string | null
} {
  const raw = String(label || '').trim()
  if (!raw) return { kind: null, detail: '', places: null }

  let body = raw
  let kind: string | null = null
  const pipeParts = body.split(/\s*\|\s*/)
  if (pipeParts.length >= 2) {
    kind = pipeParts[0].trim() || null
    body = pipeParts.slice(1).join(' | ').trim()
  }

  let places: string | null = null
  const dash = body.match(/^(.*?)\s+-\s+(.+)$/)
  if (dash) {
    body = dash[1].trim()
    places = dash[2].trim() || null
  }

  return { kind, detail: body, places }
}

function acquirePlaces(discovery: DiscoveryDetail) {
  const fromQuest = discovery.acquireQuest?.requestPlaces?.trim()
  if (fromQuest) return fromQuest
  return splitAcquireLabel(acquireLabel(discovery)).places
}

/** 분류: `지리·천문 » 지리` — 그룹은 작게, 리프는 강조 */
function DiscoveryCategoryCell({
  category,
  categoryGroup,
}: {
  category: string | null | undefined
  categoryGroup?: string | null
}) {
  const leaf = String(category || '').trim()
  if (!leaf) return '-'
  const group = String(categoryGroup || '').trim()
  if (group && group !== leaf) {
    return (
      <span className="quest-cat-label">
        <em className="quest-cat-bracket">{group}</em>
        <span className="quest-cat-type">{leaf}</span>
      </span>
    )
  }

  const parts = leaf
    .split(/\s*[»›>]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length >= 2) {
    return (
      <span className="quest-cat-label">
        <em className="quest-cat-bracket">{parts[0]}</em>
        <span className="quest-cat-type">{parts.slice(1).join(' » ')}</span>
      </span>
    )
  }

  return <span className="quest-cat-type">{leaf}</span>
}

/** `[퀘스트] 모험` */
function DiscoveryAcquireKindCell({
  kind,
}: {
  kind: string | null | undefined
}) {
  const raw = String(kind || '').trim()
  if (!raw) return '-'

  const matched = raw.match(/^\[([^\]]+)\]\s*(.*)$/)
  if (matched) {
    const head = matched[1].trim()
    const type = matched[2].trim()
    return (
      <span className="quest-cat-label">
        <em className="quest-cat-bracket">[{head}]</em>
        {type ? <span className="quest-cat-type">{type}</span> : null}
      </span>
    )
  }

  return <span className="quest-cat-label">{raw}</span>
}

export function DiscoveryCatalog({
  token,
  isAdmin = false,
  onToast,
  initialQuery = '',
  openKey = '',
  initialAdd = false,
}: DiscoveryCatalogProps) {
  const [discoveries, setDiscoveries] = useState<DiscoveryDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<DiscoveryDetail | null>(null)
  const [query, setQuery] = useState(initialQuery)
  const canAdd = isAdmin
  const [showImport, setShowImport] = useState(
    () => Boolean(canAdd && initialAdd),
  )
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [busyRankId, setBusyRankId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [openMiss, setOpenMiss] = useState('')
  const openedKeyRef = useRef('')
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

  useEffect(() => {
    if (initialQuery.trim()) setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    if (!canAdd) {
      setShowImport(false)
      return
    }
    if (initialAdd) setShowImport(true)
  }, [canAdd, initialAdd])

  useEffect(() => {
    const key = openKey.trim()
    if (!key || loading) return
    if (openedKeyRef.current === key) return
    openedKeyRef.current = key
    const lower = key.toLowerCase()
    const found = discoveries.find(
      (d) =>
        d.slug === key ||
        d.name.trim().toLowerCase() === lower ||
        d.name.trim() === key ||
        String(d.id) === key,
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
  }, [openKey, loading, discoveries, initialQuery])

  function applyUpdate(discovery: DiscoveryDetail) {
    setDiscoveries((prev) =>
      prev.map((d) => (d.id === discovery.id ? discovery : d)),
    )
    setDetail((prev) => (prev?.id === discovery.id ? discovery : prev))
  }

  async function toggleCompleted(discovery: DiscoveryDetail, next: boolean) {
    if (busyId === discovery.id) return
    setBusyId(discovery.id)
    setError('')
    try {
      const res = await setDiscoveryCompletion(token, discovery.id, next)
      setDiscoveries((prev) =>
        prev.map((item) =>
          item.id === discovery.id
            ? {
                ...item,
                completed: res.completed,
                completedAt: res.completedAt,
              }
            : item,
        ),
      )
      if (res.completed) {
        setDetail(null)
      } else {
        setDetail((prev) =>
          prev && prev.id === discovery.id
            ? {
                ...prev,
                completed: res.completed,
                completedAt: res.completedAt,
              }
            : prev,
        )
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '완료 상태 저장에 실패했습니다.',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!canAdd) {
      setImportNote('관리자만 발견물을 등록할 수 있습니다.')
      return
    }
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
    if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 5)) {
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
      if (
        key === 'acquire' ||
        key === 'acquireKind' ||
        key === 'acquirePlaces'
      ) {
        const parts = splitAcquireLabel(acquireLabel(item))
        if (key === 'acquireKind') return parts.kind
        if (key === 'acquirePlaces') return acquirePlaces(item)
        return parts.detail
      }
      return item[key]
    },
    (a, b) => a.id - b.id,
    compareIdDesc,
  )

  const colCount = isAdmin ? 9 : 8
  const completedCount = discoveries.filter((d) => d.completed).length
  const countLabel = !loading
    ? query.trim()
      ? `검색 ${rows.length}개 · 전체 완료 ${completedCount}`
      : discoveries.length > 0
        ? `완료 ${completedCount}/${discoveries.length}`
        : ''
    : ''

  return (
    <section className="tool-page discovery-catalog">
      <div className="messages-head">
        <div>
          <h1>발견물</h1>
          <p>
            {isAdmin
              ? '위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.'
              : '등록된 발견물을 확인하고 상세에서 완료를 표시합니다.'}
            {countLabel ? ` (${countLabel})` : ''}
          </p>
        </div>
        {canAdd && (
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

      {canAdd && showImport && (
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

      {openMiss ? (
        <ConfirmLayer
          title="확인"
          message={`「${openMiss}」 발견물이 없습니다.`}
          onCancel={() => setOpenMiss('')}
          confirmLabel={canAdd ? '등록하러 이동하기' : undefined}
          onConfirm={
            canAdd
              ? () => {
                  setShowImport(true)
                  setQuery(openMiss)
                  setOpenMiss('')
                }
              : undefined
          }
        />
      ) : null}

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
                  label="종류"
                  sortKey="acquireKind"
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
                <SortableTh
                  className="col-desk"
                  label="의뢰 장소"
                  sortKey="acquirePlaces"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <th className="col-quest-done">완료</th>
                {isAdmin && <th className="col-desk">삭제</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => {
                const acquireParts = splitAcquireLabel(acquireLabel(item))
                const places = acquirePlaces(item)
                return (
                <tr
                  key={item.id}
                  className={`admin-row-clickable${item.completed ? ' is-quest-done' : ''}${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
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
                  <td className="col-desk">
                    <DiscoveryCategoryCell
                      category={item.category}
                      categoryGroup={item.categoryGroup}
                    />
                  </td>
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
                        {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
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
                  <td className="col-desk">
                    <DiscoveryAcquireKindCell kind={acquireParts.kind} />
                  </td>
                  <td className="col-desk">
                    {acquireParts.detail || '-'}
                  </td>
                  <td className="col-desk">{places || '-'}</td>
                  <td className="col-quest-done">
                    {item.completed ? (
                      <span
                        className="quest-done-check"
                        aria-label="완료"
                        title="완료"
                      >
                        ✓
                      </span>
                    ) : null}
                  </td>
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
                )
              })}
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
            token={token}
            isAdmin={isAdmin}
            completionBusy={busyId === detail.id}
            onToggleCompleted={(completed) =>
              void toggleCompleted(detail, completed)
            }
          />
        </DetailModal>
      )}
    </section>
  )
}
