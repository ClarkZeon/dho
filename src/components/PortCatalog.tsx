import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  deletePort,
  fetchPorts,
  importPortText,
} from '../lib/api'
import { matchesPortQuery } from '../lib/portSearch'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { PortDetail } from '../types'
import { ConfirmLayer } from './ConfirmLayer'
import { DetailModal } from './DetailModal'
import { PortCategoryBadge } from './PortCategoryBadge'
import { PortDetailView } from './PortDetailView'
import { SortableTh } from './SortableTh'

type PortCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
  /** 해시 `#/ports?q=` 검색어 */
  initialQuery?: string
  /** 해시 `#/ports?open=` 상세 자동 오픈 (slug 또는 이름) */
  openKey?: string
  /** 해시 `#/ports?add=1` — 관리자 도시 추가 폼 오픈 */
  initialAdd?: boolean
}

type PortSortKey =
  | 'name'
  | 'category'
  | 'region'
  | 'seaArea'
  | 'entryPermit'
  | 'language'

export function PortCatalog({
  token,
  isAdmin = false,
  onToast,
  initialQuery = '',
  openKey = '',
  initialAdd = false,
}: PortCatalogProps) {
  const [ports, setPorts] = useState<PortDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<PortDetail | null>(null)
  const [detailEditMode, setDetailEditMode] = useState(false)
  const [query, setQuery] = useState(initialQuery)
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
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<PortSortKey>()

  const loadPorts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchPorts(token)
      setPorts(res.ports)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '도시 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadPorts()
  }, [loadPorts])

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
    const found = ports.find(
      (p) =>
        p.slug === key ||
        p.name.trim().toLowerCase() === lower ||
        p.name.trim() === key ||
        String(p.id) === key,
    )
    const label = initialQuery.trim() || key
    if (initialQuery.trim()) setQuery(initialQuery.trim())
    if (!found) {
      setOpenMiss(label)
      return
    }
    setOpenMiss('')
    setQuery(initialQuery.trim() || found.name)
    setDetailEditMode(false)
    setDetail(found)
  }, [openKey, loading, ports, initialQuery])

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!canAdd) {
      setImportNote('관리자만 도시를 등록할 수 있습니다.')
      return
    }
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importPortText(token, importText)
      setImportText('')
      setShowImport(false)
      setImportNote(
        `「${res.port.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast?.(`도시 「${res.port.name}」 저장 완료`)
      await loadPorts()
    } catch (err) {
      setImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(port: PortDetail) {
    if (!window.confirm(`「${port.name}」 도시를 삭제할까요?`)) return
    setDeletingId(port.id)
    try {
      await deletePort(token, port.id)
      setPorts((prev) => prev.filter((p) => p.id !== port.id))
      if (detail?.id === port.id) setDetail(null)
      onToast?.(`도시 「${port.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  const rows = sortRows(
    ports.filter((port) => matchesPortQuery(port, query)),
    (port, key) => port[key],
    (a, b) => a.id - b.id,
    compareIdDesc,
  )
  const colCount = isAdmin ? 7 : 6

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>도시</h1>
          <p>
            {isAdmin
              ? '위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.'
              : '등록된 도시를 확인하고 상세를 엽니다.'}
          </p>
        </div>
        {canAdd && (
          <div className="admin-page-actions">
            <button
              type="button"
              className="btn-admin"
              onClick={() => void loadPorts()}
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
              {showImport ? '닫기' : '도시 추가'}
            </button>
          </div>
        )}
      </div>

      {canAdd && showImport && (
        <form className="admin-import-form" onSubmit={handleImport}>
          <label className="field">
            <span>도시 텍스트</span>
            <textarea
              className="quest-import-textarea"
              rows={16}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`도시리스본\n분류\t포르투갈본거지\t지역\t유럽 서부\n해역\t리스본 앞바다\t좌표\t15784, 3205\n입항허가\t북대서양\t문화\t이베리아\n언어\t포르투갈어\t시설\t서고, 의뢰 중개인, …`}
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
          placeholder="이름·지역·해역·언어로 검색"
          aria-label="도시 검색"
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
          message={`「${openMiss}」 도시가 없습니다.`}
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
                {isAdmin && <th className="col-desk col-action">삭제</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((port, index) => (
                <tr
                  key={port.id}
                  className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                  tabIndex={0}
                  onClick={() => {
                    setDetailEditMode(false)
                    setDetail(port)
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setDetailEditMode(false)
                      setDetail(port)
                    }
                  }}
                >
                  <td>{port.name}</td>
                  <td className="col-desk">
                    {port.category?.trim() ? (
                      <PortCategoryBadge category={port.category} />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="col-desk">{port.region || '-'}</td>
                  <td className="col-desk">{port.seaArea || '-'}</td>
                  <td className="col-desk">{port.entryPermit || '-'}</td>
                  <td className="col-desk">{port.language || '-'}</td>
                  {isAdmin && (
                    <td
                      className="col-desk col-action admin-cell-control"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn-admin"
                        disabled={deletingId === port.id}
                        onClick={() => void handleDelete(port)}
                      >
                        {deletingId === port.id ? '삭제 중…' : '삭제'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={colCount}>
                    {ports.length === 0
                      ? '등록된 도시가 없습니다.'
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
          title="도시 상세"
          label={`${detail.name} 상세`}
          onClose={() => {
            setDetail(null)
            setDetailEditMode(false)
          }}
          headerActions={
            isAdmin ? (
              <div className="detail-mode-toggle" role="group" aria-label="상세 모드">
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
          <PortDetailView
            port={detail}
            token={token}
            isAdmin={isAdmin}
            editMode={detailEditMode}
            edit={
              isAdmin
                ? {
                    token,
                    onSaved: (port) => {
                      setPorts((prev) =>
                        prev.map((p) => (p.id === port.id ? port : p)),
                      )
                      setDetail(port)
                    },
                    onToast,
                  }
                : undefined
            }
          />
        </DetailModal>
      )}
    </section>
  )
}
