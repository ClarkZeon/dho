import { useEffect, useState } from 'react'
import { fetchQuestByKey, setQuestCompletion } from '../lib/api'
import type { DiscoveryDetail, QuestDetail } from '../types'
import { ConfirmLayer } from './ConfirmLayer'
import { DetailModal } from './DetailModal'
import { formatDiscoveryCategoryLabel } from '../lib/discoveryCategory'
import { getModuleDef } from '../lib/detailModules'
import { DiscoveryRankMark } from './DiscoveryRankMark'
import { LoadingOverlay } from './LoadingOverlay'
import { QuestDetailView } from './QuestDetailView'
import { QuestModule } from './modules/QuestModule'

type DiscoveryDetailViewProps = {
  discovery: DiscoveryDetail
  token?: string
  isAdmin?: boolean
  completionBusy?: boolean
  onToggleCompleted?: (completed: boolean) => void
}

function Row({
  label,
  value,
  hideEmpty,
}: {
  label: string
  value: string | null
  hideEmpty?: boolean
}) {
  if (hideEmpty && !value?.trim()) return null
  return (
    <div>
      <span>{label}</span>
      <strong>{value?.trim() ? value : '-'}</strong>
    </div>
  )
}

function formatNum(n: number | null) {
  if (n == null) return null
  return n.toLocaleString('ko-KR')
}

function DiscoveryCategoryValue({
  category,
  categoryGroup,
}: {
  category: string | null
  categoryGroup: string | null
}) {
  const leaf = category?.trim() || ''
  const group = categoryGroup?.trim() || ''
  if (!leaf && !group) return <strong>-</strong>
  if (group && leaf && group !== leaf) {
    return (
      <strong className="quest-cat-label">
        <em className="quest-cat-bracket">{group}</em>
        <span className="quest-cat-type">{leaf}</span>
      </strong>
    )
  }
  return (
    <strong>{formatDiscoveryCategoryLabel(leaf || group, null)}</strong>
  )
}

export function DiscoveryDetailView({
  discovery,
  token,
  isAdmin = false,
  completionBusy = false,
  onToggleCompleted,
}: DiscoveryDetailViewProps) {
  const authToken = token || ''
  // 발견물 상세는 필드 수정 UI가 없음 → 관리자여도 빈 카드 숨김 (detail-empty-cards)
  const canEdit = false
  const [jumpQuestDetail, setJumpQuestDetail] = useState<QuestDetail | null>(
    null,
  )
  const [jumpQuestLoading, setJumpQuestLoading] = useState(false)
  const [jumpQuestMissName, setJumpQuestMissName] = useState('')
  const [jumpQuestError, setJumpQuestError] = useState('')
  const [jumpQuestBusy, setJumpQuestBusy] = useState(false)

  const debate = discovery.debateCombo
  const hasDebate = Boolean(
    debate &&
      (debate.effect?.trim() ||
        debate.comboName?.trim() ||
        (debate.cards || []).length > 0),
  )
  const ornaments = discovery.ornaments || []
  const hasOrnaments = ornaments.length > 0

  useEffect(() => {
    setJumpQuestDetail(null)
    setJumpQuestMissName('')
    setJumpQuestError('')
  }, [discovery.id])

  async function openMatchedQuest(target: {
    name: string
    slug?: string
    id?: number
  }) {
    if (!authToken) return
    const key = (target.slug || target.name || '').trim()
    if (!key) return
    const missLabel = (target.name || key).trim()
    setJumpQuestLoading(true)
    setJumpQuestMissName('')
    setJumpQuestError('')
    try {
      const res = await fetchQuestByKey(authToken, key)
      setJumpQuestDetail(res.quest)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (/찾을 수 없|없습니다/i.test(message)) {
        setJumpQuestMissName(missLabel)
      } else {
        setJumpQuestError(message || '퀘스트 상세를 불러오지 못했습니다.')
      }
    } finally {
      setJumpQuestLoading(false)
    }
  }

  function openQuestsAddTab(questName: string) {
    const params = new URLSearchParams()
    params.set('q', questName)
    params.set('add', '1')
    const url = `${window.location.pathname}${window.location.search}#/quests?${params.toString()}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function toggleJumpQuestCompleted(next: boolean) {
    if (!authToken || !jumpQuestDetail || jumpQuestBusy) return
    setJumpQuestBusy(true)
    setJumpQuestError('')
    try {
      const res = await setQuestCompletion(
        authToken,
        jumpQuestDetail.id,
        next,
      )
      setJumpQuestDetail((prev) =>
        prev
          ? {
              ...prev,
              completed: res.completed,
              completedAt: res.completedAt,
            }
          : prev,
      )
    } catch (err) {
      setJumpQuestError(
        err instanceof Error
          ? err.message
          : '퀘스트 완료 상태 저장에 실패했습니다.',
      )
    } finally {
      setJumpQuestBusy(false)
    }
  }

  return (
    <div className="quest-detail">
      <header
        className={`quest-detail-hero${discovery.completed ? ' is-completed' : ''}`}
      >
        <div className="quest-detail-hero-top">
          <div className="quest-detail-hero-chips">
            <span className="quest-badge">
              {getModuleDef('discovery')?.title ?? '발견물'}
            </span>
            {discovery.completed ? (
              <span className="quest-badge quest-badge-done">완료</span>
            ) : null}
          </div>
        </div>
        <h2>{discovery.name}</h2>
        {discovery.description ? <p>{discovery.description}</p> : null}
      </header>

      <section className="quest-detail-section">
        <h3>기본 정보</h3>
        <div className="quest-kv-grid">
          {canEdit ||
          discovery.category?.trim() ||
          discovery.categoryGroup?.trim() ? (
            <div>
              <span>분류</span>
              <DiscoveryCategoryValue
                category={discovery.category}
                categoryGroup={discovery.categoryGroup}
              />
            </div>
          ) : null}
          {canEdit || discovery.rank != null ? (
            <div>
              <span>난이도</span>
              <strong>
                {discovery.rank != null ? (
                  <DiscoveryRankMark rank={discovery.rank} />
                ) : (
                  '-'
                )}
              </strong>
            </div>
          ) : null}
          <Row
            label="카드 포인트"
            value={formatNum(discovery.cardPoints)}
            hideEmpty={!canEdit}
          />
          <Row
            label="발견 경험치"
            value={formatNum(discovery.discoveryExp)}
            hideEmpty={!canEdit}
          />
          <Row
            label="카드 획득 경험치"
            value={formatNum(discovery.cardExp)}
            hideEmpty={!canEdit}
          />
          <Row
            label="보고시 명성"
            value={formatNum(discovery.reportFame)}
            hideEmpty={!canEdit}
          />
          {canEdit || discovery.place?.trim() ? (
            <div className="quest-kv-wide">
              <span>장소</span>
              <strong>
                {discovery.place?.trim() ? discovery.place : '-'}
              </strong>
            </div>
          ) : null}
        </div>
      </section>

      <QuestModule
        discovery={discovery}
        canEdit={canEdit}
        discoveryBusy={jumpQuestLoading}
        onOpenQuest={
          authToken
            ? (target) => void openMatchedQuest(target)
            : undefined
        }
      />

      {hasDebate && debate ? (
        <section className="quest-detail-section">
          <h3>논전 콤보</h3>
          <div className="quest-kv-grid">
            {debate.effect?.trim() ? (
              <div className="quest-kv-wide">
                <span>효과</span>
                <strong>{debate.effect}</strong>
              </div>
            ) : null}
            {debate.comboName?.trim() ? (
              <div className="quest-kv-wide">
                <span>논전 콤보</span>
                <strong>{debate.comboName}</strong>
              </div>
            ) : null}
            {debate.cards.length > 0 ? (
              <div className="quest-kv-wide">
                <span>발견물 카드</span>
                <ul className="quest-skill-chips">
                  {debate.cards.map((card) => (
                    <li key={card}>
                      <span>{card}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {hasOrnaments ? (
        <section className="quest-detail-section">
          <h3>장식품</h3>
          <div className="admin-table-wrap">
            <table className="admin-table discovery-ornament-table">
              <thead>
                <tr>
                  <th>장식품</th>
                  <th>발견물 카드</th>
                </tr>
              </thead>
              <tbody>
                {ornaments.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td>
                      {item.cards.length > 0 ? (
                        <ul className="quest-skill-chips">
                          {item.cards.map((card) => (
                            <li key={`${item.name}-${card}`}>
                              <span>{card}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {onToggleCompleted && (
        <div className="quest-complete-actions">
          {discovery.completed ? (
            <button
              type="button"
              className="admin-btn"
              disabled={completionBusy}
              onClick={() => onToggleCompleted(false)}
            >
              {completionBusy ? '저장 중…' : '완료 취소'}
            </button>
          ) : (
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              disabled={completionBusy}
              onClick={() => onToggleCompleted(true)}
            >
              {completionBusy ? '저장 중…' : '완료'}
            </button>
          )}
        </div>
      )}

      {jumpQuestLoading ? (
        <LoadingOverlay label="퀘스트 불러오는 중…" />
      ) : null}

      {jumpQuestMissName ? (
        <ConfirmLayer
          title="확인"
          message={`「${jumpQuestMissName}」 퀘스트가 없습니다.`}
          stack={1}
          onCancel={() => setJumpQuestMissName('')}
          confirmLabel={isAdmin ? '등록하러 이동하기' : undefined}
          onConfirm={
            isAdmin
              ? () => {
                  openQuestsAddTab(jumpQuestMissName)
                  setJumpQuestMissName('')
                }
              : undefined
          }
        />
      ) : null}

      {jumpQuestError ? (
        <ConfirmLayer
          title="확인"
          message={jumpQuestError}
          stack={1}
          onCancel={() => setJumpQuestError('')}
        />
      ) : null}

      {jumpQuestDetail ? (
        <DetailModal
          title="퀘스트 상세"
          label={`${jumpQuestDetail.name} 상세`}
          onClose={() => {
            setJumpQuestDetail(null)
            setJumpQuestError('')
          }}
          stack={1}
          headerActions={
            isAdmin ? (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  const params = new URLSearchParams()
                  params.set('q', jumpQuestDetail.name)
                  params.set(
                    'open',
                    jumpQuestDetail.slug || jumpQuestDetail.name,
                  )
                  const url = `${window.location.pathname}${window.location.search}#/quests?${params.toString()}`
                  window.open(url, '_blank', 'noopener,noreferrer')
                }}
              >
                퀘스트 메뉴로 이동
              </button>
            ) : undefined
          }
        >
          <QuestDetailView
            quest={jumpQuestDetail}
            token={authToken}
            isAdmin={isAdmin}
            completionBusy={jumpQuestBusy}
            onToggleCompleted={(completed) =>
              void toggleJumpQuestCompleted(completed)
            }
          />
        </DetailModal>
      ) : null}
    </div>
  )
}
