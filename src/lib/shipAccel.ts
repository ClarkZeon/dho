export type AccelShipForm = 'galley' | 'sail' | 'steam'

export type AccelInput = {
  form: AccelShipForm
  armor: number
  load: number
  adventurer: boolean
  rapidAccel: boolean
  seaSurvey: boolean
  accelGrade: 0 | 1 | 2 | 3
  gradeWithExtraArmor: boolean
  coal: boolean
}

export type AccelResult = {
  x: number
  y: number
  z: number
  a: number
  capped: boolean
  note?: string
}

function trunc(n: number) {
  return Math.trunc(n)
}

export function calcX(
  armor: number,
  load: number,
  adventurer: boolean,
  rapidAccel: boolean,
): number {
  const c = adventurer ? 1 : 0
  const d = rapidAccel ? 6 : 0
  return trunc((armor - 5) / 5) - trunc(load / 100) + c + d
}

export function calcZ(
  form: AccelShipForm,
  seaSurvey: boolean,
  accelGrade: 0 | 1 | 2 | 3,
  gradeWithExtraArmor: boolean,
): number {
  if (form === 'steam') return 0
  const e = seaSurvey ? 2 : 0
  const f = accelGrade
  const g = accelGrade > 0 && gradeWithExtraArmor ? 0.5 : 0
  return e + 3 * f + g
}

export function calcAccel(input: AccelInput): AccelResult {
  const x = calcX(input.armor, input.load, input.adventurer, input.rapidAccel)
  const z = calcZ(
    input.form,
    input.seaSurvey,
    input.accelGrade,
    input.gradeWithExtraArmor,
  )

  let y: number
  let a: number
  let note: string | undefined

  if (input.form === 'galley') {
    y = x + 21
    a = z + 2 * x + 21
  } else if (input.form === 'sail') {
    const t = (x + 23) / 3
    y = trunc(t) - (Number.isInteger(t) ? 0.5 : 0)
    a = z + x + y
  } else if (!input.coal) {
    y = 0
    a = 0
    note = '석탄이 없으면 가속이 매우 낮게 고정됩니다. 석탄 소지 시에만 계산합니다.'
    return { x, y, z, a, capped: false, note }
  } else {
    y = 3 * x + 63 - (x % 2 === 0 ? 1 : 0)
    a = 4 * x + 63 - (x % 2 === 0 ? 1 : 0)
  }

  const capped = a > 46
  return { x, y, z, a: Math.min(a, 46), capped, note }
}
