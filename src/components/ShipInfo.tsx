import { useEffect, useState } from 'react'
import { fetchShip, fetchShips } from '../lib/api'
import type { ShipDetail } from '../types'
import { ShipDetailView } from './ShipDetailView'
import { ShipSearchSelect } from './ShipSearchSelect'

type ShipInfoProps = {
  token: string
}

export function ShipInfo({ token }: ShipInfoProps) {
  const [ships, setShips] = useState<ShipDetail[]>([])
  const [slug, setSlug] = useState('')
  const [ship, setShip] = useState<ShipDetail | null>(null)
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
        const first = res.ships[0]?.slug ?? ''
        setSlug((prev) => prev || first)
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : '선박 목록을 불러오지 못했습니다.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  useEffect(() => {
    if (!slug) {
      setShip(null)
      return
    }
    let alive = true
    ;(async () => {
      try {
        setError('')
        const res = await fetchShip(token, slug)
        if (!alive) return
        setShip(res.ship)
      } catch (err) {
        if (!alive) return
        setShip(null)
        setError(err instanceof Error ? err.message : '선박 정보를 불러오지 못했습니다.')
      }
    })()
    return () => {
      alive = false
    }
  }, [token, slug])

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>선박 정보</h1>
          <p>등록된 선박의 기본 스펙을 확인합니다.</p>
        </div>
      </div>

      <ShipSearchSelect
        label="선박"
        value={slug}
        disabled={loading || ships.length === 0}
        placeholder="선박 이름 검색…"
        emptyText={ships.length === 0 ? '선박 없음' : '검색 결과 없음'}
        options={ships.map((item) => ({
          value: item.slug,
          label: item.name,
          meta: [item.size, item.form].filter(Boolean).join(' · '),
        }))}
        onChange={setSlug}
      />

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      {ship && <ShipDetailView ship={ship} />}
    </section>
  )
}
