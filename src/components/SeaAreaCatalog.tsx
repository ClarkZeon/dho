import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  deleteSeaArea,
  fetchSeaAreas,
  importSeaAreaText,
} from '../lib/api'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { SeaAreaDetail } from '../types'
import { ConfirmLayer } from './ConfirmLayer'
import { DetailModal } from './DetailModal'
import { SeaAreaDetailView } from './SeaAreaDetailView'
import { SortableTh } from './SortableTh'

type SeaAreaCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
  /** 해시 `#/sea-areas?q=` */
  initialQuery?: string
  /** 해시 `#/sea-areas?open=` — 목록 로드 후 1회 상세 오픈 */
  openKey?: string
  /** 해시 `#/sea-areas?add=1` — 관리자 해역 추가 폼 오픈 */
  initialAdd?: boolean
}

type SeaAreaSortKey = 'name' | 'category' | 'region' | 'wave' | 'current'

const SEA_AREA_IMPORT_PLACEHOLDER = `해역 | 동 캐롤라인 해저분지
분류	남태평양	지역	동남아시아
경계	북 : 4096, 서 : 6400, 남 : 5120, 동 : 7168	파도	12
조류	16	최대 속도 증가	50%
해역 내 장소
종류	내용
도시	괌
상륙지	뉴기니 섬 남해안`

export function SeaAreaCatalog({
  token,
  isAdmin = false,
  onToast,
  initialQuery = '',
  openKey = '',
  initialAdd = false,
}: SeaAreaCatalogProps) {
  const canAdd = isAdmin
  const [seaAreas, setSeaAreas] = useState<SeaAreaDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<SeaAreaDetail | null>(null)
  const [detailEditMode, setDetailEditMode] = useState(false)
  const [query, setQuery] = useState(initialQuery)
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
    useTableSort<SeaAreaSortKey>()

  const loadSeaAreas = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await fetchSeaAreas(token)
      setSeaAreas(res.seaAreas)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '해역 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadSeaAreas()
  }, [loadSeaAreas])

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
    const found = seaAreas.find(
      (s) =>
        s.slug === key ||
        s.name.trim().toLowerCase() === lower ||
        s.name.trim() === key ||
        String(s.id) === key,
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
  }, [openKey, loading, seaAreas, initialQuery])

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!canAdd) {
      setImportNote('관리자만 해역을 등록할 수 있습니다.')
      return
    }
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importSeaAreaText(token, importText)
      setImportText('')
      setShowImport(false)
      setImportNote(
        `「${res.seaArea.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast?.(`해역 「${res.seaArea.name}」 저장 완료`)
      await loadSeaAreas()
    } catch (err) {
      setImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(seaArea: SeaAreaDetail) {
    if (!window.confirm(`「${seaArea.name}」 해역을 삭제할까요?`)) return
    setDeletingId(seaArea.id)
    try {
      await deleteSeaArea(token, seaArea.id)
      onToast?.(`해역 「${seaArea.name}」을(를) 삭제했습니다.`)
      if (detail?.id === seaArea.id) {
        setDetail(null)
        setDetailEditMode(false)
      }
      await loadSeaAreas()
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : '해역 삭제에 실패했습니다.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  function applyUpdate(seaArea: SeaAreaDetail) {
    setSeaAreas((prev) =>
      prev.map((s) => (s.id === seaArea.id ? seaArea : s)),
    )
    setDetail((prev) => (prev?.id === seaArea.id ? seaArea : prev))
  }

  const filtered = seaAreas.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const hay = [item.name, item.category, item.region, item.wave, item.current]
      .filter((v) => v != null && v !== '')
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  const rows = sortRows(
    filtered,
    (item, key) => item[key],
    (a, b) => b.id - a.id,
    compareIdDesc,
  )
  const colCount = isAdmin ? 6 : 5

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>해역</h1>
          <p>
            {isAdmin
              ? '위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.'
              : '등록된 해역의 경계·수집·목적지·해상 NPC를 확인합니다.'}
          </p>
        </div>
        {canAdd && (
          <div className="admin-page-actions">
            <button
              type="button"
              className="btn-admin"
              onClick={() => void loadSeaAreas()}
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
              {showImport ? '닫기' : '해역 추가'}
            </button>
          </div>
        )}
      </div>

      {canAdd && showImport && (
        <form className="admin-import-form" onSubmit={handleImport}>
          <label className="field">
            <span>해역 텍스트</span>
            <textarea
              className="quest-import-textarea"
              rows={16}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={SEA_AREA_IMPORT_PLACEHOLDER}
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
          placeholder="이름·분류·지역으로 검색"
          aria-label="해역 검색"
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
                  label="지역"
                  sortKey="region"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="파도"
                  sortKey="wave"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="조류"
                  sortKey="current"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                {isAdmin ? (
                  <th className="col-desk col-action">삭제</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => (
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
                  <td className="col-desk">{item.region || '-'}</td>
                  <td className="col-desk">{item.wave ?? '-'}</td>
                  <td className="col-desk">{item.current ?? '-'}</td>
                  {isAdmin ? (
                    <td
                      className="admin-cell-control col-desk col-action"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="admin-danger-btn"
                        disabled={deletingId === item.id}
                        onClick={() => void handleDelete(item)}
                      >
                        {deletingId === item.id ? '삭제 중…' : '삭제'}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="form-note">
                    {seaAreas.length === 0
                      ? '등록된 해역이 없습니다.'
                      : '검색 결과가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {openMiss ? (
        <ConfirmLayer
          message={`「${openMiss}」 해역이(가) 없습니다.`}
          onCancel={() => setOpenMiss('')}
          confirmLabel={canAdd ? '등록하러 이동하기' : undefined}
          onConfirm={
            canAdd
              ? () => {
                  setOpenMiss('')
                  setQuery(openMiss)
                  setShowImport(true)
                }
              : undefined
          }
        />
      ) : null}

      {detail && (
        <DetailModal
          title="해역 상세"
          label={`${detail.name} 상세`}
          onClose={() => {
            setDetail(null)
            setDetailEditMode(false)
          }}
          headerActions={
            isAdmin ? (
              <button
                type="button"
                className={`btn-admin${detailEditMode ? ' btn-admin-primary' : ''}`}
                onClick={() => setDetailEditMode((v) => !v)}
              >
                {detailEditMode ? '수정 종료' : '수정'}
              </button>
            ) : undefined
          }
        >
          <SeaAreaDetailView
            seaArea={detail}
            edit={
              isAdmin && detailEditMode
                ? {
                    token,
                    onSaved: applyUpdate,
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
