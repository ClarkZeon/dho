import { getModuleDef } from '../lib/detailModules'
import type { RefineDetail } from '../types'
import { SkillEdgeLabel } from './SkillEdgeLabel'

type RefineDetailViewProps = {
  refine: RefineDetail
  onOpenSkill?: (skill: { name: string }) => void
}

function Kv({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null
  return (
    <div>
      <span>{label}</span>
      <strong style={{ whiteSpace: 'pre-wrap' }}>{value}</strong>
    </div>
  )
}

export function RefineDetailView({
  refine,
  onOpenSkill,
}: RefineDetailViewProps) {
  const skills = refine.skills || []

  return (
    <div className="quest-detail" data-module-host="refine">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">
            {getModuleDef('refine')?.title ?? '연성 효과'}
          </span>
        </div>
        <h2>{refine.name}</h2>
        {refine.description ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{refine.description}</p>
        ) : null}
      </header>

      {(refine.actionPower || skills.length > 0) && (
        <section className="quest-detail-section">
          <h3>기본 정보</h3>
          <div className="quest-kv-grid">
            <Kv label="행동력" value={refine.actionPower} />
          </div>
          {skills.length > 0 ? (
            <div className="skill-module-rows">
              <div className="skill-module-row">
                <span className="skill-module-row-label">스킬</span>
                <ul className="quest-skill-chips">
                  {skills.map((name, index) => (
                    <li key={`${name}-${index}`} className="is-skill-chip">
                      <SkillEdgeLabel />
                      {onOpenSkill ? (
                        <button
                          type="button"
                          className="quest-skill-chip-btn"
                          onClick={() => onOpenSkill({ name })}
                        >
                          {name}
                        </button>
                      ) : (
                        <span>{name}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </section>
      )}
    </div>
  )
}
