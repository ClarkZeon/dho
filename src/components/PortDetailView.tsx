import type { PortDetail } from '../types'

type PortDetailViewProps = {
  port: PortDetail
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value?.trim() ? value : '-'}</strong>
    </div>
  )
}

export function PortDetailView({ port }: PortDetailViewProps) {
  const coords =
    port.coordX != null && port.coordY != null
      ? `${port.coordX}, ${port.coordY}`
      : null

  const collectBySource = port.collectItems.reduce<
    Record<string, typeof port.collectItems>
  >((acc, item) => {
    const key = item.source || '기타'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">
            {port.category ? port.category : '항구 · 도시'}
          </span>
        </div>
        <h2>{port.name}</h2>
        {port.description ? <p>{port.description}</p> : null}
      </header>

      <section className="quest-detail-section">
        <h3>기본 정보</h3>
        <div className="quest-kv-grid">
          <Row label="분류" value={port.category} />
          <Row label="지역" value={port.region} />
          <Row label="해역" value={port.seaArea} />
          <Row label="좌표" value={coords} />
          <Row label="입항허가" value={port.entryPermit} />
          <Row label="문화" value={port.culture} />
          <Row label="언어" value={port.language} />
        </div>
      </section>

      {port.rewards.length > 0 && (
        <section className="quest-detail-section">
          <h3>보상</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>종류</th>
                  <th>금액</th>
                  <th>보상</th>
                </tr>
              </thead>
              <tbody>
                {port.rewards.map((row, idx) => (
                  <tr key={`${row.kind}-${idx}`}>
                    <td>{row.kind}</td>
                    <td>{row.amount || '-'}</td>
                    <td>{row.reward || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {port.collectItems.length > 0 && (
        <section className="quest-detail-section">
          <h3>수집 아이템</h3>
          {Object.entries(collectBySource).map(([source, items]) => (
            <div key={source} style={{ marginBottom: '0.85rem' }}>
              <p className="quest-badge" style={{ display: 'inline-block' }}>
                {source}
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>랭크</th>
                      <th>종류</th>
                      <th>아이템</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={`${source}-${item.rank}-${idx}`}>
                        <td>{item.rank ?? '-'}</td>
                        <td>{item.type || '-'}</td>
                        <td>{item.items || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
