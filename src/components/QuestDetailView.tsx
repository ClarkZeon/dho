import { useEffect, useState } from 'react'
import { updateQuest } from '../lib/api'
import { splitChainAndLinked } from '../lib/questChain'
import type { QuestChainItem, QuestDetail } from '../types'

function formatNum(n: number | null | undefined) {
  if (n == null) return '-'
  return n.toLocaleString('ko-KR')
}

function placePrefixFromStep(line: string) {
  const m = line.trim().match(/^\d+\.\s*(.+)$/)
  if (!m) return ''
  return m[1].split(/[,，]/)[0].replace(/\s+/g, ' ').trim()
}

function isWalkthroughMapCaption(
  line: string,
  destination: string,
  placePrefixes: string[],
) {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (/^\d+\./.test(t) || /^[-–—]/.test(t) || /^[（(]/.test(t)) return false
  if (/지도\s*출처/.test(t)) return true
  if (destination && t === destination) return true
  return placePrefixes.some((p) => p && t === p)
}

function dropMapSource(text: string, destination?: string | null) {
  const dest = (destination || '').replace(/\s+/g, ' ').trim()
  const lines = text.split('\n')
  const placePrefixes = lines.map(placePrefixFromStep).filter(Boolean)
  const kept = lines
    .map((line) => line.replace(/지도\s*출처\s*[:：]?\s*.*$/, '').trimEnd())
    .filter((line, idx, arr) => {
      const t = line.trim()
      if (!t || /지도\s*출처/.test(t)) return false
      const next = arr.slice(idx + 1).find((l) => l.trim())
      if (next && /지도\s*출처/.test(next) && !/^\d+\./.test(t)) return false
      if (isWalkthroughMapCaption(t, dest, placePrefixes)) return false
      return true
    })
  while (kept.length) {
    const last = kept[kept.length - 1].trim()
    if (!last || isWalkthroughMapCaption(last, dest, placePrefixes)) {
      kept.pop()
      continue
    }
    break
  }
  return kept.join('\n').trim()
}

function DifficultyStars({ value }: { value: number | null }) {
  if (value == null) return <span className="quest-muted">-</span>
  const filled = Math.max(0, Math.min(10, value))
  return (
    <span className="quest-stars" aria-label={`난이도 ${filled}`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={i < filled ? 'is-on' : 'is-off'}>
          ★
        </span>
      ))}
      <em>{filled}</em>
    </span>
  )
}

type QuestDetailViewProps = {
  quest: QuestDetail
  completionBusy?: boolean
  onToggleCompleted?: (completed: boolean) => void
  /** 어드민만: 공략 인라인 편집 */
  walkthroughEdit?: {
    token: string
    onSaved: (quest: QuestDetail) => void
  }
}

function PencilIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function QuestRelatedList({
  items,
  currentName,
  numbered,
}: {
  items: QuestChainItem[]
  currentName: string
  numbered: boolean
}) {
  const Tag = numbered ? 'ol' : 'ul'
  return (
    <Tag className={`quest-chain${numbered ? '' : ' is-linked'}`}>
      {items.map((item, idx) => {
        const isCurrent =
          item.name &&
          item.name.replace(/\s+/g, ' ') === currentName.replace(/\s+/g, ' ')
        return (
          <li
            key={`${item.name || item.raw || idx}-${idx}`}
            className={isCurrent ? 'is-current' : undefined}
          >
            {numbered ? (
              <span className="quest-chain-idx">{idx + 1}</span>
            ) : null}
            <div>
              <strong>
                {item.name || item.raw || '퀘스트'}
                {isCurrent ? ' (현재)' : ''}
              </strong>
              <p>
                {[
                  item.category,
                  item.difficulty != null ? `난이도 ${item.difficulty}` : null,
                  item.places,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {item.skills && item.skills.length > 0 && (
                <p className="quest-chain-skills">
                  {item.skills
                    .map((s) =>
                      s.level != null ? `${s.name} ${s.level}` : s.name,
                    )
                    .join(', ')}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </Tag>
  )
}

export function QuestDetailView({
  quest,
  completionBusy = false,
  onToggleCompleted,
  walkthroughEdit,
}: QuestDetailViewProps) {
  const canEditWalkthrough = Boolean(walkthroughEdit)
  const [editingWalkthrough, setEditingWalkthrough] = useState(false)
  const [walkthroughDraft, setWalkthroughDraft] = useState(
    quest.walkthrough || '',
  )
  const [walkthroughBusy, setWalkthroughBusy] = useState(false)
  const [walkthroughError, setWalkthroughError] = useState('')

  useEffect(() => {
    setEditingWalkthrough(false)
    setWalkthroughDraft(quest.walkthrough || '')
    setWalkthroughError('')
  }, [quest.id, quest.walkthrough])

  const split = splitChainAndLinked(quest.chainQuests)
  const chainQuests = split.chainQuests
  const linkedQuests = [
    ...split.linkedQuests,
    ...(quest.linkedQuests || []),
  ]
  const discovery = [
    quest.discoveryCategory ? `[${quest.discoveryCategory}]` : null,
    quest.discoveryRank != null ? `${quest.discoveryRank}성` : null,
    quest.discoveryName,
  ]
    .filter(Boolean)
    .join(' ')

  const description = dropMapSource(quest.description || '', quest.destination)
  const walkthroughSteps = dropMapSource(
    quest.walkthrough || '',
    quest.destination,
  )
    .split('\n')
    .filter((line) => line.trim().length > 0)

  const progressBlocks = dropMapSource(quest.progress || '', quest.destination)
    .split(/\n(?=\d+\.\s+|결론\s*[-–—])/)
    .map((block) => block.trim())
    .filter(Boolean)

  const showWalkthrough =
    walkthroughSteps.length > 0 || canEditWalkthrough || editingWalkthrough

  async function saveWalkthrough() {
    if (!walkthroughEdit) return
    setWalkthroughBusy(true)
    setWalkthroughError('')
    try {
      const res = await updateQuest(walkthroughEdit.token, quest.id, {
        walkthrough: walkthroughDraft,
      })
      walkthroughEdit.onSaved(res.quest)
      setEditingWalkthrough(false)
    } catch (err) {
      setWalkthroughError(
        err instanceof Error ? err.message : '공략 저장에 실패했습니다.',
      )
    } finally {
      setWalkthroughBusy(false)
    }
  }

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">
            {quest.category
              ? `[${quest.category}] ${quest.questType || ''}`.trim()
              : '퀘스트'}
          </span>
          <DifficultyStars value={quest.difficulty} />
        </div>
        <h2>{quest.name}</h2>
        {description ? <p>{description}</p> : null}
      </header>

      <section className="quest-detail-section">
        <h3>기본 정보</h3>
        <div className="quest-kv-grid">
          <div>
            <span>의뢰 장소</span>
            <strong>{quest.requestPlaces || '-'}</strong>
          </div>
          <div>
            <span>목적지</span>
            <strong>{quest.destination || '-'}</strong>
          </div>
          <div className="quest-kv-wide">
            <span>발견물</span>
            <strong>{discovery || '-'}</strong>
          </div>
        </div>
      </section>

      <section className="quest-detail-section">
        <h3>필요 스킬</h3>
        {quest.skills.length ? (
          <ul className="quest-skill-chips">
            {quest.skills.map((skill) => (
              <li key={`${skill.name}-${skill.level}`}>
                <span>{skill.name}</span>
                {skill.level != null && <em>Lv.{skill.level}</em>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="quest-muted">없음</p>
        )}
      </section>

      <section className="quest-detail-section">
        <h3>보상</h3>
        <div className="quest-reward-grid">
          <article>
            <p>두캇</p>
            <dl>
              <div>
                <dt>보상금</dt>
                <dd>{formatNum(quest.rewardDucat)}</dd>
              </div>
              <div>
                <dt>선금</dt>
                <dd>{formatNum(quest.rewardAdvance)}</dd>
              </div>
            </dl>
          </article>
          <article>
            <p>경험치 · 명성</p>
            <dl>
              <div>
                <dt>발견</dt>
                <dd>{formatNum(quest.expDiscovery)}</dd>
              </div>
              <div>
                <dt>카드</dt>
                <dd>{formatNum(quest.expCard)}</dd>
              </div>
              <div>
                <dt>보고</dt>
                <dd>{formatNum(quest.expReport)}</dd>
              </div>
              <div>
                <dt>명성</dt>
                <dd>{formatNum(quest.fameReport)}</dd>
              </div>
            </dl>
          </article>
          <article className="quest-reward-items">
            <p>아이템</p>
            {quest.rewardItems.length ? (
              <ul>
                {quest.rewardItems.map((item) => (
                  <li key={`${item.name}-${item.qty}`}>
                    <span>{item.name}</span>
                    <strong>{item.qty != null ? `×${item.qty}` : ''}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quest-muted">없음</p>
            )}
          </article>
        </div>
      </section>

      {chainQuests.length > 0 && (
        <section className="quest-detail-section">
          <h3>연속 퀘스트</h3>
          <QuestRelatedList
            items={chainQuests}
            currentName={quest.name}
            numbered
          />
        </section>
      )}

      {linkedQuests.length > 0 && (
        <section className="quest-detail-section">
          <h3>연결 지도/퀘스트</h3>
          <QuestRelatedList
            items={linkedQuests}
            currentName={quest.name}
            numbered={false}
          />
        </section>
      )}

      {showWalkthrough && (
        <section className="quest-detail-section">
          <div className="quest-section-head">
            <h3>공략</h3>
            {canEditWalkthrough && !editingWalkthrough ? (
              <button
                type="button"
                className="quest-edit-icon-btn"
                aria-label="공략 수정"
                title="공략 수정"
                onClick={() => {
                  setWalkthroughDraft(quest.walkthrough || '')
                  setWalkthroughError('')
                  setEditingWalkthrough(true)
                }}
              >
                <PencilIcon />
              </button>
            ) : null}
          </div>
          {editingWalkthrough ? (
            <div className="quest-walkthrough-edit">
              <textarea
                className="quest-walkthrough-textarea"
                value={walkthroughDraft}
                onChange={(e) => setWalkthroughDraft(e.target.value)}
                rows={12}
                disabled={walkthroughBusy}
                aria-label="공략 내용"
              />
              {walkthroughError ? (
                <p className="form-note error" role="alert">
                  {walkthroughError}
                </p>
              ) : null}
              <div className="quest-walkthrough-actions">
                <button
                  type="button"
                  className="admin-btn"
                  disabled={walkthroughBusy}
                  onClick={() => {
                    setEditingWalkthrough(false)
                    setWalkthroughDraft(quest.walkthrough || '')
                    setWalkthroughError('')
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  disabled={walkthroughBusy}
                  onClick={() => void saveWalkthrough()}
                >
                  {walkthroughBusy ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          ) : walkthroughSteps.length > 0 ? (
            <ol className="quest-steps">
              {walkthroughSteps.map((step, idx) => {
                const cleaned = step.replace(/^\d+\.\s*/, '')
                const isNote = cleaned.startsWith('-') || !/^\d+\./.test(step)
                if (isNote && !/^\d+\./.test(step)) {
                  return (
                    <li key={idx} className="is-note">
                      {cleaned.replace(/^-\s*/, '')}
                    </li>
                  )
                }
                return <li key={idx}>{cleaned}</li>
              })}
            </ol>
          ) : (
            <p className="quest-muted">공략이 없습니다.</p>
          )}
        </section>
      )}

      {progressBlocks.length > 0 && (
        <section className="quest-detail-section">
          <h3>진행</h3>
          <div className="quest-progress">
            {progressBlocks.map((block, idx) => {
              const lines = block.split('\n')
              const title = lines[0] || ''
              const body = lines.slice(1).join('\n').trim()
              const isConclusion = /^결론/.test(title)
              return (
                <article
                  key={idx}
                  className={isConclusion ? 'is-conclusion' : undefined}
                >
                  <h4>{title}</h4>
                  {body && <p>{body}</p>}
                </article>
              )
            })}
          </div>
        </section>
      )}

      {onToggleCompleted && (
        <div className="quest-complete-actions">
          {quest.completed ? (
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
