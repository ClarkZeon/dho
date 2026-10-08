import type { QuestDetail } from '../types'

function formatNum(n: number | null | undefined) {
  if (n == null) return '-'
  return n.toLocaleString('ko-KR')
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
}

export function QuestDetailView({ quest }: QuestDetailViewProps) {
  const discovery = [
    quest.discoveryCategory ? `[${quest.discoveryCategory}]` : null,
    quest.discoveryRank != null ? `${quest.discoveryRank}성` : null,
    quest.discoveryName,
  ]
    .filter(Boolean)
    .join(' ')

  const walkthroughSteps = (quest.walkthrough || '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)

  const progressBlocks = (quest.progress || '')
    .split(/\n(?=\d+\.\s+|결론\s*[-–—])/)
    .map((block) => block.trim())
    .filter(Boolean)

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
        {quest.description && <p>{quest.description}</p>}
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

      {quest.chainQuests.length > 0 && (
        <section className="quest-detail-section">
          <h3>연속 퀘스트</h3>
          <ol className="quest-chain">
            {quest.chainQuests.map((item, idx) => {
              const isCurrent =
                item.name &&
                item.name.replace(/\s+/g, ' ') === quest.name.replace(/\s+/g, ' ')
              return (
                <li
                  key={`${item.name || item.raw || idx}-${idx}`}
                  className={isCurrent ? 'is-current' : undefined}
                >
                  <span className="quest-chain-idx">{idx + 1}</span>
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
          </ol>
        </section>
      )}

      {walkthroughSteps.length > 0 && (
        <section className="quest-detail-section">
          <h3>공략</h3>
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
    </div>
  )
}
