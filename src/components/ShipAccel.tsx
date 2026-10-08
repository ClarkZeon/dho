import { useMemo, useState } from 'react'
import { calcAccel, type AccelShipForm } from '../lib/shipAccel'

type ShipAccelProps = {
  onBack: () => void
}

const FORMS: { value: AccelShipForm; label: string }[] = [
  { value: 'sail', label: '범선' },
  { value: 'galley', label: '갤리' },
  { value: 'steam', label: '증기선' },
]

export function ShipAccel({ onBack }: ShipAccelProps) {
  const [form, setForm] = useState<AccelShipForm>('sail')
  const [armor, setArmor] = useState(20)
  const [load, setLoad] = useState(800)
  const [adventurer, setAdventurer] = useState(false)
  const [rapidAccel, setRapidAccel] = useState(true)
  const [seaSurvey, setSeaSurvey] = useState(false)
  const [accelGrade, setAccelGrade] = useState<0 | 1 | 2 | 3>(0)
  const [gradeWithExtraArmor, setGradeWithExtraArmor] = useState(false)
  const [coal, setCoal] = useState(true)

  const result = useMemo(
    () =>
      calcAccel({
        form,
        armor,
        load,
        adventurer,
        rapidAccel,
        seaSurvey,
        accelGrade,
        gradeWithExtraArmor,
        coal,
      }),
    [
      form,
      armor,
      load,
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
          <button type="button" className="text-link" onClick={onBack}>
            ← 대시보드
          </button>
          <h1>선박 가속도 계산기</h1>
          <p>장갑·적재·스킬 조건으로 가속단계를 계산합니다.</p>
        </div>
      </div>

      <div className="accel-layout">
        <form className="accel-form" onSubmit={(e) => e.preventDefault()}>
          <label className="ship-pick">
            <span className="ship-pick-label">선박 형식</span>
            <select
              value={form}
              onChange={(e) => setForm(e.target.value as AccelShipForm)}
            >
              {FORMS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div className="accel-num-grid">
            <label className="ship-pick">
              <span className="ship-pick-label">장갑 a (강화 제외)</span>
              <input
                type="number"
                min={0}
                value={armor}
                onChange={(e) => setArmor(Number(e.target.value) || 0)}
              />
            </label>
            <label className="ship-pick">
              <span className="ship-pick-label">총 적재 b (강화 제외)</span>
              <input
                type="number"
                min={0}
                value={load}
                onChange={(e) => setLoad(Number(e.target.value) || 0)}
              />
            </label>
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
              <span>급가속 (+6, 전투 중에는 끔)</span>
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
                <label className="check">
                  <input
                    type="checkbox"
                    checked={gradeWithExtraArmor}
                    disabled={accelGrade === 0}
                    onChange={(e) => setGradeWithExtraArmor(e.target.checked)}
                  />
                  <span>가강 + 추가장갑 (+0.5)</span>
                </label>
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
              <dt>X (1차)</dt>
              <dd>{result.x}</dd>
            </div>
            <div>
              <dt>Y (스킬)</dt>
              <dd>{result.y}</dd>
            </div>
            <div>
              <dt>Z (보너스)</dt>
              <dd>{result.z}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  )
}
