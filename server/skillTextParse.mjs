/**
 * 위키형 스킬 텍스트 → DB용 객체
 *
 * 스킬생태 조사 / 스킬 | 생태 조사
 * 동식물의 생태를 연구하고 발견한다.
 * 분류	모험	부관담당	감시
 * 행동력	5	범위	자신
 * 습득 비용	3,000두캇	연성 효과	발견 시 피로 회복
 * 우대 직업	궁정 정원사*, …
 * 습득 조건
 * 종류	내용
 * 레벨	모험 Lv3
 * 스킬 습득
 * 지역	도시	도시 인물
 * …
 *
 * 언어 스킬(분류=언어, 사용 도시, 자동효과)도 동일 파서로 처리.
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
      .replace(/두캇|D|d/g, '')
      .trim(),
  )
  return Number.isFinite(n) ? n : null
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
  { re: /^연성\s*효과$/, key: 'refineEffect' },
  { re: /^자동\s*효과$/, key: 'autoEffect' },
  { re: /^(선행\s*스킬|선행)$/, key: 'prerequisite' },
  { re: /^우대\s*직업$/, key: 'preferredJobs' },
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
  if (!value) return

  switch (key) {
    case 'category':
      state.category = value
      break
    case 'officerDuty':
      state.officerDuty = value
      break
    case 'actionPower':
      state.actionPower = value
      break
    case 'rangeScope':
      state.rangeScope = value
      break
    case 'learnCost':
      state.learnCost = toNum(value)
      break
    case 'refineEffect':
      state.refineEffect = value
      break
    case 'autoEffect':
      state.autoEffect = value
      break
    case 'prerequisite':
      state.prerequisite = value
      break
    case 'preferredJobs':
      state.preferredJobs = value
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
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
      /^우대\s*직업/.test(line)
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
    officerDuty: null,
    rangeScope: null,
    actionPower: null,
    autoEffect: null,
    refineEffect: null,
    learnCost: null,
    prerequisite: null,
    /** @type {string[]} */
    preferredJobs: [],
    /** @type {Array<{ kind: string, content: string }>} */
    acquireConditions: [],
    /** @type {Array<{ region: string, city: string, npc: string|null }>} */
    learnPlaces: [],
    /** @type {Array<{ region: string, city: string }>} */
    useCities: [],
  }

  /** @type {null | 'meta' | 'learn' | 'use' | 'conditions'} */
  let mode = null

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

    const cols = splitTabs(line)

    if (mode === 'learn') {
      if (isLearnHeader(cols) || isUseHeader(cols)) continue
      if (cols[0] && cols[1]) {
        state.learnPlaces.push({
          region: cols[0],
          city: cols[1],
          npc: cols[2] || null,
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

    // 우대 직업만 단독 행
    if (/^우대\s*직업$/.test(cols[0] || '')) {
      applyMetaCols(state, cols)
      mode = 'meta'
      continue
    }

    // 메타 키로 시작하는 행
    if (matchMetaKey(cols[0])) {
      applyMetaCols(state, cols)
      mode = 'meta'
      continue
    }

    // 메타 헤더 전 설명
    if (!mode || mode === 'meta') {
      if (!matchMetaKey(cols[0])) {
        state.description = state.description
          ? `${state.description}\n${line}`
          : line
      }
    }
  }

  // 습득 조건만 있고 선행 스킬 문자열이 없으면 요약
  if (!state.prerequisite && state.acquireConditions.length > 0) {
    state.prerequisite = state.acquireConditions
      .map((c) => `${c.kind} ${c.content}`.trim())
      .join(', ')
  }

  return {
    name,
    slug: slugify(name),
    description: state.description || null,
    category: state.category,
    officerDuty: state.officerDuty,
    rangeScope: state.rangeScope,
    actionPower: state.actionPower,
    autoEffect: state.autoEffect,
    refineEffect: state.refineEffect,
    learnCost: state.learnCost,
    prerequisite: state.prerequisite,
    preferredJobs: state.preferredJobs,
    acquireConditions: state.acquireConditions,
    learnPlaces: state.learnPlaces,
    useCities: state.useCities,
  }
}
