import { useEffect, useState } from 'react'
import { fetchShips } from '../lib/api'
import type { ShipDetail } from '../types'
import { DetailModal } from './DetailModal'
import { ShipDetailView } from './ShipDetailView'
import { ShipList } from './ShipList'

type ShipInfoProps = {
  token: string
}

export function ShipInfo({ token }: ShipInfoProps) {
  const [ships, setShips] = useState<ShipDetail[]>([])
  const [detail, setDetail] = useState<ShipDetail | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchShips(token)
        if (!alive) return
        setShips(res.ships)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '선박 목록을 불러오지 못했습니다.',
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
          <h1>선박 정보</h1>
          <p>등록된 선박을 검색·비교하고 상세를 엽니다.</p>
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
        <ShipList ships={ships} onOpen={setDetail} />
      )}

      {detail && (
        <DetailModal
          title="선박 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <ShipDetailView ship={detail} />
        </DetailModal>
      )}
    </section>
  )
}
