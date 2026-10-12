import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { fetchQuests, setQuestCompletion } from '../lib/api'
import { matchesQuestQuery } from '../lib/questSearch'
import { useTableSort } from '../lib/tableSort'
import type { QuestDetail } from '../types'
import { DetailModal } from './DetailModal'
import { QuestDiscoveryLabel } from './DiscoveryRankMark'
import { QuestDetailView } from './QuestDetailView'
import { SortableTh } from './SortableTh'

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

function discoveryLabel(quest: QuestDetail) {
  return (
    [
      quest.discoveryCategory ? `[${quest.discoveryCategory}]` : null,
      quest.discoveryRank,
      quest.discoveryName,
    ]
      .filter((v) => v != null && v !== '')
      .join(' ') || ''
  )
}

function categoryLabel(quest: QuestDetail) {
  return quest.category
    ? `[${quest.category}] ${quest.questType || ''}`.trim()
    : ''
}

export function QuestCatalog({ token, isAdmin = false }: QuestCatalogProps) {
  const [quests, setQuests] = useState<QuestDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<QuestDetail | null>(null)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const hasQuestsRef = useRef(false)
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<QuestSortKey>()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setError('')
        // 이미 목록이 있으면 로딩 UI로 표를 숨기지 않음 (StrictMode 이중 fetch 깜빡임 방지)
        if (!hasQuestsRef.current) setLoading(true)
        const res = await fetchQuests(token)
        if (!alive) return
        setQuests(res.quests)
        hasQuestsRef.current = res.quests.length > 0
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error ? err.message : '퀘스트 목록을 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const filtered = quests.filter((quest) => matchesQuestQuery(quest, query))
  const rows = sortRows(
    filtered,
    (quest, key) => {
      switch (key) {
        case 'name':
          return quest.name
        case 'category':
          return categoryLabel(quest)
        case 'difficulty':
          return quest.difficulty
        case 'requestPlaces':
          return quest.requestPlaces
        case 'destination':
          return quest.destination
        case 'discovery':
          return discoveryLabel(quest)
      }
    },
    (a, b) => a.id - b.id,
  )

  const completedCount = quests.filter((q) => q.completed).length

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

  return (
    <section className="tool-page quest-catalog">
      <div className="messages-head">
        <div>
          <h1>퀘스트</h1>
          <p>
            등록된 퀘스트를 확인하고 상세에서 완료를 표시합니다.
            {!loading && quests.length > 0
              ? ` (완료 ${completedCount}/${quests.length})`
              : ''}
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
          disabled={loading}
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
                  label="난이도"
                  sortKey="difficulty"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="의뢰 장소"
                  sortKey="requestPlaces"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="목적지"
                  sortKey="destination"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="발견물"
                  sortKey="discovery"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((quest, index) => (
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
                  <td className="col-desk">{quest.difficulty ?? '-'}</td>
                  <td className="col-desk">{quest.requestPlaces || '-'}</td>
                  <td className="col-desk">{quest.destination || '-'}</td>
                  <td className="col-desk">
                    <QuestDiscoveryLabel quest={quest} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    {quests.length === 0
                      ? '등록된 퀘스트가 없습니다.'
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
          title="퀘스트 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <QuestDetailView
            quest={detail}
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
