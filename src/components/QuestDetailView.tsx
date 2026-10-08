import type { ReactNode } from 'react'
import type { QuestDetail } from '../types'

function Block({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="tool-card ship-info-block">
      <p className="tool-card-title">{title}</p>
      {children}
    </section>
  )
}

function formatSkills(
  skills: { name: string; level: number | null }[],
) {
  if (!skills.length) return '-'
  return skills
    .map((s) => (s.level != null ? `${s.name} ${s.level}` : s.name))
    .join(', ')
}

type QuestDetailViewProps = {
  quest: QuestDetail
}

export function QuestDetailView({ quest }: QuestDetailViewProps) {
  const discovery = [
    quest.discoveryCategory ? `[${quest.discoveryCategory}]` : null,
    quest.discoveryRank != null ? String(quest.discoveryRank) : null,
    quest.discoveryName,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="ship-detail-view quest-detail-view">
      <header className="ship-info-hero">
        <p className="ship-compare-side">
          {[quest.category, quest.questType].filter(Boolean).join(' · ') ||
            '퀘스트'}
        </p>
        <h2>{quest.name}</h2>
        {quest.description && (
          <p className="quest-detail-desc">{quest.description}</p>
        )}
        <p className="ship-compare-meta">
          {[
            quest.difficulty != null ? `난이도 ${quest.difficulty}` : null,
            quest.destination,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <div className="ship-info-grid">
        <Block title="기본 정보">
          <dl className="ship-compare-stats">
            <div className="ship-stat-row">
              <dt>분류</dt>
              <dd>
                {quest.category
                  ? `[${quest.category}] ${quest.questType || ''}`.trim()
                  : '-'}
              </dd>
            </div>
            <div className="ship-stat-row">
              <dt>난이도</dt>
              <dd>{quest.difficulty ?? '-'}</dd>
            </div>
            <div className="ship-stat-row">
              <dt>의뢰 장소</dt>
              <dd>{quest.requestPlaces || '-'}</dd>
            </div>
            <div className="ship-stat-row">
              <dt>목적지</dt>
              <dd>{quest.destination || '-'}</dd>
            </div>
            <div className="ship-stat-row">
              <dt>발견물</dt>
              <dd>{discovery || '-'}</dd>
            </div>
          </dl>
        </Block>

        <Block title="필요 스킬">
          <p className="quest-detail-plain">{formatSkills(quest.skills)}</p>
        </Block>

        <Block title="보상">
          <dl className="ship-compare-stats">
            <div className="ship-stat-row">
              <dt>보상금</dt>
              <dd>
                {quest.rewardDucat != null
                  ? `${quest.rewardDucat.toLocaleString('ko-KR')}두캇`
                  : '-'}
              </dd>
            </div>
            <div className="ship-stat-row">
              <dt>선금</dt>
              <dd>
                {quest.rewardAdvance != null
                  ? `${quest.rewardAdvance.toLocaleString('ko-KR')}두캇`
                  : '-'}
              </dd>
            </div>
            <div className="ship-stat-row">
              <dt>발견 경험치</dt>
              <dd>{quest.expDiscovery ?? '-'}</dd>
            </div>
            <div className="ship-stat-row">
              <dt>카드 획득 경험치</dt>
              <dd>{quest.expCard ?? '-'}</dd>
            </div>
            <div className="ship-stat-row">
              <dt>보고시 경험치</dt>
              <dd>{quest.expReport ?? '-'}</dd>
            </div>
            <div className="ship-stat-row">
              <dt>보고시 명성</dt>
              <dd>{quest.fameReport ?? '-'}</dd>
            </div>
            <div className="ship-stat-row">
              <dt>아이템</dt>
              <dd>
                {quest.rewardItems.length
                  ? quest.rewardItems
                      .map((i) =>
                        i.qty != null ? `${i.name} ${i.qty}` : i.name,
                      )
                      .join(', ')
                  : '-'}
              </dd>
            </div>
          </dl>
        </Block>
      </div>

      {quest.chainQuests.length > 0 && (
        <Block title="연속 퀘스트">
          <ul className="quest-detail-list">
            {quest.chainQuests.map((item, idx) => (
              <li key={`${item.name || item.raw || idx}-${idx}`}>
                {item.raw ||
                  [
                    item.category,
                    item.name,
                    item.difficulty != null ? `(${item.difficulty})` : null,
                    item.places ? `- ${item.places}` : null,
                  ]
                    .filter(Boolean)
                    .join(' | ')}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {quest.walkthrough && (
        <Block title="공략">
          <pre className="quest-detail-pre">{quest.walkthrough}</pre>
        </Block>
      )}

      {quest.progress && (
        <Block title="진행">
          <pre className="quest-detail-pre">{quest.progress}</pre>
        </Block>
      )}
    </div>
  )
}
