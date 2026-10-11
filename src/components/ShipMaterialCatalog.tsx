import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchShipMaterials } from '../lib/api'
import type { ShipMaterialDetail } from '../types'
import { DetailModal } from './DetailModal'
import { ShipMaterialDetailView } from './ShipMaterialDetailView'

type ShipMaterialCatalogProps = {
  token: string
}

export function ShipMaterialCatalog({ token }: ShipMaterialCatalogProps) {
  const [materials, setMaterials] = useState<ShipMaterialDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<ShipMaterialDetail | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchShipMaterials(token)
        if (!alive) return
        setMaterials(res.materials)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '선박 재료 목록을 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>선박 재료</h1>
          <p>등록된 선박 재료를 확인하고 상세를 엽니다.</p>
        </div>
      </div>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="form-note">불러오는 중…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>재료 종류</th>
                <th>효과</th>
                <th>획득</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material, index) => (
                <tr
                  key={material.id}
                  className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                  tabIndex={0}
                  onClick={() => setDetail(material)}
                  onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setDetail(material)
                    }
                  }}
                >
                  <td>{material.name}</td>
                  <td>{material.materialKind || '-'}</td>
                  <td>
                    {material.effects?.length
                      ? material.effects
                          .map((e) =>
                            e.min != null && e.max != null
                              ? `${e.stat} ${e.min}~${e.max}`
                              : e.stat,
                          )
                          .join(', ')
                      : '-'}
                  </td>
                  <td>
                    {material.acquireMethods?.length
                      ? material.acquireMethods.map((a) => a.source).join(', ')
                      : '-'}
                  </td>
                </tr>
              ))}
              {materials.length === 0 && (
                <tr>
                  <td colSpan={4}>등록된 선박 재료가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <DetailModal
          title="선박 재료 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <ShipMaterialDetailView material={detail} />
        </DetailModal>
      )}
    </section>
  )
}
