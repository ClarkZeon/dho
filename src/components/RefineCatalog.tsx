import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { deleteRefine, fetchRefines, importRefineText } from '../lib/api'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { RefineDetail } from '../types'
import { DetailModal } from './DetailModal'
import { RefineDetailView } from './RefineDetailView'
import { SortableTh } from './SortableTh'

const PAGE_SIZE = 15

type RefineCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
}

type SortKey = 'name' | 'actionPower'

export function RefineCatalog({
  token,
  isAdmin = false,
  onToast,
}: RefineCatalogProps) {
  const [refines, setRefines] = useState<RefineDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<RefineDetail | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const { sortKey, sortDir, toggleSort, sortRows } = useTableSort<SortKey>()

  const loadRefines = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchRefines(token)
      setRefines(res.refines)
      setPage(0)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '연성 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadRefines()
  }, [loadRefines])

  useEffect(() => {
    setPage(0)
  }, [query, sortKey, sortDir])

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importRefineText(token, importText)
      setImportText('')
      setShowImport(false)
      setImportNote(
        `「${res.refine.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast?.(`연성 「${res.refine.name}」 저장 완료`)
      await loadRefines()
    } catch (err) {
      setImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(item: RefineDetail) {
    if (!window.confirm(`「${item.name}」 연성을 삭제할까요?`)) return
    setDeletingId(item.id)
    try {
      await deleteRefine(token, item.id)
      setRefines((prev) => prev.filter((r) => r.id !== item.id))
      if (detail?.id === item.id) setDetail(null)
      onToast?.(`연성 「${item.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = refines.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const hay = [
      item.name,
      item.description,
      item.actionPower,
      item.skills.join(' '),
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

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>연성</h1>
          <p>
            {isAdmin
              ? '위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.'
              : '등록된 연성 효과를 확인하고 상세를 엽니다.'}
          </p>
        </div>
        {isAdmin && (
          <div className="admin-page-actions">
            <button
              type="button"
              className="btn-admin"
              onClick={() => void loadRefines()}
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
              {showImport ? '닫기' : '연성 추가'}
            </button>
          </div>
        )}
      </div>

      {isAdmin && showImport && (
        <form className="admin-import-form" onSubmit={handleImport}>
          <label className="field">
            <span>연성 텍스트</span>
            <textarea
              className="quest-import-textarea"
              rows={10}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`연성 효과 | 발견 시 피로 회복\n발견물을 발견했을 때 획득하는 모험 경험치가 증가하고 피로가 회복된다.\n\n행동력\t자동효과\t스킬\t생태 조사, 인식, 탐색`}
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
          placeholder="이름·설명·스킬로 검색"
          aria-label="연성 검색"
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
                    label="행동력"
                    sortKey="actionPower"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="col-desk">스킬</th>
                  {isAdmin && <th className="col-desk col-action">삭제</th>}
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
                    <td className="col-desk">{item.actionPower || '-'}</td>
                    <td className="col-desk">
                      {item.skills.length > 0 ? item.skills.join(', ') : '-'}
                    </td>
                    {isAdmin && (
                      <td
                        className="col-desk col-action admin-cell-control"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="btn-admin"
                          disabled={deletingId === item.id}
                          onClick={() => void handleDelete(item)}
                        >
                          {deletingId === item.id ? '삭제 중…' : '삭제'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={colCount}>
                      {refines.length === 0
                        ? '등록된 연성이 없습니다.'
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
          title="연성 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <RefineDetailView refine={detail} />
        </DetailModal>
      )}
    </section>
  )
}
