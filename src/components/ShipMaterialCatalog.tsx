import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchShipMaterials } from '../lib/api'
import type { ShipMaterialDetail } from '../types'
import { DetailModal } from './DetailModal'
import { ShipMaterialDetailView } from './ShipMaterialDetailView'

const PAGE_SIZE = 15

type ShipMaterialCatalogProps = {
  token: string
}

export function ShipMaterialCatalog({ token }: ShipMaterialCatalogProps) {
  const [materials, setMaterials] = useState<ShipMaterialDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<ShipMaterialDetail | null>(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchShipMaterials(token)
        if (!alive) return
        setMaterials(res.materials)
        setPage(0)
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

  const totalPages = Math.max(1, Math.ceil(materials.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = materials.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )

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
        <>
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
                {pageItems.map((material, index) => (
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
                    <td className="admin-table-wrap-cell">
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
                    <td className="admin-table-wrap-cell">
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

          {materials.length > 0 && (
            <div className="catalog-pager" aria-label="선박 재료 목록 페이지">
              <button
                type="button"
                className="admin-btn"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                이전
              </button>
              <span>
                {safePage + 1} / {totalPages}
                <em>· {materials.length}개</em>
              </span>
              <button
                type="button"
                className="admin-btn"
                disabled={safePage >= totalPages - 1}
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
              >
                다음
              </button>
            </div>
          )}
        </>
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
