import { useEffect, useState } from 'react'
import { fetchShip, fetchShips } from '../lib/api'
import type { ShipDetail } from '../types'

type ShipInfoProps = {
  token: string
  onBack: () => void
}

function StatTable({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: string | number | null | undefined }[]
}) {
  return (
    <section className="tool-card ship-info-block">
      <p className="tool-card-title">{title}</p>
      <dl className="ship-compare-stats">
        {rows.map((row) => (
          <div key={row.label} className="ship-stat-row">
            <dt>{row.label}</dt>
            <dd>{row.value ?? '-'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function ShipInfo({ token, onBack }: ShipInfoProps) {
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
          <button type="button" className="text-link" onClick={onBack}>
            ← 대시보드
          </button>
          <h1>선박 정보</h1>
          <p>등록된 선박의 기본 스펙을 확인합니다.</p>
        </div>
      </div>

      <label className="ship-pick">
        <span className="ship-pick-label">선박</span>
        <select
          value={slug}
          disabled={loading || ships.length === 0}
          onChange={(e) => setSlug(e.target.value)}
        >
          {ships.length === 0 && <option value="">선박 없음</option>}
          {ships.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      {ship && (
        <>
          <header className="ship-info-hero">
            <p className="ship-compare-side">{ship.category || '선박'}</p>
            <h2>{ship.name}</h2>
            {ship.description && <p>{ship.description}</p>}
            <p className="ship-compare-meta">
              {[ship.size, ship.form, ship.material].filter(Boolean).join(' · ')}
            </p>
          </header>

          <div className="ship-info-grid">
            <StatTable
              title="레벨 / 획득"
              rows={[
                { label: '모험 Lv', value: ship.adventureLv },
                { label: '교역 Lv', value: ship.tradeLv },
                { label: '전투 Lv', value: ship.battleLv },
                { label: '강화 횟수', value: ship.enhanceCount },
                { label: '획득 방법', value: ship.acquireMethod },
              ]}
            />
            <StatTable
              title="기본 성능"
              rows={[
                { label: '내구도', value: ship.durability },
                { label: '세로돛', value: ship.sailVertical },
                { label: '가로돛', value: ship.sailHorizontal },
                { label: '돛 합', value: ship.sailTotal },
                { label: '조력', value: ship.oar },
                { label: '선회', value: ship.turn },
                { label: '내파', value: ship.wave },
                { label: '장갑', value: ship.armor },
              ]}
            />
            <StatTable
              title="적재"
              rows={[
                { label: '선실', value: ship.cabin },
                { label: '필요 선원', value: ship.crewRequired },
                { label: '포실', value: ship.guns },
                { label: '창고', value: ship.warehouse },
                { label: '총 적재', value: ship.loadTotal },
              ]}
            />
            <StatTable
              title="강화 상한"
              rows={[
                { label: '내구도', value: ship.caps.durability },
                { label: '세로돛', value: ship.caps.sailVertical },
                { label: '가로돛', value: ship.caps.sailHorizontal },
                { label: '조력', value: ship.caps.oar },
                { label: '선회', value: ship.caps.turn },
                { label: '내파', value: ship.caps.wave },
                { label: '장갑', value: ship.caps.armor },
                { label: '선실', value: ship.caps.cabin },
                { label: '포실', value: ship.caps.guns },
                { label: '창고', value: ship.caps.warehouse },
              ]}
            />
            <StatTable
              title="선박 부품"
              rows={[
                { label: '보조돛', value: ship.parts.auxSail },
                { label: '선수상', value: ship.parts.figurehead },
                { label: '문장', value: ship.parts.emblem },
                { label: '특수장비', value: ship.parts.special },
                { label: '추가장갑', value: ship.parts.extraArmor },
                { label: '선측포', value: ship.parts.broadside },
                { label: '선수포', value: ship.parts.bow },
                { label: '선미포', value: ship.parts.stern },
              ]}
            />
            <section className="tool-card ship-info-block">
              <p className="tool-card-title">선박 스킬</p>
              <ul className="ship-info-skills">
                {ship.skills.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </section>
  )
}
