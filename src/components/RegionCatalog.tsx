import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  deleteRegion,
  fetchRegions,
  importRegionText,
} from '../lib/api'
import { matchesRegionQuery } from '../lib/regionSearch'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { RegionDetail } from '../types'
import { DetailModal } from './DetailModal'
import { RegionDetailView } from './RegionDetailView'
import { SortableTh } from './SortableTh'

type RegionCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
}

type RegionSortKey = 'name'

const REGION_IMPORT_PLACEHOLDER = `지역유럽 서부
해역 	
해역 그룹	해역
북해	비스케이만
북대서양	래브라도 해, 리스본 앞바다, 마데이라 앞바다, 북대서양, 북동대서양, 아이슬란드 해저분지, 지브롤터 해협, 카나리아 앞바다
서 지중해	리그리아 해, 발레아레스제도 앞바다, 티레니아 해
그린란드	남그린란드섬 앞바다, 북그린란드섬 앞바다`

export function RegionCatalog({
  token,
  isAdmin = false,
  onToast,
}: RegionCatalogProps) {
  const canAdd = isAdmin
  const [regions, setRegions] = useState<RegionDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<RegionDetail | null>(null)
  const [detailEditMode, setDetailEditMode] = useState(false)
  const [query, setQuery] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<RegionSortKey>()

  const loadRegions = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await fetchRegions(token)
      setRegions(res.regions)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '지역 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadRegions()
  }, [loadRegions])

  useEffect(() => {
    if (!canAdd) setShowImport(false)
  }, [canAdd])

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!canAdd) {
      setImportNote('관리자만 지역을 등록할 수 있습니다.')
      return
    }
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importRegionText(token, importText)
      setImportText('')
      setShowImport(false)
      setImportNote(
        `「${res.region.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast?.(`지역 「${res.region.name}」 저장 완료`)
      await loadRegions()
    } catch (err) {
      setImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(region: RegionDetail) {
    if (!window.confirm(`「${region.name}」 지역을 삭제할까요?`)) return
    setDeletingId(region.id)
    try {
      await deleteRegion(token, region.id)
      setRegions((prev) => prev.filter((r) => r.id !== region.id))
      if (detail?.id === region.id) setDetail(null)
      onToast?.(`지역 「${region.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  function applyUpdate(region: RegionDetail) {
    setRegions((prev) =>
      prev.map((r) => (r.id === region.id ? region : r)),
    )
    setDetail((prev) => (prev?.id === region.id ? region : prev))
  }

  const rows = sortRows(
    regions.filter((region) => matchesRegionQuery(region, query)),
    (region, key) => region[key],
    (a, b) => a.id - b.id,
    compareIdDesc,
  )
  const colCount = isAdmin ? 2 : 1

  return (
    <section className="tool-page region-catalog">
      <div className="messages-head">
        <div>
          <h1>지역</h1>
          <p>
            {isAdmin
              ? '위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.'
              : '등록된 지역의 해역 그룹을 확인합니다.'}
          </p>
        </div>
        {canAdd && (
          <div className="admin-page-actions">
            <button
              type="button"
              className="btn-admin"
              onClick={() => void loadRegions()}
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
              {showImport ? '닫기' : '지역 추가'}
            </button>
          </div>
        )}
      </div>

      {canAdd && showImport && (
        <form className="admin-import-form" onSubmit={handleImport}>
          <label className="field">
            <span>지역 텍스트</span>
            <textarea
              className="quest-import-textarea"
              rows={16}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={REGION_IMPORT_PLACEHOLDER}
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
          placeholder="이름·해역으로 검색"
          aria-label="지역 검색"
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
                {isAdmin ? (
                  <th className="col-desk col-action">삭제</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((region, index) => (
                <tr
                  key={region.id}
                  className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                  tabIndex={0}
                  onClick={() => {
                    setDetailEditMode(false)
                    setDetail(region)
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setDetailEditMode(false)
                      setDetail(region)
                    }
                  }}
                >
                  <td>{region.name}</td>
                  {isAdmin ? (
                    <td
                      className="admin-cell-control col-desk col-action"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="admin-danger-btn"
                        disabled={deletingId === region.id}
                        onClick={() => void handleDelete(region)}
                      >
                        {deletingId === region.id ? '삭제 중…' : '삭제'}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={colCount}>
                    {regions.length === 0
                      ? '등록된 지역이 없습니다.'
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
          title="지역 상세"
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
          <RegionDetailView
            region={detail}
            token={token}
            isAdmin={isAdmin}
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
