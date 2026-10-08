import { useEffect, useMemo, useState } from 'react'
import { fetchShips } from '../lib/api'
import type { ShipDetail } from '../types'

type ShipCompareProps = {
  token: string
  onBack: () => void
}

type Diff = 'better' | 'worse' | 'same' | 'plain'

type Row = {
  key: string
  label: string
  left: string
  right: string
  leftDiff: Diff
  rightDiff: Diff
}

function numDiff(a: number, b: number, higherIsBetter = true): [Diff, Diff] {
  if (a === b) return ['same', 'same']
  const aWins = higherIsBetter ? a > b : a < b
  return aWins ? ['better', 'worse'] : ['worse', 'better']
}

function buildRows(left: ShipDetail, right: ShipDetail): Row[] {
  const pairs: Array<{
    key: string
    label: string
    a: number | string | null
    b: number | string | null
    numeric?: boolean
    higherIsBetter?: boolean
  }> = [
    { key: 'size', label: '크기', a: left.size, b: right.size },
    { key: 'form', label: '형식', a: left.form, b: right.form },
    { key: 'material', label: '재질', a: left.material, b: right.material },
    { key: 'adv', label: '모험 Lv', a: left.adventureLv, b: right.adventureLv, numeric: true },
    { key: 'trade', label: '교역 Lv', a: left.tradeLv, b: right.tradeLv, numeric: true },
    { key: 'battle', label: '전투 Lv', a: left.battleLv, b: right.battleLv, numeric: true },
    { key: 'dur', label: '내구도', a: left.durability, b: right.durability, numeric: true },
    { key: 'sv', label: '세로돛', a: left.sailVertical, b: right.sailVertical, numeric: true },
    { key: 'sh', label: '가로돛', a: left.sailHorizontal, b: right.sailHorizontal, numeric: true },
    { key: 'st', label: '돛 합', a: left.sailTotal, b: right.sailTotal, numeric: true },
    { key: 'oar', label: '조력', a: left.oar, b: right.oar, numeric: true },
    { key: 'turn', label: '선회', a: left.turn, b: right.turn, numeric: true },
    { key: 'wave', label: '내파', a: left.wave, b: right.wave, numeric: true },
    { key: 'armor', label: '장갑', a: left.armor, b: right.armor, numeric: true },
    { key: 'cabin', label: '선실', a: left.cabin, b: right.cabin, numeric: true },
    {
      key: 'crew',
      label: '필요 선원',
      a: left.crewRequired,
      b: right.crewRequired,
      numeric: true,
      higherIsBetter: false,
    },
    { key: 'guns', label: '포실', a: left.guns, b: right.guns, numeric: true },
    { key: 'wh', label: '창고', a: left.warehouse, b: right.warehouse, numeric: true },
    { key: 'load', label: '총 적재', a: left.loadTotal, b: right.loadTotal, numeric: true },
  ]

  return pairs.map((row) => {
    if (row.numeric && typeof row.a === 'number' && typeof row.b === 'number') {
      const [leftDiff, rightDiff] = numDiff(row.a, row.b, row.higherIsBetter !== false)
      return {
        key: row.key,
        label: row.label,
        left: String(row.a),
        right: String(row.b),
        leftDiff,
        rightDiff,
      }
    }
    return {
      key: row.key,
      label: row.label,
      left: row.a == null ? '-' : String(row.a),
      right: row.b == null ? '-' : String(row.b),
      leftDiff: 'plain',
      rightDiff: 'plain',
    }
  })
}

function ShipPick({
  label,
  value,
  otherId,
  ships,
  onChange,
}: {
  label: string
  value: string
  otherId: string
  ships: ShipDetail[]
  onChange: (slug: string) => void
}) {
  return (
    <label className="ship-pick">
      <span className="ship-pick-label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        <option value="">선박 선택</option>
        {ships.map((ship) => (
          <option key={ship.slug} value={ship.slug} disabled={ship.slug === otherId}>
            {ship.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function CompareCard({
  side,
  ship,
  rows,
}: {
  side: 'left' | 'right'
  ship: ShipDetail
  rows: Row[]
}) {
  return (
    <article className={`ship-compare-card side-${side}`}>
      <header className="ship-compare-card-head">
        <p className="ship-compare-side">{side === 'left' ? 'A' : 'B'}</p>
        <h2>{ship.name}</h2>
        <p className="ship-compare-meta">
          {[ship.size, ship.form].filter(Boolean).join(' · ')}
        </p>
      </header>

      <dl className="ship-compare-stats">
        {rows.map((row) => {
          const diff = side === 'left' ? row.leftDiff : row.rightDiff
          const value = side === 'left' ? row.left : row.right
          return (
            <div key={row.key} className={`ship-stat-row is-${diff}`}>
              <dt>{row.label}</dt>
              <dd>{value}</dd>
            </div>
          )
        })}
      </dl>

      <div className="ship-compare-skills">
        <p className="ship-compare-skills-title">선박 스킬</p>
        <ul>
          {ship.skills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export function ShipCompare({ token, onBack }: ShipCompareProps) {
  const [ships, setShips] = useState<ShipDetail[]>([])
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetchShips(token)
        if (!alive) return
        setShips(res.ships)
        setLeftId(res.ships[0]?.slug ?? '')
        setRightId(res.ships[1]?.slug ?? res.ships[0]?.slug ?? '')
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : '선박 목록을 불러오지 못했습니다.')
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const left = ships.find((s) => s.slug === leftId)
  const right = ships.find((s) => s.slug === rightId)

  const rows = useMemo(() => {
    if (!left || !right) return []
    return buildRows(left, right)
  }, [left, right])

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <button type="button" className="text-link" onClick={onBack}>
            ← 대시보드
          </button>
          <h1>선박 비교</h1>
          <p>두 척을 골라 기본 스펙을 나란히 비교합니다.</p>
        </div>
      </div>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      <div className="ship-compare-picks">
        <ShipPick
          label="선박 A"
          value={leftId}
          otherId={rightId}
          ships={ships}
          onChange={setLeftId}
        />
        <ShipPick
          label="선박 B"
          value={rightId}
          otherId={leftId}
          ships={ships}
          onChange={setRightId}
        />
      </div>

      {left && right ? (
        <div className="ship-compare-grid">
          <CompareCard side="left" ship={left} rows={rows} />
          <CompareCard side="right" ship={right} rows={rows} />
        </div>
      ) : (
        <div className="tool-card">
          <p className="tool-card-title">선박을 선택하세요</p>
          <p className="tool-card-desc">
            {ships.length < 2
              ? '비교하려면 선박이 두 척 이상 필요합니다. 현재 DB에는 팬시가 등록되어 있습니다.'
              : '왼쪽·오른쪽 선박을 각각 고르면 비교표가 나타납니다.'}
          </p>
        </div>
      )}
    </section>
  )
}
