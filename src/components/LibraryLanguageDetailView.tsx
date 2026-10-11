import type { LibraryLanguageDetail } from '../types'

type LibraryLanguageDetailViewProps = {
  language: LibraryLanguageDetail
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

export function LibraryLanguageDetailView({
  language,
}: LibraryLanguageDetailViewProps) {
  const learnPlaces = language.learnPlaces || []
  const useCities = language.useCities || []

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">스킬</span>
          <span className="quest-badge">언어</span>
        </div>
        <h2>{language.name}</h2>
        {language.description ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{language.description}</p>
        ) : null}
      </header>

      <section className="quest-detail-section">
        <h3>기본 정보</h3>
        <div className="quest-kv-grid">
          <Row label="분류" value={language.category} />
          <Row label="범위" value={language.rangeScope} />
          <Row label="행동력" value={language.actionPower} />
          <Row label="자동효과" value={language.autoEffect} />
          <Row label="습득 비용" value={formatCost(language.learnCost)} />
          {language.prerequisite ? (
            <Row label="선행 스킬" value={language.prerequisite} />
          ) : null}
        </div>
      </section>

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
