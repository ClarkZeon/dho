const DEST_SEP = /\s*(?:»|>>|›|→|➜|➔|⟶|⇒|->)\s*/

export type DestinationStep = {
  kind: 'city' | 'land'
  /** 칩·점프용 이름 (괄호 앞) */
  name: string
  /** 칩 뒤 일반 텍스트 — 괄호 포함, 예: ` (14150, 1280)` */
  note?: string | null
}

export type SplitQuestDestinationOptions = {
  /** 항구·도시 이름 — 도시 칩·경유 분할 */
  cityNames?: readonly string[]
  /** 육지·상륙지·필드 이름 — 구분자 없는 다단 목적지 복원 */
  landNames?: readonly string[]
}

function normName(s: string) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * `남그린란드섬 앞바다 (14150, 1280)`
 * → name `남그린란드섬 앞바다`, note ` (14150, 1280)` (괄호 포함)
 */
export function splitDestinationParenSuffix(raw: string): {
  name: string
  note: string | null
} {
  const text = normName(raw)
  const m = text.match(/^(.*?)(\s*[（(][^）)]*[）)])\s*$/u)
  if (!m) return { name: text, note: null }
  const name = m[1].trim()
  if (!name) return { name: text, note: null }
  const paren = m[2].trim()
  return { name, note: ` ${paren}` }
}

/** 칩·점프용 — 끝 괄호만 제거 */
export function stripDestinationParenSuffix(name: string): string {
  return splitDestinationParenSuffix(name).name
}

function uniqueNames(list: readonly string[] | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of list || []) {
    const name = normName(raw)
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

function fromSteps(steps: DestinationStep[]): {
  steps: DestinationStep[]
  cities: string[]
  place: string | null
  city: string | null
} {
  const clean = steps
    .map((s) => {
      const parts = splitDestinationParenSuffix(s.name)
      return {
        kind: s.kind,
        name: parts.name,
        note: s.note?.trim() ? s.note : parts.note,
      }
    })
    .filter((s) => s.name)
  const cities = clean.filter((s) => s.kind === 'city').map((s) => s.name)
  const last = clean[clean.length - 1]
  const place =
    last?.kind === 'land'
      ? last.name
      : clean.length === 1
        ? clean[0].name
        : last?.name || null
  return {
    steps: clean,
    cities,
    place,
    city: cities[0] || null,
  }
}

function classifySegments(
  segments: string[],
  citySet: Set<string>,
): DestinationStep[] {
  return segments.map((name, index) => {
    const isLast = index === segments.length - 1
    if (isLast) return { kind: 'land' as const, name }
    if (citySet.has(name)) return { kind: 'city' as const, name }
    return { kind: 'land' as const, name }
  })
}

/**
 * 구분자 없이 붙은 목적지 복원.
 * - `리마 리마 북동쪽` / `런던 옥스포드 옥스포드 주점`
 */
function splitLooseByRepeat(text: string): string[] | null {
  const parts = text.split(' ').filter(Boolean)
  if (parts.length < 2) return null

  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i] !== parts[i + 1]) continue
    const cities = parts.slice(0, i + 1)
    const place = [parts[i], ...parts.slice(i + 2)].join(' ')
    if (cities.length && place) return [...cities, place]
  }

  for (let i = 1; i < parts.length; i++) {
    const city = parts.slice(0, i).join(' ')
    const place = parts.slice(i).join(' ')
    if (place === city || place.startsWith(`${city} `)) {
      return [city, place]
    }
  }

  return null
}

/**
 * 도시·육지 카탈로그 이름으로 왼쪽부터 탐욕 분할.
 * `남미 남동쪽 해안 파라과이 강 상류` → 두 육지
 */
function splitLooseByKnownNames(
  text: string,
  knownNames: string[],
): string[] | null {
  if (!knownNames.length) return null
  const sorted = [...knownNames].sort((a, b) => b.length - a.length)

  function walk(rest: string, depth: number): string[] | null {
    if (!rest) return depth > 0 ? [] : null

    for (const name of sorted) {
      if (rest === name) return [name]
      if (!rest.startsWith(`${name} `)) continue
      const after = rest.slice(name.length).trim()
      // `옥스포드 옥스포드 주점` — 육지가 같은 이름으로 시작 → 여기서 쪼개지 않음
      if (after === name || after.startsWith(`${name} `)) continue
      const tail = walk(after, depth + 1)
      if (tail) return [name, ...tail]
    }

    if (depth > 0) return [rest]
    return null
  }

  const parts = walk(text, 0)
  return parts && parts.length >= 2 ? parts : null
}

/**
 * 퀘스트 목적지 표기.
 * - `리마 » 리마 북동쪽` / `런던 → 옥스포드 → 옥스포드 주점`
 * - `남미 남동쪽 해안›파라과이 강 상류` (위키 ›)
 * - 구분자 빠진 `남미 남동쪽 해안 파라과이 강 상류` (육지명으로 복원)
 */
export function splitQuestDestination(
  raw: string | null | undefined,
  options: SplitQuestDestinationOptions = {},
): {
  steps: DestinationStep[]
  /** 도시 칩 이름들 */
  cities: string[]
  /** 마지막 육지·장소 */
  place: string | null
  /** 첫 도시 — 하위 호환 */
  city: string | null
} {
  const text = normName(raw || '')
  if (!text) return fromSteps([])

  const cityNames = uniqueNames(options.cityNames)
  const landNames = uniqueNames(options.landNames)
  const citySet = new Set(cityNames)
  const knownNames = uniqueNames([...cityNames, ...landNames])

  const segments = text
    .split(DEST_SEP)
    .map((s) => s.trim())
    .filter(Boolean)

  if (segments.length >= 2) {
    return fromSteps(classifySegments(segments, citySet))
  }

  // 끝 괄호는 매칭용으로만 떼고, 마지막 스텝 note 로 복원
  const { name: bare, note: trailingNote } = splitDestinationParenSuffix(text)

  const repeated = splitLooseByRepeat(bare)
  if (repeated) {
    const steps = classifySegments(repeated, citySet)
    if (trailingNote && steps.length > 0) {
      steps[steps.length - 1] = {
        ...steps[steps.length - 1],
        note: trailingNote,
      }
    }
    return fromSteps(steps)
  }

  const byName = splitLooseByKnownNames(bare, knownNames)
  if (byName) {
    const steps = classifySegments(byName, citySet)
    if (trailingNote && steps.length > 0) {
      steps[steps.length - 1] = {
        ...steps[steps.length - 1],
        note: trailingNote,
      }
    }
    return fromSteps(steps)
  }

  return fromSteps([{ kind: 'land', name: text }])
}

/** 화면 표기: `런던 » 옥스포드 » 옥스포드 주점` / 단일이면 그대로 */
export function formatQuestDestination(
  raw: string | null | undefined,
  options: SplitQuestDestinationOptions = {},
): string | null {
  const { steps } = splitQuestDestination(raw, options)
  if (steps.length === 0) return null
  const label = (s: DestinationStep) =>
    s.note ? `${s.name}${s.note}` : s.name
  if (steps.length === 1) return label(steps[0])
  return steps.map(label).join(' » ')
}

const DEST_SEP_CHAR = /(?:»|>>|›|→|➜|➔|⟶|⇒|->)/

/**
 * 구분자 없이 토큰이 2개 이상 붙어 있으면 단계 확인이 필요.
 * (`남미 남동쪽 해안 파라과이 강 상류` — 카탈로그에 없을 때)
 * 단, 전체가 도시·육지 이름과 일치하거나(`테라 노바 북쪽 해안`),
 * 카탈로그로 2단 이상 자동 복원되면 확인하지 않는다.
 */
export function isAmbiguousQuestDestination(
  raw: string | null | undefined,
  options: SplitQuestDestinationOptions = {},
): boolean {
  const text = normName(raw || '')
  if (!text) return false
  if (DEST_SEP_CHAR.test(text)) return false

  const known = new Set(
    uniqueNames([...(options.cityNames || []), ...(options.landNames || [])]),
  )
  if (known.has(text)) return false

  const { steps } = splitQuestDestination(text, options)
  if (steps.length >= 2) return false

  return text.split(' ').filter(Boolean).length >= 2
}

/** 확정된 단계들을 `A » B » C` 로 합침 */
export function joinQuestDestinationParts(parts: readonly string[]): string {
  return parts
    .map((p) => normName(p))
    .filter(Boolean)
    .join(' » ')
}

/**
 * 위키 퀘스트 텍스트에서 목적지 값만 추출 (저장 전 확인용).
 * 서버 `pickLabeledValue(/목적지/)` 와 같은 경계를 사용.
 */
export function extractDestinationFromQuestText(
  text: string | null | undefined,
): string | null {
  const lines = String(text || '').split(/\r?\n/)
  const nextLabels = '발견물|의뢰\\s*장소|크로노\\s*퀘스트|특징'
  const re = new RegExp(
    `(?:^|[\\t\\s])목적지[\\t\\s:：]+(.+?)(?=[\\t\\s]+(?:${nextLabels})(?:[\\t\\s:：]|$)|$)`,
    'u',
  )
  for (const line of lines) {
    const m = line.match(re)
    if (!m) continue
    const dest = normName(m[1])
    if (dest) return dest
  }
  return null
}
