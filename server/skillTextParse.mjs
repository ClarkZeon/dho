/**
 * 위키형 스킬 텍스트 → DB용 객체
 *
 * 스킬중국어 / 스킬 | 생태 조사
 * …
 * 스킬 습득 / 사용 도시 / 부관 / 효과 아이템 / 습득 조건
 */

import { createHash } from 'node:crypto'

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `skill-${hash}`
}

function toNum(value) {
  if (value == null) return null
  const n = Number(
    String(value)
      .replace(/,/g, '')
      .replace(/두캇|학점|D|d/g, '')
      .trim(),
  )
  return Number.isFinite(n) ? n : null
}

function emptyCell(v) {
  const t = String(v ?? '').trim()
  if (!t || t === '-') return null
  return t
}

function splitTabs(line) {
  return line.split('\t').map((s) => s.trim())
}

/** @type {Array<{ re: RegExp, key: string }>} */
const META_KEYS = [
  { re: /^분류$/, key: 'category' },
  { re: /^부관\s*담당$/, key: 'officerDuty' },
  { re: /^행동력$/, key: 'actionPower' },
  { re: /^범위$/, key: 'rangeScope' },
  { re: /^(습득\s*비용|학습\s*비용|비용)$/, key: 'learnCost' },
  { re: /^장착\s*비용$/, key: 'equipCost' },
  { re: /^연성\s*효과$/, key: 'refineEffect' },
  { re: /^자동\s*효과$/, key: 'autoEffect' },
  { re: /^(선행\s*스킬|선행)$/, key: 'prerequisite' },
  { re: /^우대\s*직업$/, key: 'preferredJobs' },
  { re: /^추가\s*이름$/, key: 'altName' },
]

function matchMetaKey(cell) {
  const t = String(cell || '').trim()
  if (!t) return null
  for (const item of META_KEYS) {
    if (item.re.test(t)) return item.key
  }
  return null
}

function isMetaLabel(cell) {
  return matchMetaKey(cell) != null
}

function applyMeta(state, key, rawValue) {
  const value = String(rawValue ?? '').trim()

  switch (key) {
    case 'category':
      if (value) state.category = value
      break
    case 'officerDuty':
      if (value) state.officerDuty = value
      break
    case 'actionPower':
      if (value) state.actionPower = value
      break
    case 'rangeScope':
      if (value) state.rangeScope = value
      break
    case 'learnCost':
      state.learnCost = toNum(value)
      break
    case 'equipCost':
      state.equipCost = toNum(value)
      break
    case 'refineEffect':
      if (value) state.refineEffect = value
      break
    case 'autoEffect':
      // 값 없이 라벨만 있으면 자동효과 ON (Y)
      state.autoEffect = value || 'Y'
      break
    case 'prerequisite':
      if (value) state.prerequisite = value
      break
    case 'preferredJobs':
      if (value) {
        state.preferredJobs = value
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean)
      }
      break
    case 'altName':
      if (value) state.altName = value
      break
    default:
      break
  }
}

/** 탭으로 이어진 라벨·값 쌍을 적용. 값이 다음 라벨이면 빈 값으로 본다. */
function applyMetaCols(state, cols) {
  let i = 0
  while (i < cols.length) {
    const key = matchMetaKey(cols[i])
    if (!key) {
      i += 1
      continue
    }
    const next = cols[i + 1]
    if (next != null && !isMetaLabel(next)) {
      applyMeta(state, key, next)
      i += 2
    } else {
      if (key === 'autoEffect') applyMeta(state, key, '')
      i += 1
    }
  }
}

function isLearnHeader(cols) {
  return (
    cols.length >= 2 &&
    /^지역$/.test(cols[0] || '') &&
    /^도시$/.test(cols[1] || '') &&
    /인물/.test(cols[2] || '')
  )
}

function isUseHeader(cols) {
  return (
    cols.length >= 2 &&
    /^지역$/.test(cols[0] || '') &&
    /^도시$/.test(cols[1] || '') &&
    !cols[2]
  )
}

function isConditionHeader(cols) {
  return (
    cols.length >= 2 &&
    /^종류$/.test(cols[0] || '') &&
    /^내용$/.test(cols[1] || '')
  )
}

function isOfficerHeader(cols) {
  return (
    cols.length >= 2 &&
    /^부관$/.test(cols[0] || '') &&
    /^직업$/.test(cols[1] || '')
  )
}

function isEffectHeader(cols) {
  return (
    cols.length >= 2 &&
    /^종류$/.test(cols[0] || '') &&
    /^아이템$/.test(cols[1] || '')
  )
}

/**
 * @param {string} text
 */
export function parseSkillText(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!raw) throw new Error('텍스트가 비어 있습니다.')

  const lines = raw.split('\n').map((l) => l.trimEnd())

  let name = ''
  let nameIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (
      /^스킬\s*습득/.test(line) ||
      /^사용\s*도시/.test(line) ||
      /^습득\s*조건/.test(line) ||
      /^우대\s*직업/.test(line) ||
      /^부관$/.test(line) ||
      /^효과\s*아이템/.test(line)
    ) {
      continue
    }

    const titled = line.match(/^스킬\s*[|｜]\s*(.+)$/)
    if (titled) {
      name = titled[1].trim()
      nameIdx = i
      break
    }

    const glued = line.match(/^스킬\s*(.+)$/)
    if (glued && !/^스킬\s*습득/.test(line)) {
      name = glued[1].trim()
      nameIdx = i
      break
    }

    const langTitle = line.match(/^(?:서고\s*)?언어\s*[|｜]\s*(.+)$/)
    if (langTitle) {
      name = langTitle[1].trim()
      nameIdx = i
      break
    }

    name = line.replace(/^(?:서고\s*)?언어\s*/, '').trim()
    nameIdx = i
    break
  }

  name = name.replace(/\s+/g, ' ')
  if (!name) throw new Error('스킬 이름이 없습니다.')

  const state = {
    description: '',
    category: '언어',
    altName: null,
    officerDuty: null,
    rangeScope: null,
    actionPower: null,
    autoEffect: null,
    refineEffect: null,
    learnCost: null,
    equipCost: null,
    prerequisite: null,
    /** @type {string[]} */
    preferredJobs: [],
    /** @type {Array<{ kind: string, content: string }>} */
    acquireConditions: [],
    /** @type {Array<{ region: string, city: string, npc: string|null }>} */
    learnPlaces: [],
    /** @type {Array<{ region: string, city: string }>} */
    useCities: [],
    /** @type {Array<{ name: string, job: string|null, adventure: string|null, trade: string|null, battle: string|null, trait: string|null }>} */
    officers: [],
    /** @type {Array<{ kind: string, item: string }>} */
    effectItems: [],
  }

  /** @type {null | 'meta' | 'learn' | 'use' | 'conditions' | 'officers' | 'effects'} */
  let mode = null
  let lastLearnRegion = ''

  for (let i = nameIdx + 1; i < lines.length; i++) {
    const line = lines[i].replace(/^[\uFEFF\u200B\u200C\u200D]+/, '').trim()
    if (!line) continue

    if (/^스킬\s*습득/.test(line)) {
      mode = 'learn'
      continue
    }
    if (/^사용\s*도시/.test(line)) {
      mode = 'use'
      continue
    }
    if (/^습득\s*조건/.test(line)) {
      mode = 'conditions'
      continue
    }
    if (/^부관$/.test(line)) {
      mode = 'officers'
      continue
    }
    if (/^효과\s*아이템/.test(line)) {
      mode = 'effects'
      continue
    }

    const cols = splitTabs(line)

    if (mode === 'learn') {
      if (isLearnHeader(cols) || isUseHeader(cols)) continue
      // 동아시아	마카오	마테오 리치
      if (cols.length >= 3 && cols[0] && cols[1]) {
        lastLearnRegion = cols[0]
        state.learnPlaces.push({
          region: cols[0],
          city: cols[1],
          npc: emptyCell(cols[2]),
        })
        continue
      }
      // 이어붙임: 안평	하빈 (지역 생략)
      if (cols.length === 2 && cols[0] && cols[1] && lastLearnRegion) {
        state.learnPlaces.push({
          region: lastLearnRegion,
          city: cols[0],
          npc: emptyCell(cols[1]),
        })
      }
      continue
    }

    if (mode === 'use') {
      if (isUseHeader(cols) || isLearnHeader(cols)) continue
      if (cols[0] && cols[1]) {
        state.useCities.push({ region: cols[0], city: cols[1] })
      }
      continue
    }

    if (mode === 'conditions') {
      if (isConditionHeader(cols)) continue
      if (cols[0] && cols[1] && !isMetaLabel(cols[0])) {
        state.acquireConditions.push({
          kind: cols[0],
          content: cols.slice(1).join('\t'),
        })
      }
      continue
    }

    if (mode === 'officers') {
      if (isOfficerHeader(cols)) continue
      if (cols[0] && cols[0] !== '부관') {
        state.officers.push({
          name: cols[0],
          job: emptyCell(cols[1]),
          adventure: emptyCell(cols[2]),
          trade: emptyCell(cols[3]),
          battle: emptyCell(cols[4]),
          trait: emptyCell(cols[5]),
        })
      }
      continue
    }

    if (mode === 'effects') {
      if (isEffectHeader(cols)) continue
      if (cols[0] && cols[1] && cols[0] !== '종류') {
        state.effectItems.push({
          kind: cols[0],
          item: cols.slice(1).join('\t').trim(),
        })
      }
      continue
    }

    if (/^우대\s*직업$/.test(cols[0] || '')) {
      applyMetaCols(state, cols)
      mode = 'meta'
      continue
    }

    if (matchMetaKey(cols[0])) {
      applyMetaCols(state, cols)
      mode = 'meta'
      continue
    }

    if (!mode || mode === 'meta') {
      if (!matchMetaKey(cols[0])) {
        state.description = state.description
          ? `${state.description}\n${line}`
          : line
      }
    }
  }

  if (!state.prerequisite && state.acquireConditions.length > 0) {
    state.prerequisite = state.acquireConditions
      .map((c) => `${c.kind} ${c.content}`.trim())
      .join(', ')
  }

  return {
    name,
    slug: slugify(name),
    altName: state.altName,
    description: state.description || null,
    category: state.category,
    officerDuty: state.officerDuty,
    rangeScope: state.rangeScope,
    actionPower: state.actionPower,
    autoEffect: state.autoEffect,
    refineEffect: state.refineEffect,
    learnCost: state.learnCost,
    equipCost: state.equipCost,
    prerequisite: state.prerequisite,
    preferredJobs: state.preferredJobs,
    acquireConditions: state.acquireConditions,
    learnPlaces: state.learnPlaces,
    useCities: state.useCities,
    officers: state.officers,
    effectItems: state.effectItems,
  }
}
