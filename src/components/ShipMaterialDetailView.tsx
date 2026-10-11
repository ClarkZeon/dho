import {
  effectsByColumn,
  MATERIAL_STAT_COLUMNS,
} from '../lib/shipMaterialStats'
import type { ShipMaterialDetail } from '../types'

type ShipMaterialDetailViewProps = {
  material: ShipMaterialDetail
}

export function ShipMaterialDetailView({
  material,
}: ShipMaterialDetailViewProps) {
  const stats = effectsByColumn(material.effects)
  const acquires = material.acquireMethods || []
  const hasStats = MATERIAL_STAT_COLUMNS.some((col) => Boolean(stats[col]))

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">선박 재료</span>
          {material.materialKind ? (
            <span className="quest-badge soft">{material.materialKind}</span>
          ) : null}
        </div>
        <h2>{material.name}</h2>
        {material.description ? <p>{material.description}</p> : null}
      </header>

      <section className="quest-detail-section">
        <h3>재료 효과</h3>
        <div className="admin-table-wrap material-list-table-wrap">
          <table className="admin-table material-list-table">
            <thead>
              <tr>
                {MATERIAL_STAT_COLUMNS.map((stat) => (
                  <th key={stat}>{stat}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hasStats ? (
                <tr>
                  {MATERIAL_STAT_COLUMNS.map((stat) => (
                    <td key={stat} className="material-list-stat">
                      {stats[stat] || ''}
                    </td>
                  ))}
                </tr>
              ) : (
                <tr>
                  <td colSpan={MATERIAL_STAT_COLUMNS.length}>
                    등록된 효과가 없습니다.
                  </td>
                </tr>
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
