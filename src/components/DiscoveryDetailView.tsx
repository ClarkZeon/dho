import type { ReactNode } from 'react'
import type {
  DiscoveryDetail,
  DiscoveryQuestRef,
} from '../types'

type DiscoveryDetailViewProps = {
  discovery: DiscoveryDetail
  onOpenQuest?: (quest: DiscoveryQuestRef) => void
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
}: DiscoveryDetailViewProps) {
  const linked = discovery.linkedQuests || []
  const debate = discovery.debateCombo
  const acquireQuest = discovery.acquireQuest

  const acquireLabel = discovery.acquireType
    ? `[${discovery.acquireType}] ${
        acquireQuest?.name || discovery.acquireName || ''
      }`.trim()
    : discovery.acquireName

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
        <h3>기본 정보</h3>
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
