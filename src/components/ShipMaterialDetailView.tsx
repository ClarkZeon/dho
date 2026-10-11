import type { ShipMaterialDetail } from '../types'

type ShipMaterialDetailViewProps = {
  material: ShipMaterialDetail
}

function formatRange(min: number | null, max: number | null) {
  if (min == null && max == null) return '-'
  if (min == null) return String(max)
  if (max == null) return String(min)
  return `${min} ~ ${max}`
}

export function ShipMaterialDetailView({
  material,
}: ShipMaterialDetailViewProps) {
  const effects = material.effects || []
  const acquires = material.acquireMethods || []

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">선박 재료</span>
        </div>
        <h2>{material.name}</h2>
        {material.description ? <p>{material.description}</p> : null}
      </header>

      <section className="quest-detail-section">
        <h3>재료 효과</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>재료 종류</th>
                <th>재질</th>
                <th>가능</th>
                <th>전체</th>
              </tr>
            </thead>
            <tbody>
              {effects.length === 0 ? (
                <tr>
                  <td colSpan={4}>등록된 효과가 없습니다.</td>
                </tr>
              ) : (
                effects.map((effect, index) => (
                  <tr key={`${effect.stat}-${index}`}>
                    <td>
                      {index === 0 ? material.materialKind || '-' : ''}
                    </td>
                    <td>
                      {index === 0
                        ? material.materialLabel || material.name
                        : ''}
                    </td>
                    <td>{effect.stat || '-'}</td>
                    <td>{formatRange(effect.min, effect.max)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {acquires.length > 0 && (
        <section className="quest-detail-section">
          <h3>획득 방법</h3>
          {acquires.map((group, index) => (
            <div key={`${group.source}-${index}`} className="quest-kv-grid">
              <div className="quest-kv-wide">
                <span>{group.source}</span>
                <strong>
                  {group.items.length > 0 ? group.items.join(' · ') : '-'}
                </strong>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
