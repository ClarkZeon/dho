import { useEffect, useMemo, useState } from 'react'
import { fetchShips } from '../lib/api'
import { calcAccel, type AccelShipForm } from '../lib/shipAccel'
import type { ShipDetail } from '../types'
import { ShipSearchSelect } from './ShipSearchSelect'

type ShipAccelProps = {
  token: string
}

const FORMS: { value: AccelShipForm; label: string }[] = [
  { value: 'sail', label: '범선' },
  { value: 'galley', label: '갤리' },
  { value: 'steam', label: '증기선' },
]

const LOAD_ADJUST_MAX = 25

type LoadAdjustMode = 'none' | 'down' | 'up'

function toAccelForm(code: string | null | undefined): AccelShipForm {
  if (code === 'galley' || code === 'steam' || code === 'sail') return code
  return 'sail'
}

function clampLoadPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(LOAD_ADJUST_MAX, Math.max(0, Math.floor(value)))
}

/** 기본 적재에 적다 또는 적업 % 반영 (최대 25%) */
function effectiveLoad(
  baseLoad: number,
  mode: LoadAdjustMode,
  percent: number,
) {
  const p = clampLoadPercent(percent)
  if (mode === 'down' && p > 0) {
    return Math.max(0, Math.round((baseLoad * (100 - p)) / 100))
  }
  if (mode === 'up' && p > 0) {
    return Math.max(0, Math.round((baseLoad * (100 + p)) / 100))
  }
  return Math.max(0, Math.round(baseLoad))
}

function applyShip(
  ship: ShipDetail,
  setters: {
    setForm: (v: AccelShipForm) => void
    setBaseArmor: (v: number) => void
    setExtraArmor: (v: number) => void
    setBaseLoad: (v: number) => void
    setLoadMode: (v: LoadAdjustMode) => void
    setLoadPercent: (v: number) => void
    setRapidAccel: (v: boolean) => void
  },
) {
  setters.setForm(toAccelForm(ship.formCode))
  setters.setBaseArmor(ship.armor)
  setters.setExtraArmor(0)
  setters.setBaseLoad(ship.loadTotal)
  setters.setLoadMode('none')
  setters.setLoadPercent(0)
  setters.setRapidAccel(ship.skills.some((s) => s.name === '급가속'))
}

export function ShipAccel({ token }: ShipAccelProps) {
  const [ships, setShips] = useState<ShipDetail[]>([])
  const [shipSlug, setShipSlug] = useState('')
  const [shipsError, setShipsError] = useState('')
  const [form, setForm] = useState<AccelShipForm>('sail')
  const [baseArmor, setBaseArmor] = useState(0)
  const [extraArmor, setExtraArmor] = useState(0)
  const [baseLoad, setBaseLoad] = useState(0)
  const [loadMode, setLoadMode] = useState<LoadAdjustMode>('none')
  const [loadPercent, setLoadPercent] = useState(0)
  const [adventurer, setAdventurer] = useState(false)
  const [rapidAccel, setRapidAccel] = useState(false)
  const [seaSurvey, setSeaSurvey] = useState(false)
  const [accelGrade, setAccelGrade] = useState<0 | 1 | 2 | 3>(0)
  const [coal, setCoal] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setShipsError('')
        const res = await fetchShips(token)
        if (!alive) return
        setShips(res.ships)
      } catch (err) {
        if (!alive) return
        setShipsError(
          err instanceof Error ? err.message : '선박 목록을 불러오지 못했습니다.',
        )
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const selectedShip = ships.find((s) => s.slug === shipSlug) ?? null

  function loadShip(slug: string) {
    setShipSlug(slug)
    const ship = ships.find((s) => s.slug === slug)
    if (!ship) return
    applyShip(ship, {
      setForm,
      setBaseArmor,
      setExtraArmor,
      setBaseLoad,
      setLoadMode,
      setLoadPercent,
      setRapidAccel,
    })
  }

  const armorTotal = baseArmor + extraArmor
  const loadTotal = effectiveLoad(baseLoad, loadMode, loadPercent)
  /** 가강 장착 + 추가 장갑이 있으면 +0.5 자동 반영 */
  const gradeWithExtraArmor = accelGrade > 0 && extraArmor > 0

  const result = useMemo(
    () =>
      calcAccel({
        form,
        armor: armorTotal,
        load: loadTotal,
        adventurer,
        rapidAccel,
        seaSurvey,
        accelGrade,
        gradeWithExtraArmor,
        coal,
      }),
    [
      form,
      armorTotal,
      loadTotal,
      adventurer,
      rapidAccel,
      seaSurvey,
      accelGrade,
      gradeWithExtraArmor,
      coal,
    ],
  )

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>선박 가속도 계산기</h1>
          <p>선박 정보를 불러오거나, 장갑·적재·조건을 직접 넣어 가속단계를 계산합니다.</p>
        </div>
      </div>

      <div className="accel-layout">
        <form className="accel-form" onSubmit={(e) => e.preventDefault()}>
          <div className="accel-load-row">
            <ShipSearchSelect
              label="선박 정보 불러오기"
              value={shipSlug}
              disabled={ships.length === 0}
              placeholder="선박 이름 검색…"
              options={ships.map((ship) => ({
                value: ship.slug,
                label: ship.name,
                meta: [ship.size, ship.form].filter(Boolean).join(' · '),
              }))}
              onChange={loadShip}
            />
            {selectedShip && (
              <p className="accel-load-hint">
                {selectedShip.name} · 기본 장갑 {selectedShip.armor} · 총 적재{' '}
                {selectedShip.loadTotal}
                {selectedShip.skills.some((s) => s.name === '급가속')
                  ? ' · 급가속 있음'
                  : ''}
              </p>
            )}
            {shipsError && (
              <p className="form-note error" role="alert">
                {shipsError}
              </p>
            )}
          </div>

          {selectedShip && (
            <label className="ship-pick">
              <span className="ship-pick-label">선박 형식</span>
              <select
                value={form}
                disabled
                title="선박 정보에서 불러옵니다"
                aria-readonly="true"
              >
                {FORMS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="accel-num-grid">
            {selectedShip && (
              <label className="ship-pick">
                <span className="ship-pick-label">기본 장갑 (강화 제외)</span>
                <input
                  type="number"
                  min={0}
                  value={baseArmor}
                  readOnly
                  disabled
                  title="선박 정보에서 불러옵니다"
                />
              </label>
            )}
            <label className="ship-pick">
              <span className="ship-pick-label">추가 장갑 (강화 제외)</span>
              <input
                type="number"
                min={0}
                value={extraArmor}
                onChange={(e) => setExtraArmor(Number(e.target.value) || 0)}
              />
            </label>
            {selectedShip && (
              <label className="ship-pick">
                <span className="ship-pick-label">기본 총 적재 (강화 제외)</span>
                <input
                  type="number"
                  min={0}
                  value={baseLoad}
                  readOnly
                  disabled
                  title="선박 정보에서 불러옵니다"
                />
              </label>
            )}
            <div className="ship-pick accel-load-adjust">
              <span className="ship-pick-label">적재 조정 (최대 25%)</span>
              <div className="accel-load-adjust-row">
                <select
                  value={loadMode}
                  aria-label="적재 조정 방식"
                  onChange={(e) => {
                    const next = e.target.value as LoadAdjustMode
                    setLoadMode(next)
                    if (next === 'none') setLoadPercent(0)
                    else if (loadPercent === 0) setLoadPercent(25)
                  }}
                >
                  <option value="none">없음</option>
                  <option value="down">적재 다운</option>
                  <option value="up">적재 업</option>
                </select>
                <input
                  type="number"
                  min={0}
                  max={LOAD_ADJUST_MAX}
                  value={loadMode === 'none' ? 0 : loadPercent}
                  disabled={loadMode === 'none'}
                  aria-label="적재 조정 퍼센트"
                  onChange={(e) =>
                    setLoadPercent(clampLoadPercent(Number(e.target.value)))
                  }
                />
                <span className="accel-load-adjust-unit">%</span>
              </div>
            </div>
            {selectedShip && (
              <p className="accel-load-hint accel-armor-sum">
                계산용 장갑 a = 기본 + 추가 = {armorTotal}
                <br />
                계산용 적재 b
                {loadMode === 'down' && loadPercent > 0
                  ? ` = 기본 × (100 − ${loadPercent}) ÷ 100 = ${loadTotal}`
                  : loadMode === 'up' && loadPercent > 0
                    ? ` = 기본 × (100 + ${loadPercent}) ÷ 100 = ${loadTotal}`
                    : ` = 기본 = ${loadTotal}`}
              </p>
            )}
          </div>

          <fieldset className="accel-checks">
            <legend>조건</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={adventurer}
                onChange={(e) => setAdventurer(e.target.checked)}
              />
              <span>모험계 직업 (+1)</span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={rapidAccel}
                onChange={(e) => setRapidAccel(e.target.checked)}
              />
              <span>급가속 (+6)</span>
            </label>
            {form !== 'steam' && (
              <>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={seaSurvey}
                    onChange={(e) => setSeaSurvey(e.target.checked)}
                  />
                  <span>해역조사 (+2)</span>
                </label>
                <label className="ship-pick">
                  <span className="ship-pick-label">가속강화 그레이드</span>
                  <select
                    value={accelGrade}
                    onChange={(e) =>
                      setAccelGrade(Number(e.target.value) as 0 | 1 | 2 | 3)
                    }
                  >
                    <option value={0}>없음</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </label>
                <p className="accel-load-hint">
                  가강 + 추가장갑 (+0.5):{' '}
                  {gradeWithExtraArmor ? '적용' : '미적용'}
                  {!gradeWithExtraArmor &&
                    (accelGrade === 0
                      ? ' — 가강 필요'
                      : extraArmor <= 0
                        ? ' — 추가 장갑 필요'
                        : '')}
                </p>
              </>
            )}
            {form === 'steam' && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={coal}
                  onChange={(e) => setCoal(e.target.checked)}
                />
                <span>석탄 소지</span>
              </label>
            )}
          </fieldset>
        </form>

        <aside className="accel-result" aria-live="polite">
          <p className="accel-result-label">가속단계</p>
          <p className="accel-result-value">{result.a}</p>
          {result.capped && (
            <p className="accel-result-cap">상한 46 적용</p>
          )}
          {result.note && <p className="accel-result-note">{result.note}</p>}
          <dl className="accel-breakdown">
            <div>
              <dt>X (장갑·적재·직업·급가)</dt>
              <dd>{result.x}</dd>
            </div>
            <div>
              <dt>
                {form === 'galley'
                  ? 'Y (갤리·노젓기)'
                  : form === 'steam'
                    ? 'Y (증기선·석탄)'
                    : 'Y (범선·증기기관)'}
              </dt>
              <dd>{result.y}</dd>
            </div>
            <div>
              <dt>Z (해역·가강)</dt>
              <dd>{result.z}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  )
}
