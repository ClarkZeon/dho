import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  deleteQuest,
  fetchQuests,
  importQuestText,
  setQuestCompletion,
  updateQuest,
} from '../lib/api'
import { useTableSort } from '../lib/tableSort'
import type { QuestDetail } from '../types'
import { DetailModal } from './DetailModal'
import { QuestDiscoveryLabel } from './DiscoveryRankMark'
import { QuestDetailView } from './QuestDetailView'
import { SortableTh } from './SortableTh'

const PAGE_SIZE = 15

type QuestCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
}

type QuestSortKey =
  | 'name'
  | 'category'
  | 'difficulty'
  | 'requestPlaces'
  | 'destination'
  | 'discovery'

function categoryLabel(quest: QuestDetail) {
  return quest.category
    ? `[${quest.category}] ${quest.questType || ''}`.trim()
    : ''
}

export function QuestCatalog({
  token,
  isAdmin = false,
  onToast,
}: QuestCatalogProps) {
  const [quests, setQuests] = useState<QuestDetail[]>([])
  const [total, setTotal] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<QuestDetail | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(0)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [busyDiffId, setBusyDiffId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const { sortKey, sortDir, toggleSort } = useTableSort<QuestSortKey>()

  useEffect(() => {
    const next = query.trim()
    const timer = window.setTimeout(() => {
      setDebouncedQuery((prev) => {
        if (prev !== next) setPage(0)
        return next
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const loadQuests = useCallback(
    async (opts?: { quiet?: boolean }) => {
      try {
        setError('')
        if (!opts?.quiet) setLoading(true)
        const res = await fetchQuests(token, {
          q: debouncedQuery,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          sort: sortKey,
          dir: sortKey ? sortDir : undefined,
        })
        setQuests(res.quests)
        setTotal(res.total)
        setCompletedCount(res.completedCount)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : '퀘스트 목록을 불러오지 못했습니다.',
        )
      } finally {
        setLoading(false)
      }
    },
    [token, debouncedQuery, page, sortKey, sortDir],
  )

  useEffect(() => {
    void loadQuests()
  }, [loadQuests])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)

  useEffect(() => {
    if (page > safePage) setPage(safePage)
  }, [page, safePage])

  function applyQuestUpdate(quest: QuestDetail) {
    setQuests((prev) => prev.map((q) => (q.id === quest.id ? quest : q)))
    setDetail((prev) => (prev?.id === quest.id ? quest : prev))
  }

  async function toggleCompleted(quest: QuestDetail, next: boolean) {
    if (busyId === quest.id) return
    setBusyId(quest.id)
    setError('')
    try {
      const res = await setQuestCompletion(token, quest.id, next)
      setQuests((prev) =>
        prev.map((item) =>
          item.id === quest.id
            ? {
                ...item,
                completed: res.completed,
                completedAt: res.completedAt,
              }
            : item,
        ),
      )
      setDetail((prev) =>
        prev && prev.id === quest.id
          ? {
              ...prev,
              completed: res.completed,
              completedAt: res.completedAt,
            }
          : prev,
      )
      setCompletedCount((n) => {
        if (res.completed && !quest.completed) return n + 1
        if (!res.completed && quest.completed) return Math.max(0, n - 1)
        return n
      })
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
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importQuestText(token, importText)
      setImportText('')
      setShowImport(false)
      setImportNote(
        `「${res.quest.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast?.(`퀘스트 「${res.quest.name}」 저장 완료`)
      await loadQuests()
    } catch (err) {
      setImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(quest: QuestDetail) {
    if (!window.confirm(`「${quest.name}」 퀘스트를 삭제할까요?`)) return
    setDeletingId(quest.id)
    try {
      await deleteQuest(token, quest.id)
      if (detail?.id === quest.id) setDetail(null)
      onToast?.(`퀘스트 「${quest.name}」을(를) 삭제했습니다.`)
      await loadQuests({ quiet: true })
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDifficultyChange(quest: QuestDetail, value: string) {
    const difficulty = value === '' ? null : Number(value)
    if (
      difficulty !== null &&
      (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 10)
    ) {
      return
    }
    if (difficulty === quest.difficulty) return
    setBusyDiffId(quest.id)
    try {
      const res = await updateQuest(token, quest.id, { difficulty })
      applyQuestUpdate(res.quest)
      onToast?.(`「${res.quest.name}」 난이도 저장`)
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : '난이도 저장에 실패했습니다.',
      )
    } finally {
      setBusyDiffId(null)
    }
  }

  function handleSort(key: QuestSortKey) {
    toggleSort(key)
    setPage(0)
  }

  const countLabel = !loading
    ? debouncedQuery
      ? `검색 ${total}개`
      : total > 0
        ? `완료 ${completedCount}/${total}`
        : ''
    : ''

  const colCount = isAdmin ? 7 : 6

  return (
    <section className="tool-page quest-catalog">
      <div className="messages-head">
        <div>
          <h1>퀘스트</h1>
          <p>
            {isAdmin
              ? '위키 텍스트로 추가·갱신합니다. 같은 이름이면 공략·진행 포함 전체를 덮어씁니다.'
              : '등록된 퀘스트를 확인하고 상세에서 완료를 표시합니다.'}
            {countLabel ? ` (${countLabel})` : ''}
          </p>
        </div>
        {isAdmin && (
          <div className="admin-page-actions">
            <button
              type="button"
              className="btn-admin"
              onClick={() => void loadQuests()}
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
              {showImport ? '닫기' : '퀘스트 추가'}
            </button>
          </div>
        )}
      </div>

      {isAdmin && showImport && (
        <form className="admin-import-form" onSubmit={handleImport}>
          <label className="field">
            <span>퀘스트 텍스트 (분류~진행 전체)</span>
            <textarea
              className="quest-import-textarea"
              rows={22}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`퀘스트이름\n소개 문단\n\n분류\t[모험] 일반\t난이도\t\n…\n공략\t1. …\n진행\t1. …\n결론 - …`}
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
          placeholder="이름·장소·발견물로 검색"
          aria-label="퀘스트 검색"
          autoComplete="off"
        />
      </label>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      {loading && quests.length === 0 ? (
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
                    onSort={handleSort}
                  />
                  <SortableTh
                    className="col-desk"
                    label="분류"
                    sortKey="category"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    className="col-desk col-diff"
                    label="난이도"
                    sortKey="difficulty"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    className="col-desk"
                    label="의뢰 장소"
                    sortKey="requestPlaces"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    className="col-desk"
                    label="목적지"
                    sortKey="destination"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    className="col-desk"
                    label="발견물"
                    sortKey="discovery"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  {isAdmin && <th className="col-desk col-action">삭제</th>}
                </tr>
              </thead>
              <tbody>
                {quests.map((quest, index) => (
                  <tr
                    key={quest.id}
                    className={`admin-row-clickable${quest.completed ? ' is-quest-done' : ''}${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                    tabIndex={0}
                    onClick={() => setDetail(quest)}
                    onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setDetail(quest)
                      }
                    }}
                  >
                    <td>{quest.name}</td>
                    <td className="col-desk">{categoryLabel(quest) || '-'}</td>
                    <td
                      className={`col-desk col-diff${isAdmin ? ' admin-cell-control' : ''}`}
                      onClick={isAdmin ? (e) => e.stopPropagation() : undefined}
                      onKeyDown={
                        isAdmin ? (e) => e.stopPropagation() : undefined
                      }
                    >
                      {isAdmin ? (
                        <select
                          className="quest-diff-select admin-control"
                          value={quest.difficulty ?? ''}
                          disabled={busyDiffId === quest.id}
                          aria-label={`${quest.name} 난이도`}
                          onChange={(e) =>
                            void handleDifficultyChange(quest, e.target.value)
                          }
                        >
                          <option value="">-</option>
                          {Array.from({ length: 11 }, (_, n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      ) : (
                        (quest.difficulty ?? '-')
                      )}
                    </td>
                    <td className="col-desk">{quest.requestPlaces || '-'}</td>
                    <td className="col-desk">{quest.destination || '-'}</td>
                    <td className="col-desk">
                      <QuestDiscoveryLabel quest={quest} />
                    </td>
                    {isAdmin && (
                      <td
                        className="admin-cell-control col-desk col-action"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="admin-danger-btn"
                          disabled={deletingId === quest.id}
                          onClick={() => void handleDelete(quest)}
                        >
                          삭제
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {quests.length === 0 && (
                  <tr>
                    <td colSpan={colCount}>
                      {debouncedQuery
                        ? '검색 결과가 없습니다.'
                        : '등록된 퀘스트가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="catalog-pager" aria-label="퀘스트 목록 페이지">
              <button
                type="button"
                className="admin-btn"
                disabled={safePage <= 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                이전
              </button>
              <span>
                {safePage + 1} / {totalPages}
                <em>· {total}개</em>
              </span>
              <button
                type="button"
                className="admin-btn"
                disabled={safePage >= totalPages - 1 || loading}
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
              >
                다음
              </button>
            </div>
          )}
        </>
      )}

      {detail && (
        <DetailModal
          title="퀘스트 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <QuestDetailView
            quest={detail}
            token={token}
            completionBusy={busyId === detail.id}
            onToggleCompleted={(completed) =>
              void toggleCompleted(detail, completed)
            }
            walkthroughEdit={
              isAdmin
                ? {
                    token,
                    onSaved: applyQuestUpdate,
                  }
                : undefined
            }
          />
        </DetailModal>
      )}
    </section>
  )
}
