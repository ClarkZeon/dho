import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { deleteJob, fetchJobs, importJobText } from '../lib/api'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { JobDetail } from '../types'
import { ConfirmLayer } from './ConfirmLayer'
import { DetailModal } from './DetailModal'
import { DucatAmount } from './DucatAmount'
import { JobDetailView } from './JobDetailView'
import { SortableTh } from './SortableTh'

const PAGE_SIZE = 15

type JobCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
  initialQuery?: string
  openKey?: string
  initialAdd?: boolean
}

type SortKey = 'name' | 'category' | 'cost'

export function JobCatalog({
  token,
  isAdmin = false,
  onToast,
  initialQuery = '',
  openKey = '',
  initialAdd = false,
}: JobCatalogProps) {
  const [jobs, setJobs] = useState<JobDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<JobDetail | null>(null)
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

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchJobs(token)
      setJobs(res.jobs)
      setPage(0)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '직업 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

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
    const found = jobs.find(
      (j) =>
        j.slug === key ||
        j.name.trim().toLowerCase() === lower ||
        j.name.trim() === key,
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
    setDetail(found)
  }, [openKey, loading, jobs, initialQuery])

  useEffect(() => {
    setPage(0)
  }, [query, sortKey, sortDir])

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!canAdd) {
      setImportNote('관리자만 직업을 등록할 수 있습니다.')
      return
    }
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importJobText(token, importText)
      setImportText('')
      setShowImport(false)
      setImportNote(
        `「${res.job.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast?.(`직업 「${res.job.name}」 저장 완료`)
      await loadJobs()
    } catch (err) {
      setImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(job: JobDetail) {
    if (!window.confirm(`「${job.name}」 직업을 삭제할까요?`)) return
    setDeletingId(job.id)
    try {
      await deleteJob(token, job.id)
      setJobs((prev) => prev.filter((j) => j.id !== job.id))
      if (detail?.id === job.id) setDetail(null)
      onToast?.(`직업 「${job.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = jobs.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const hay = [
      item.name,
      item.altName,
      item.description,
      item.category,
      item.recommendation,
      item.cost,
      item.preferredSkills.join(' '),
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
    <section className="tool-page job-catalog">
      <div className="messages-head">
        <div>
          <h1>직업</h1>
          <p>
            {isAdmin
              ? '위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.'
              : '등록된 직업을 확인하고 상세를 엽니다.'}
          </p>
        </div>
        {canAdd && (
          <div className="admin-page-actions">
            <button
              type="button"
              className="btn-admin"
              onClick={() => void loadJobs()}
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
              {showImport ? '닫기' : '직업 추가'}
            </button>
          </div>
        )}
      </div>

      {canAdd && showImport && (
        <form className="admin-import-form" onSubmit={handleImport}>
          <label className="field">
            <span>직업 텍스트</span>
            <textarea
              className="quest-import-textarea"
              rows={10}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`직업궁정 정원사\n세계의 식물을 수집하는 탐험가.\n동식물에 대해 박식하며 탐험 능력도 뛰어나다.\n별칭 플랜트 헌터.\n\n분류\t모험\t추천장\t궁정 정원사 추천장\n비용\t90,000두캇\n우대 스킬\t생물학, 생태 조사*, 조달, …\n필요\n종류\t내용\n레벨\t모험 Lv30, 합계 Lv60\n연구\n연구\t전공\t획득 스킬\n궁정 정원사의 연구 1\t…\t…`}
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
          placeholder="이름·별칭·분류·스킬로 검색"
          aria-label="직업 검색"
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
                    className="col-desk col-job-cat"
                    label="분류"
                    sortKey="category"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align="center"
                  />
                  <SortableTh
                    className="col-desk"
                    label="비용"
                    sortKey="cost"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  {isAdmin && (
                    <th className="col-desk col-action col-job-delete">삭제</th>
                  )}
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
                    <td>
                      {item.name}
                      {item.altName ? (
                        <span className="port-alt-name"> ({item.altName})</span>
                      ) : null}
                    </td>
                    <td className="col-desk col-job-cat">
                      {item.category || '-'}
                    </td>
                    <td className="col-desk">
                      {item.cost ? <DucatAmount value={item.cost} /> : '-'}
                    </td>
                    {isAdmin && (
                      <td
                        className="col-desk col-action col-job-delete admin-cell-control"
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
                      {jobs.length === 0
                        ? '등록된 직업이 없습니다.'
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
          title="직업 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <JobDetailView
            job={detail}
            token={token}
            isAdmin={isAdmin}
          />
        </DetailModal>
      )}

      {openMiss ? (
        <ConfirmLayer
          title="확인"
          message={`「${openMiss}」 직업이 없습니다.`}
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
