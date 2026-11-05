import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  deleteQuest,
  fetchFields,
  fetchPorts,
  fetchQuestByKey,
  fetchQuests,
  importQuestText,
  setQuestCompletion,
  updateQuest,
} from '../lib/api'
import {
  extractDestinationFromQuestText,
  formatQuestDestination,
  isAmbiguousQuestDestination,
} from '../lib/questDestination'
import { useTableSort } from '../lib/tableSort'
import type { QuestDetail } from '../types'
import { ConfirmLayer } from './ConfirmLayer'
import { DetailModal } from './DetailModal'
import { QuestDestinationConfirmLayer } from './QuestDestinationConfirmLayer'
import { QuestDiscoveryLabel } from './DiscoveryRankMark'
import { QuestDetailView } from './QuestDetailView'
import { SortableTh } from './SortableTh'

const PAGE_SIZE = 15

type QuestCompletionFilter = 'all' | 'done' | 'open'

type QuestCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
  /** 해시 `#/quests?q=` 검색어 */
  initialQuery?: string
  /** 해시 `#/quests?open=` 상세 자동 오픈 (slug 또는 이름) */
  openKey?: string
  /** 해시 `#/quests?add=1` — 관리자 퀘스트 추가 폼 오픈 */
  initialAdd?: boolean
}

type QuestSortKey =
  | 'name'
  | 'category'
  | 'difficulty'
  | 'requestPlaces'
  | 'destination'
  | 'discovery'

function QuestCategoryCell({ quest }: { quest: QuestDetail }) {
  const category = quest.category?.trim()
  const questType = quest.questType?.trim()
  if (!category && !questType) return '-'

  return (
    <span className="quest-cat-label">
      {category ? <em className="quest-cat-bracket">[{category}]</em> : null}
      {questType ? <span className="quest-cat-type">{questType}</span> : null}
    </span>
  )
}

export function QuestCatalog({
  token,
  isAdmin = false,
  onToast,
  initialQuery = '',
  openKey = '',
  initialAdd = false,
}: QuestCatalogProps) {
  const [quests, setQuests] = useState<QuestDetail[]>([])
  const [total, setTotal] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<QuestDetail | null>(null)
  const [detailEditMode, setDetailEditMode] = useState(false)
  const [query, setQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(
    () => initialQuery.trim(),
  )
  const [completionFilter, setCompletionFilter] =
    useState<QuestCompletionFilter>('all')
  const [page, setPage] = useState(0)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [busyDiffId, setBusyDiffId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const canAdd = isAdmin
  const [showImport, setShowImport] = useState(
    () => Boolean(canAdd && initialAdd),
  )
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const [openMiss, setOpenMiss] = useState('')
  const openedKeyRef = useRef('')
  const { sortKey, sortDir, toggleSort } = useTableSort<QuestSortKey>()
  /** 목적지 다단 표기용 — 도시·육지 카탈로그 이름 */
  const [destCityNames, setDestCityNames] = useState<string[]>([])
  const [destLandNames, setDestLandNames] = useState<string[]>([])
  /** 구분자 없는 목적지 — 저장 전 단계 확인 */
  const [destConfirm, setDestConfirm] = useState<{
    raw: string
    text: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([fetchPorts(token), fetchFields(token)])
      .then(([portsRes, fieldsRes]) => {
        if (cancelled) return
        setDestCityNames(
          (portsRes.ports || []).flatMap((p) =>
            [p.name, p.altName].filter(Boolean),
          ) as string[],
        )
        setDestLandNames(
          (fieldsRes.fields || []).flatMap((f) =>
            [f.name, f.altName].filter(Boolean),
          ) as string[],
        )
      })
      .catch(() => {
        if (cancelled) return
        setDestCityNames([])
        setDestLandNames([])
      })
    return () => {
      cancelled = true
    }
  }, [token])

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
    if (!key) return
    if (openedKeyRef.current === key) return
    openedKeyRef.current = key
    const label = initialQuery.trim() || key
    if (initialQuery.trim()) setQuery(initialQuery.trim())
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchQuestByKey(token, key)
        if (cancelled) return
        setOpenMiss('')
        setQuery(initialQuery.trim() || res.quest.name)
        setDetailEditMode(false)
        setDetail(res.quest)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : ''
        if (/찾을 수 없|없습니다/i.test(message)) {
          setOpenMiss(label)
        } else {
          setError(message || '퀘스트를 불러오지 못했습니다.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [openKey, token, initialQuery])

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
          completion: completionFilter,
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
    [token, debouncedQuery, completionFilter, page, sortKey, sortDir],
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
      const matchesFilter =
        completionFilter === 'all' ||
        (completionFilter === 'done' && res.completed) ||
        (completionFilter === 'open' && !res.completed)
      setQuests((prev) => {
        if (!matchesFilter) {
          return prev.filter((item) => item.id !== quest.id)
        }
        return prev.map((item) =>
          item.id === quest.id
            ? {
                ...item,
                completed: res.completed,
                completedAt: res.completedAt,
              }
            : item,
        )
      })
      if (!matchesFilter) {
        setTotal((n) => Math.max(0, n - 1))
      }
      if (res.completed || !matchesFilter) {
        setDetail(null)
        setDetailEditMode(false)
      } else {
        setDetail((prev) =>
          prev && prev.id === quest.id
            ? {
                ...prev,
                completed: res.completed,
                completedAt: res.completedAt,
              }
            : prev,
        )
      }
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

  async function saveImportedQuest(
    text: string,
    destinationOverride?: string,
  ) {
    setImporting(true)
    setImportNote('')
    try {
      const res = await importQuestText(
        token,
        text,
        destinationOverride ? { destination: destinationOverride } : undefined,
      )
      setImportText('')
      setShowImport(false)
      setDestConfirm(null)
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

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!canAdd) {
      setImportNote('관리자만 퀘스트를 등록할 수 있습니다.')
      return
    }
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    const rawDest = extractDestinationFromQuestText(importText)
    if (rawDest && isAmbiguousQuestDestination(rawDest)) {
      setDestConfirm({ raw: rawDest, text: importText })
      return
    }
    await saveImportedQuest(importText)
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
    ? debouncedQuery || completionFilter !== 'all'
      ? `${completionFilter === 'done' ? '완료' : completionFilter === 'open' ? '미완료' : '검색'} ${total}개 · 전체 완료 ${completedCount}`
      : total > 0
        ? `완료 ${completedCount}/${total}`
        : ''
    : ''

  const colCount = isAdmin ? 8 : 7

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
        {canAdd && (
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

      {canAdd && showImport && (
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

      <div
        className="detail-mode-toggle quest-completion-filter"
        role="group"
        aria-label="완료 여부 필터"
      >
        {(
          [
            ['all', '전체'],
            ['open', '미완료'],
            ['done', '완료'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={completionFilter === value ? 'active' : ''}
            aria-pressed={completionFilter === value}
            onClick={() => {
              setCompletionFilter(value)
              setPage(0)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      {openMiss ? (
        <ConfirmLayer
          title="확인"
          message={`「${openMiss}」 퀘스트가 없습니다.`}
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

      {destConfirm ? (
        <QuestDestinationConfirmLayer
          rawDestination={destConfirm.raw}
          cityNames={destCityNames}
          landNames={destLandNames}
          onCancel={() => setDestConfirm(null)}
          onConfirm={(normalized) => {
            const pending = destConfirm.text
            setDestConfirm(null)
            void saveImportedQuest(pending, normalized)
          }}
        />
      ) : null}

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
                    className="col-desk col-quest-cat"
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
                    className="col-desk col-quest-discovery"
                    label="발견물"
                    sortKey="discovery"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <th className="col-quest-done">완료</th>
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
                    <td className="col-desk col-quest-cat">
                      <QuestCategoryCell quest={quest} />
                    </td>
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
                    <td className="col-desk">
                      {formatQuestDestination(quest.destination, {
                        cityNames: destCityNames,
                        landNames: destLandNames,
                      }) || '-'}
                    </td>
                    <td className="col-desk col-quest-discovery">
                      <QuestDiscoveryLabel quest={quest} />
                    </td>
                    <td className="col-quest-done">
                      {quest.completed ? (
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
          <QuestDetailView
            quest={detail}
            token={token}
            isAdmin={isAdmin}
            editMode={detailEditMode}
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
