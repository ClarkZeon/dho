import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchQuests, setQuestCompletion } from '../lib/api'
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

export function QuestCatalog({ token, isAdmin = false }: QuestCatalogProps) {
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

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setError('')
        setLoading(true)
        const res = await fetchQuests(token, {
          q: debouncedQuery,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          sort: sortKey,
          dir: sortKey ? sortDir : undefined,
        })
        if (!alive) return
        setQuests(res.quests)
        setTotal(res.total)
        setCompletedCount(res.completedCount)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '퀘스트 목록을 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token, debouncedQuery, page, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)

  useEffect(() => {
    if (page > safePage) setPage(safePage)
  }, [page, safePage])

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

  return (
    <section className="tool-page quest-catalog">
      <div className="messages-head">
        <div>
          <h1>퀘스트</h1>
          <p>
            등록된 퀘스트를 확인하고 상세에서 완료를 표시합니다.
            {countLabel ? ` (${countLabel})` : ''}
          </p>
        </div>
      </div>

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
                    <td className="col-desk col-diff">
                      {quest.difficulty ?? '-'}
                    </td>
                    <td className="col-desk">{quest.requestPlaces || '-'}</td>
                    <td className="col-desk">{quest.destination || '-'}</td>
                    <td className="col-desk">
                      <QuestDiscoveryLabel quest={quest} />
                    </td>
                  </tr>
                ))}
                {quests.length === 0 && (
                  <tr>
                    <td colSpan={6}>
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
                    onSaved: (quest) => {
                      setQuests((prev) =>
                        prev.map((q) => (q.id === quest.id ? quest : q)),
                      )
                      setDetail(quest)
                    },
                  }
                : undefined
            }
          />
        </DetailModal>
      )}
    </section>
  )
}
