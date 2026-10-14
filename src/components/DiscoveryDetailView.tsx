import { useEffect, useState, type ReactNode } from 'react'
import { updateDiscovery } from '../lib/api'
import { formatDiscoveryAcquire } from '../lib/discoveryAcquire'
import type {
  DiscoveryDetail,
  DiscoveryQuestRef,
} from '../types'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'

type DiscoveryDetailViewProps = {
  discovery: DiscoveryDetail
  onOpenQuest?: (quest: DiscoveryQuestRef) => void
  /** 관리자: 기본 정보(난이도) 수정 */
  basicInfoEdit?: {
    token: string
    onSaved: (discovery: DiscoveryDetail) => void
    onToast?: (text: string) => void
  }
}

function Row({ label, value }: { label: string; value: string | null }) {
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

function stars(rank: number | null) {
  if (rank == null || rank <= 0) return null
  return '★'.repeat(Math.min(rank, 10))
}

function QuestRefButton({
  quest,
  children,
  onOpenQuest,
}: {
  quest: DiscoveryQuestRef
  children: ReactNode
  onOpenQuest?: (quest: DiscoveryQuestRef) => void
}) {
  if (!onOpenQuest) {
    return <span className="discovery-quest-link is-static">{children}</span>
  }
  return (
    <button
      type="button"
      className="discovery-quest-link"
      onClick={() => onOpenQuest(quest)}
    >
      {children}
    </button>
  )
}

export function DiscoveryDetailView({
  discovery,
  onOpenQuest,
  basicInfoEdit,
}: DiscoveryDetailViewProps) {
  const canEdit = Boolean(basicInfoEdit)
  const [editing, setEditing] = useState(false)
  const [rankDraft, setRankDraft] = useState(
    discovery.rank == null ? '' : String(discovery.rank),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const linked = discovery.linkedQuests || []
  const debate = discovery.debateCombo
  const acquireQuest = discovery.acquireQuest
  const acquireLabel = formatDiscoveryAcquire(discovery)

  useEffect(() => {
    setEditing(false)
    setRankDraft(discovery.rank == null ? '' : String(discovery.rank))
    setError('')
  }, [discovery.id, discovery.rank])

  async function saveBasicInfo() {
    if (!basicInfoEdit) return
    setBusy(true)
    setError('')
    try {
      const raw = rankDraft.trim()
      const rank = raw === '' ? null : Number(raw)
      if (rank != null && (!Number.isInteger(rank) || rank < 0 || rank > 10)) {
        throw new Error('난이도는 0~10 정수여야 합니다.')
      }
      const res = await updateDiscovery(basicInfoEdit.token, discovery.id, {
        rank,
      })
      basicInfoEdit.onSaved(res.discovery)
      basicInfoEdit.onToast?.(`저장 완료 · ${res.discovery.name}`)
      setEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '발견물 저장에 실패했습니다.'
      setError(message)
      basicInfoEdit.onToast?.(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">발견물</span>
          {discovery.category ? (
            <span className="quest-badge">[{discovery.category}]</span>
          ) : null}
          {discovery.rank != null ? (
            <span className="quest-badge">{discovery.rank}성</span>
          ) : null}
        </div>
        <h2>{discovery.name}</h2>
        {discovery.description ? <p>{discovery.description}</p> : null}
      </header>

      <section className="quest-detail-section">
        <DetailSectionHead
          title="기본 정보"
          canEdit={canEdit}
          editing={editing}
          onEdit={() => {
            setRankDraft(discovery.rank == null ? '' : String(discovery.rank))
            setError('')
            setEditing(true)
          }}
        />
        {editing ? (
          <div className="quest-kv-grid">
            <Row label="분류" value={discovery.category} />
            <label className="field">
              <span>난이도 (0~10)</span>
              <input
                inputMode="numeric"
                value={rankDraft}
                onChange={(e) => setRankDraft(e.target.value)}
                disabled={busy}
                aria-label="난이도"
              />
            </label>
            <Row label="카드 포인트" value={formatNum(discovery.cardPoints)} />
            <Row label="발견 경험치" value={formatNum(discovery.discoveryExp)} />
            <Row
              label="카드 획득 경험치"
              value={formatNum(discovery.cardExp)}
            />
            <Row label="보고시 명성" value={formatNum(discovery.reportFame)} />
            {error ? (
              <p className="form-note error quest-kv-wide" role="alert">
                {error}
              </p>
            ) : null}
            <div className="quest-kv-wide">
              <DetailSectionActions
                busy={busy}
                onCancel={() => {
                  setEditing(false)
                  setRankDraft(
                    discovery.rank == null ? '' : String(discovery.rank),
                  )
                  setError('')
                }}
                onSave={() => void saveBasicInfo()}
              />
            </div>
          </div>
        ) : (
          <div className="quest-kv-grid">
            <Row label="분류" value={discovery.category} />
            <Row label="난이도" value={stars(discovery.rank)} />
            <Row label="카드 포인트" value={formatNum(discovery.cardPoints)} />
            <Row label="발견 경험치" value={formatNum(discovery.discoveryExp)} />
            <Row
              label="카드 획득 경험치"
              value={formatNum(discovery.cardExp)}
            />
            <Row label="보고시 명성" value={formatNum(discovery.reportFame)} />
            <div className="quest-kv-wide">
              <span>발견 방법</span>
              <strong>
                {acquireQuest ? (
                  <QuestRefButton quest={acquireQuest} onOpenQuest={onOpenQuest}>
                    {acquireLabel}
                  </QuestRefButton>
                ) : acquireLabel?.trim() ? (
                  acquireLabel
                ) : (
                  '-'
                )}
              </strong>
            </div>
            {discovery.place?.trim() ? (
              <div className="quest-kv-wide">
                <span>장소</span>
                <strong>{discovery.place}</strong>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {linked.length > 0 && (
        <section className="quest-detail-section">
          <h3>연결 지도/퀘스트</h3>
          <ol className="quest-chain is-linked">
            {linked.map((item, index) => {
              const label = item.tag
                ? `[${item.tag}] ${item.quest?.name || item.title}`
                : item.quest?.name || item.raw
              return (
                <li key={`${item.raw}-${index}`}>
                  <div>
                    <strong>
                      {item.quest ? (
                        <QuestRefButton
                          quest={item.quest}
                          onOpenQuest={onOpenQuest}
                        >
                          {label}
                        </QuestRefButton>
                      ) : (
                        label
                      )}
                    </strong>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {debate && (
        <section className="quest-detail-section">
          <h3>논전 콤보</h3>
          <div className="quest-kv-grid">
            <div className="quest-kv-wide">
              <span>효과</span>
              <strong>{debate.effect?.trim() ? debate.effect : '-'}</strong>
            </div>
            <div className="quest-kv-wide">
              <span>논전 콤보</span>
              <strong>
                {debate.comboName?.trim() ? debate.comboName : '-'}
              </strong>
            </div>
            <div className="quest-kv-wide">
              <span>발견물 카드</span>
              <strong>
                {debate.cards.length > 0 ? debate.cards.join(' · ') : '-'}
              </strong>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
