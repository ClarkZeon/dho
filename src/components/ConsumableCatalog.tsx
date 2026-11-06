import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  deleteConsumable,
  fetchConsumables,
  importConsumableText,
} from '../lib/api'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { ConsumableDetail } from '../types'
import { ConfirmLayer } from './ConfirmLayer'
import { ConsumableDetailView } from './ConsumableDetailView'
import { DetailModal } from './DetailModal'
import { SortableTh } from './SortableTh'

const PAGE_SIZE = 15

type ConsumableCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
  initialQuery?: string
  openKey?: string
  initialAdd?: boolean
}

type SortKey = 'name' | 'category' | 'useEffect'

export function ConsumableCatalog({
  token,
  isAdmin = false,
  onToast,
  initialQuery = '',
  openKey = '',
  initialAdd = false,
}: ConsumableCatalogProps) {
  const [consumables, setConsumables] = useState<ConsumableDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<ConsumableDetail | null>(null)
  const [detailEditMode, setDetailEditMode] = useState(false)
  const [query, setQuery] = useState(initialQuery)
  const [page, setPage] = useState(0)
  const canAdd = isAdmin
  const [showImport, setShowImport] = useState(
    () => Boolean(canAdd && initialAdd),
  )
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [openMiss, setOpenMiss] = useState('')
  const openedKeyRef = useRef('')
  const { sortKey, sortDir, toggleSort, sortRows } = useTableSort<SortKey>()

  const loadConsumables = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchConsumables(token)
      setConsumables(res.consumables)
      setPage(0)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '소비품 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadConsumables()
  }, [loadConsumables])

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
    const found = consumables.find(
      (c) =>
        c.slug === key ||
        c.name.trim().toLowerCase() === lower ||
        c.name.trim() === key,
    )
    const label = initialQuery.trim() || key
    if (initialQuery.trim()) setQuery(initialQuery.trim())
    if (!found) {
      setOpenMiss(label)
      return
    }
    setOpenMiss('')
    setQuery(initialQuery.trim() || found.name)
    setPage(0)
    setDetailEditMode(false)
    setDetail(found)
  }, [openKey, loading, consumables, initialQuery])

  useEffect(() => {
    setPage(0)
  }, [query, sortKey, sortDir])

  function applyUpdate(consumable: ConsumableDetail) {
    setConsumables((prev) =>
      prev.map((c) => (c.id === consumable.id ? consumable : c)),
    )
    setDetail((prev) => (prev?.id === consumable.id ? consumable : prev))
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!canAdd) {
      setImportNote('관리자만 소비품을 등록할 수 있습니다.')
      return
    }
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importConsumableText(token, importText)
      setImportText('')
      setShowImport(false)
      setImportNote(
        `「${res.consumable.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast?.(`소비품 「${res.consumable.name}」 저장 완료`)
      await loadConsumables()
    } catch (err) {
      setImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(item: ConsumableDetail) {
    if (!window.confirm(`「${item.name}」 소비품을 삭제할까요?`)) return
    setDeletingId(item.id)
    try {
      await deleteConsumable(token, item.id)
      setConsumables((prev) => prev.filter((c) => c.id !== item.id))
      if (detail?.id === item.id) setDetail(null)
      onToast?.(`소비품 「${item.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = consumables.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const hay = [
      item.name,
      item.slug,
      item.description,
      item.category,
      item.useEffect,
      (item.acquireMethods || []).join(' '),
    ]
      .filter((v) => v != null && v !== '')
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  const rows = sortRows(
    filtered,
    (item, key) => item[key],
    (a, b) => a.id - b.id,
    compareIdDesc,
  )
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
  const colCount = isAdmin ? 4 : 3
  const countLabel = !loading
    ? query.trim()
      ? `검색 ${rows.length}개`
      : consumables.length > 0
        ? `${consumables.length}개`
        : ''
    : ''

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>소비품</h1>
          <p>
            {isAdmin
              ? '위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.'
              : '등록된 소비품을 확인하고 상세를 엽니다.'}
            {countLabel ? ` (${countLabel})` : ''}
          </p>
        </div>
        {canAdd && (
          <div className="admin-page-actions">
            <button
              type="button"
              className="btn-admin"
              onClick={() => void loadConsumables()}
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
              {showImport ? '닫기' : '소비품 추가'}
            </button>
          </div>
        )}
      </div>

      {canAdd && showImport && (
        <form className="admin-import-form" onSubmit={handleImport}>
          <label className="field">
            <span>소비품 텍스트</span>
            <textarea
              className="quest-import-textarea"
              rows={16}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`소비품 | 의뢰 알선서\n조합의 의뢰를 새롭게 제시받을 수 있다.\n\n분류\t아이템 획득\t사용효과\t의뢰 알선\n획득 방법\n구입\n생산\n퀘스트`}
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
          placeholder="이름·분류·효과로 검색"
          aria-label="소비품 검색"
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
        <>
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
                    label="사용효과"
                    sortKey="useEffect"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  {isAdmin && <th className="col-desk col-action">삭제</th>}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                    tabIndex={0}
                    onClick={() => {
                      setDetailEditMode(false)
                      setDetail(item)
                    }}
                    onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setDetailEditMode(false)
                        setDetail(item)
                      }
                    }}
                  >
                    <td>{item.name}</td>
                    <td className="col-desk">{item.category || '-'}</td>
                    <td className="col-desk">{item.useEffect || '-'}</td>
                    {isAdmin && (
                      <td
                        className="col-desk col-action admin-cell-control"
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
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={colCount}>
                      {consumables.length === 0
                        ? '등록된 소비품이 없습니다.'
                        : '검색 결과가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > PAGE_SIZE ? (
            <div className="catalog-pager">
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
                onClick={() =>
                  setPage((p) => Math.min(pageCount - 1, p + 1))
                }
              >
                다음
              </button>
            </div>
          ) : null}
        </>
      )}

      {detail && (
        <DetailModal
          title="소비품 상세"
          label={`${detail.name} 상세`}
          onClose={() => {
            setDetail(null)
            setDetailEditMode(false)
          }}
          headerActions={
            isAdmin ? (
              <div
                className="detail-mode-toggle"
                role="group"
                aria-label="상세 모드"
              >
                <button
                  type="button"
                  className={!detailEditMode ? 'active' : ''}
                  aria-pressed={!detailEditMode}
                  onClick={() => setDetailEditMode(false)}
                >
                  사용자 모드
                </button>
                <button
                  type="button"
                  className={detailEditMode ? 'active' : ''}
                  aria-pressed={detailEditMode}
                  onClick={() => setDetailEditMode(true)}
                >
                  수정 모드
                </button>
              </div>
            ) : undefined
          }
        >
          <ConsumableDetailView
            consumable={detail}
            edit={
              isAdmin && detailEditMode
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

      {openMiss ? (
        <ConfirmLayer
          title="확인"
          message={`「${openMiss}」 소비품이 없습니다.`}
          onCancel={() => setOpenMiss('')}
          confirmLabel={canAdd ? '등록하러 이동하기' : undefined}
          onConfirm={
            canAdd
              ? () => {
                  setQuery(openMiss)
                  setShowImport(true)
                  setOpenMiss('')
                }
              : undefined
          }
        />
      ) : null}
    </section>
  )
}
