import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchQuests } from '../lib/api'
import type { QuestDetail } from '../types'
import { DetailModal } from './DetailModal'
import { QuestDetailView } from './QuestDetailView'

type QuestCatalogProps = {
  token: string
}

export function QuestCatalog({ token }: QuestCatalogProps) {
  const [quests, setQuests] = useState<QuestDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<QuestDetail | null>(null)

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

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>퀘스트</h1>
          <p>등록된 퀘스트를 확인하고 상세를 엽니다.</p>
        </div>
      </div>

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
                <th>이름</th>
                <th>분류</th>
                <th>난이도</th>
                <th>의뢰 장소</th>
                <th>목적지</th>
                <th>발견물</th>
              </tr>
            </thead>
            <tbody>
              {quests.map((quest, index) => (
                <tr
                  key={quest.id}
                  className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
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
                  <td>
                    {quest.category
                      ? `[${quest.category}] ${quest.questType || ''}`.trim()
                      : '-'}
                  </td>
                  <td>{quest.difficulty ?? '-'}</td>
                  <td>{quest.requestPlaces || '-'}</td>
                  <td>{quest.destination || '-'}</td>
                  <td>
                    {[
                      quest.discoveryCategory
                        ? `[${quest.discoveryCategory}]`
                        : null,
                      quest.discoveryRank,
                      quest.discoveryName,
                    ]
                      .filter((v) => v != null && v !== '')
                      .join(' ') || '-'}
                  </td>
                </tr>
              ))}
              {quests.length === 0 && (
                <tr>
                  <td colSpan={6}>등록된 퀘스트가 없습니다.</td>
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
          <QuestDetailView quest={detail} />
        </DetailModal>
      )}
    </section>
  )
}
