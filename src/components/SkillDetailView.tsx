import type { SkillDetail } from '../types'

type SkillDetailViewProps = {
  skill: SkillDetail
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value?.trim() ? value : '-'}</strong>
    </div>
  )
}

function formatCost(n: number | null) {
  if (n == null) return null
  return `${n.toLocaleString('ko-KR')}두캇`
}

export function SkillDetailView({ skill }: SkillDetailViewProps) {
  const learnPlaces = skill.learnPlaces || []
  const useCities = skill.useCities || []
  const preferredJobs = skill.preferredJobs || []
  const acquireConditions = skill.acquireConditions || []

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">스킬</span>
          {skill.category ? (
            <span className="quest-badge">{skill.category}</span>
          ) : null}
        </div>
        <h2>{skill.name}</h2>
        {skill.description ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{skill.description}</p>
        ) : null}
      </header>

      <section className="quest-detail-section">
        <h3>기본 정보</h3>
        <div className="quest-kv-grid">
          <Row label="분류" value={skill.category || '언어'} />
          <Row label="부관담당" value={skill.officerDuty} />
          <Row label="행동력" value={skill.actionPower} />
          <Row label="범위" value={skill.rangeScope} />
          <Row label="습득 비용" value={formatCost(skill.learnCost)} />
          <Row label="연성 효과" value={skill.refineEffect} />
          <Row label="자동효과" value={skill.autoEffect} />
          {skill.prerequisite && acquireConditions.length === 0 ? (
            <Row label="선행 스킬" value={skill.prerequisite} />
          ) : null}
        </div>
      </section>

      {preferredJobs.length > 0 && (
        <section className="quest-detail-section">
          <h3>우대 직업</h3>
          <p>{preferredJobs.join(', ')}</p>
        </section>
      )}

      {acquireConditions.length > 0 && (
        <section className="quest-detail-section">
          <h3>습득 조건</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>종류</th>
                  <th>내용</th>
                </tr>
              </thead>
              <tbody>
                {acquireConditions.map((row, index) => (
                  <tr key={`${row.kind}-${index}`}>
                    <td>{row.kind || '-'}</td>
                    <td>{row.content || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {learnPlaces.length > 0 && (
        <section className="quest-detail-section">
          <h3>스킬 습득</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>지역</th>
                  <th>도시</th>
                  <th>도시 인물</th>
                </tr>
              </thead>
              <tbody>
                {learnPlaces.map((place, index) => (
                  <tr key={`${place.city}-${index}`}>
                    <td>{place.region || '-'}</td>
                    <td>{place.city || '-'}</td>
                    <td>{place.npc || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {useCities.length > 0 && (
        <section className="quest-detail-section">
          <h3>사용 도시</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>지역</th>
                  <th>도시</th>
                </tr>
              </thead>
              <tbody>
                {useCities.map((city, index) => (
                  <tr key={`${city.city}-${index}`}>
                    <td>{city.region || '-'}</td>
                    <td>{city.city || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
