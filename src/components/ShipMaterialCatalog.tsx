import { useEffect, useState } from 'react'
import { fetchShipMaterials } from '../lib/api'
import type { ShipMaterialDetail } from '../types'
import { DetailModal } from './DetailModal'
import { ShipMaterialDetailView } from './ShipMaterialDetailView'
import { ShipMaterialList } from './ShipMaterialList'

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
          <p>재료 종류·스탯을 비교하고 상세를 엽니다.</p>
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
        <ShipMaterialList
          materials={materials}
          onOpen={(material) => setDetail(material)}
        />
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
