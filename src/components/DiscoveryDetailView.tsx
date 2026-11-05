import { useEffect, useState } from 'react'
import { updateDiscovery } from '../lib/api'
import type {
  DiscoveryDetail,
  DiscoveryQuestRef,
} from '../types'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'
import { getModuleDef } from '../lib/detailModules'
import { DiscoveryRankMark } from './DiscoveryRankMark'
import { QuestModule } from './modules/QuestModule'

type DiscoveryDetailViewProps = {
  discovery: DiscoveryDetail
  onOpenQuest?: (quest: DiscoveryQuestRef) => void
  completionBusy?: boolean
  onToggleCompleted?: (completed: boolean) => void
  /** 관리자: 기본 정보(난이도) 수정 */
  basicInfoEdit?: {
    token: string
    onSaved: (discovery: DiscoveryDetail) => void
    onToast?: (text: string) => void
  }
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

export function DiscoveryDetailView({
  discovery,
  onOpenQuest,
  completionBusy = false,
  onToggleCompleted,
  basicInfoEdit,
}: DiscoveryDetailViewProps) {
  const canEdit = Boolean(basicInfoEdit)
  const [editing, setEditing] = useState(false)
  const [rankDraft, setRankDraft] = useState(
    discovery.rank == null ? '' : String(discovery.rank),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const debate = discovery.debateCombo

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
            <Row
              label="분류"
              value={discovery.category}
              hideEmpty={!canEdit}
            />
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
        )}
      </section>

      <QuestModule
        discovery={discovery}
        canEdit={canEdit}
        onOpenQuest={onOpenQuest}
      />

      {(canEdit || debate) && (
        <section className="quest-detail-section">
          <h3>논전 콤보</h3>
          {debate ? (
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
          ) : (
            <p className="quest-muted">없음</p>
          )}
        </section>
      )}

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
    </div>
  )
}
