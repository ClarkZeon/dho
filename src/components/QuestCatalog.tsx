import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchQuests, setQuestCompletion } from '../lib/api'
import { matchesQuestQuery } from '../lib/questSearch'
import { useTableSort } from '../lib/tableSort'
import type { QuestDetail } from '../types'
import { DetailModal } from './DetailModal'
import { QuestDetailView } from './QuestDetailView'
import { SortableTh } from './SortableTh'

type QuestCatalogProps = {
  token: string
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

export function QuestCatalog({ token }: QuestCatalogProps) {
  const [quests, setQuests] = useState<QuestDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<QuestDetail | null>(null)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<QuestSortKey>()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchQuests(token)
        if (!alive) return
        setQuests(res.quests)
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
    <section className="tool-page">
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
          placeholder="이름·분류·장소·발견물로 검색"
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
                  <td className="col-desk">{discoveryLabel(quest) || '-'}</td>
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
          />
        </DetailModal>
      )}
    </section>
  )
}
