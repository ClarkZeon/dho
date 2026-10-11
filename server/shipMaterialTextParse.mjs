/**
 * 위키형 선박 재료 텍스트 → DB용 객체
 *
 * 선박 재료스웨덴 제독 재료
 * - 선박의 재질을 …
 * 재료 종류	재질	가능	전체
 * 선박 기본 재질	스웨덴 제독 재료	내구도	0 ~ 20
 * 장갑	0 ~ 2
 * 획득 방법
 * 트레져박스
 * 아이템
 * Tactic & Combo
 */

function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function splitTabs(line) {
  return line.split('\t').map((s) => s.trim())
}

function parseRange(text) {
  const s = String(text || '').trim()
  const m = s.match(/(-?\d+)\s*[~～〜\-–—]\s*(-?\d+)/)
  if (!m) return null
  return { min: Number(m[1]), max: Number(m[2]) }
}

function isHeaderRow(cols) {
  return (
    cols.length >= 2 &&
    /^재료\s*종류$/.test(cols[0] || '') &&
    /^재질$/.test(cols[1] || '')
  )
}

function isStatName(text) {
  return /^(내구도|세로돛|가로돛|조력|선회|내파|장갑|선실|포실|창고|포문|돛|노)$/.test(
    String(text || '').trim(),
  )
}

/**
 * @param {string} text
 */
export function parseShipMaterialText(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!raw) throw new Error('텍스트가 비어 있습니다.')

  const lines = raw.split('\n').map((l) => l.trimEnd())

  let name = ''
  let nameIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const titled = line.match(/^선박\s*재료\s*[|｜]\s*(.+)$/)
    if (titled) {
      name = normalizeName(titled[1])
      nameIdx = i
      break
    }

    const glued = line.match(/^선박\s*재료\s*(.+)$/)
    if (glued) {
      name = normalizeName(glued[1])
      nameIdx = i
      break
    }

    name = normalizeName(line)
    nameIdx = i
    break
  }

  if (!name) throw new Error('재료 이름을 찾지 못했습니다.')

  let description = ''
  let materialKind = null
  let materialLabel = null
  /** @type {Array<{ stat: string, min: number|null, max: number|null }>} */
  let effects = []
  /** @type {Array<{ source: string, items: string[] }>} */
  let acquireMethods = []

  /** @type {null | 'effects' | 'acquire'} */
  let mode = null
  let acquireSource = null
  let acquireItems = []
  let sawItemHeader = false

  function flushAcquire() {
    if (acquireSource || acquireItems.length > 0) {
      acquireMethods.push({
        source: acquireSource || '기타',
        items: [...acquireItems],
      })
    }
    acquireSource = null
    acquireItems = []
    sawItemHeader = false
  }

  for (let i = nameIdx + 1; i < lines.length; i++) {
    const line = lines[i].replace(/^[\uFEFF\u200B\u200C\u200D]+/, '').trim()
    if (!line) continue

    if (/^획득\s*방법/.test(line)) {
      mode = 'acquire'
      continue
    }

    if (mode === 'acquire') {
      if (/^아이템$/.test(line)) {
        sawItemHeader = true
        continue
      }
      // 새 획득 소스 탭 (트레져박스 등)
      if (
        !sawItemHeader &&
        acquireItems.length === 0 &&
        !/\t/.test(line) &&
        line.length < 40
      ) {
        if (acquireSource && acquireItems.length === 0) {
          // 이전 소스에 아이템 없이 다음 소스 — 교체
        }
        if (acquireSource && acquireItems.length > 0) flushAcquire()
        acquireSource = line
        continue
      }
      acquireItems.push(line)
      continue
    }

    const cols = splitTabs(line)
    if (isHeaderRow(cols)) {
      mode = 'effects'
      continue
    }

    // 설명 줄: "- …" 또는 아직 표 시작 전
    if (mode !== 'effects' && !/^재료\s*종류/.test(cols[0] || '')) {
      const desc = line.replace(/^[-–—]\s*/, '').trim()
      if (desc) {
        description = description ? `${description}\n${desc}` : desc
      }
      continue
    }

    mode = 'effects'

    // 선박 기본 재질	스웨덴 제독 재료	내구도	0 ~ 20
    if (cols.length >= 4 && cols[0] && !isStatName(cols[0])) {
      materialKind = cols[0] || materialKind
      materialLabel = cols[1] || materialLabel
      const range = parseRange(cols[3] || cols[2])
      const stat = isStatName(cols[2]) ? cols[2] : null
      if (stat) {
        effects.push({
          stat,
          min: range?.min ?? null,
          max: range?.max ?? null,
        })
      }
      continue
    }

    // 이미지형 연속 행: 빈칸	빈칸	장갑	0 ~ 20
    if (cols.length >= 4 && !cols[0] && isStatName(cols[2])) {
      const range = parseRange(cols[3])
      effects.push({
        stat: cols[2],
        min: range?.min ?? null,
        max: range?.max ?? null,
      })
      continue
    }

    // 붙여넣기 축약: 장갑	0 ~ 2
    if (cols.length >= 2 && isStatName(cols[0])) {
      const range = parseRange(cols[1])
      effects.push({
        stat: cols[0],
        min: range?.min ?? null,
        max: range?.max ?? null,
      })
      continue
    }

    // 재료 종류만 + 범위가 2열: 장갑이 종류처럼 온 경우 이미 처리됨
    if (cols.length >= 2 && cols[0] && parseRange(cols[1])) {
      // 종류명이 스탯이 아니면 materialKind 후보
      if (!materialKind) materialKind = cols[0]
      continue
    }
  }

  flushAcquire()

  return {
    name,
    code: null,
    description: description || null,
    materialKind,
    materialLabel: materialLabel || name,
    effects,
    acquireMethods,
  }
}
