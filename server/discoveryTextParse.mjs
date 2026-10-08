/**
 * 위키형 발견물 텍스트 → DB용 객체
 *
 * 발견물비단뱀 / 발견물 | 비단뱀
 * …
 * 분류	생물대형생물	난이도
 * 카드 포인트	6	발견 경험치	1,118
 * …
 * 발견 방법
 * [퀘스트] 모험 | 인도의 큰 뱀 …
 * 연결 지도/퀘스트
 * [퀘스트] 모험 | 드래곤의 자손 …
 * 논전 콤보
 * 효과	논전 콤보	발견물 카드
 * 포인트 +30 & …	구렁이의 속박
 * 보아	비단뱀	아나콘다
 */

import { createHash } from 'node:crypto'

/**
 * 위키 표기용 대분류 접두 (인게임 분류 아님).
 * 저장 분류는 항상 리프만 (예: 대형생물).
 */
const CATEGORY_GROUPS = ['지리·천문', '기상·전승', '유물', '보물', '생물']

const CATEGORY_LEAVES = [
  '종교건축물',
  '역사유물',
  '종교유물',
  '소형생물',
  '중형생물',
  '대형생물',
  '해양생물',
  '항구·마을',
  '항구-마을',
  '기상 현상',
  '기상현상',
  '사적',
  '미술품',
  '보물',
  '화석',
  '식물',
  '곤충',
  '조류',
  '지리',
  '천문',
  '전승',
].sort((a, b) => b.length - a.length)

const FIELD_LABELS = [
  { key: 'category', re: /^(분류|종류)$/ },
  { key: 'rank', re: /^(난이도|등급|랭크|별)$/ },
  { key: 'cardPoints', re: /^카드\s*포인트$/ },
  { key: 'discoveryExp', re: /^발견\s*경험치$/ },
  { key: 'cardExp', re: /^카드\s*획득\s*경험치$|^카드\s*경험치$/ },
  { key: 'reportFame', re: /^보고시?\s*명성$|^보고\s*명성$/ },
  { key: 'skills', re: /^필요\s*스킬$|^스킬$/ },
  { key: 'acquire', re: /^발견\s*방법$|^획득(?:\s*방법)?$|^입수$/ },
  { key: 'place', re: /^(장소|발견\s*장소|위치)$/ },
]

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `discovery-${hash}`
}

function toNum(value) {
  if (value == null) return null
  const n = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

function splitTabs(line) {
  return line.split('\t').map((s) => s.trim())
}

function parseSkillList(text) {
  return String(text || '')
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.+?)\s+(\d+)\s*$/)
      if (!m) return { name: part, level: null }
      return { name: m[1].trim(), level: Number(m[2]) }
    })
}

function countStars(text) {
  const s = String(text || '').trim()
  if (!s) return null
  const icons = (s.match(/[⭐★☆]/g) || []).length
  if (icons > 0) return icons
  const m = s.match(/(\d+)\s*성/)
  if (m) return Number(m[1])
  return toNum(s)
}

function matchFieldLabel(col) {
  const t = String(col || '').trim()
  if (!t) return null
  for (const item of FIELD_LABELS) {
    if (item.re.test(t)) return item.key
  }
  return null
}

function parseLabeledRow(cols) {
  /** @type {Record<string, string>} */
  const out = {}
  let i = 0
  while (i < cols.length) {
    const key = matchFieldLabel(cols[i])
    if (!key) {
      i += 1
      continue
    }
    const vals = []
    let j = i + 1
    while (j < cols.length && !matchFieldLabel(cols[j])) {
      if (cols[j]) vals.push(cols[j])
      j += 1
    }
    out[key] = vals.join(' ').trim()
    i = j
  }
  return out
}

/**
 * 발견 방법·연결 퀘스트 문구에서 퀘스트 이름 추출
 * "모험 | 인도의 큰 뱀 (9 …) - 아덴" → "인도의 큰 뱀"
 */
export function extractQuestNameFromRef(text) {
  let t = String(text || '').trim()
  if (!t) return null
  t = t.replace(/^\[([^\]]+)\]\s*/, '')
  const pipe = t.match(/^[^|｜]+[|｜]\s*(.+)$/s)
  if (pipe) t = pipe[1].trim()
  t = t.replace(/\s*[（(].*$/s, '').trim()
  t = t.replace(/\s+[-–—]\s+.*$/s, '').trim()
  return t || null
}

/**
 * 위키 분류 → 인게임 분류(리프)만.
 * "생물 » 대형생물" / "생물대형생물" → "대형생물"
 */
export function resolveDiscoveryCategory(raw) {
  let text = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!text) return null

  const parted = text
    .split(/\s*[»›>→／/]\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parted.length >= 2) {
    text = parted[parted.length - 1]
  }

  for (const group of CATEGORY_GROUPS) {
    if (text === group) return null
    if (text.startsWith(group) && text.length > group.length) {
      const rest = text.slice(group.length).replace(/^[\s·･・\-]+/, '')
      if (rest) {
        text = rest
        break
      }
    }
  }

  return normalizeLeafName(text)
}

function normalizeLeafName(name) {
  let t = String(name || '').trim()
  if (!t) return null
  if (t === '항구-마을') return '항구·마을'
  if (t === '기상현상') return '기상 현상'

  const compact = t.replace(/\s+/g, '')
  for (const leaf of CATEGORY_LEAVES) {
    const leafNorm =
      leaf === '항구-마을' ? '항구·마을' : leaf === '기상현상' ? '기상 현상' : leaf
    if (leafNorm.replace(/\s+/g, '') === compact) return leafNorm
    if (leaf.replace(/\s+/g, '') === compact) return leafNorm
  }
  return compact
}

function parseAcquireValue(rest) {
  const text = String(rest || '').trim()
  if (!text) return { acquireType: null, acquireName: null }
  const tagged = text.match(/^\[([^\]]+)\]\s*(.+)$/s)
  if (tagged) {
    return {
      acquireType: tagged[1].trim(),
      acquireName: tagged[2].trim(),
    }
  }
  return { acquireType: null, acquireName: text }
}

function parseLinkedQuestLine(line) {
  const raw = String(line || '').trim()
  if (!raw) return null
  const tagged = raw.match(/^\[([^\]]+)\]\s*(.+)$/s)
  if (tagged) {
    return {
      tag: tagged[1].trim(),
      title: tagged[2].trim(),
      raw,
    }
  }
  return { tag: null, title: raw, raw }
}

function isLinkedSection(line) {
  return /^연결\s*지도/.test(line) || /^연결\s*퀘스트/.test(line)
}

function isDebateSection(line) {
  return /^논전\s*콤보/.test(line)
}

function isDebateHeaderRow(cols) {
  return (
    cols.length >= 2 &&
    /^효과$/.test(cols[0] || '') &&
    /논전/.test(cols[1] || '')
  )
}

/**
 * [대형생물] 5성 비단뱀
 */
export function parseCompactDiscovery(line) {
  const cleaned = String(line || '')
    .replace(/^발견물\s*[|｜]\s*/, '')
    .replace(/^발견물\s*/, '')
    .trim()

  const withStars = cleaned.match(/^\[([^\]]+)\]\s*(\d+)\s*성\s+(.+)$/)
  if (withStars) {
    return {
      category: normalizeLeafName(withStars[1]),
      rank: Number(withStars[2]),
      name: withStars[3].trim(),
    }
  }

  const m = cleaned.match(/^\[([^\]]+)\]\s*[⭐★*]?\s*(\d+)\s+(.+)$/)
  if (!m) return null
  return {
    category: normalizeLeafName(m[1]),
    rank: Number(m[2]),
    name: m[3].replace(/^성\s+/, '').trim(),
  }
}

function applyFieldMap(fields, state) {
  if (fields.category != null && fields.category !== '') {
    const leaf = resolveDiscoveryCategory(fields.category)
    if (leaf) state.category = leaf
  }
  if (fields.rank != null && fields.rank !== '') {
    const n = countStars(fields.rank)
    if (n != null) state.rank = n
  }
  if (fields.cardPoints != null && fields.cardPoints !== '') {
    state.cardPoints = toNum(fields.cardPoints)
  }
  if (fields.discoveryExp != null && fields.discoveryExp !== '') {
    state.discoveryExp = toNum(fields.discoveryExp)
  }
  if (fields.cardExp != null && fields.cardExp !== '') {
    state.cardExp = toNum(fields.cardExp)
  }
  if (fields.reportFame != null && fields.reportFame !== '') {
    state.reportFame = toNum(fields.reportFame)
  }
  if (fields.skills != null && fields.skills !== '') {
    state.skills = parseSkillList(fields.skills)
  }
  if (fields.place != null && fields.place !== '') {
    state.place = fields.place
  }
  if (fields.acquire != null && fields.acquire !== '') {
    const acquired = parseAcquireValue(fields.acquire)
    state.acquireType = acquired.acquireType
    state.acquireName = acquired.acquireName
  }
}

/**
 * @param {string} text
 */
export function parseDiscoveryText(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!raw) throw new Error('텍스트가 비어 있습니다.')

  const lines = raw.split('\n').map((l) => l.trimEnd())

  let name = ''
  let nameIdx = 0
  let earlyCategory = null
  let earlyRank = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const title = line.match(/^발견물\s*[|｜]\s*(.+)$/)
    if (title) {
      name = title[1].trim()
      nameIdx = i
      break
    }

    const glued = line.match(/^발견물(.+)$/)
    if (glued && !/^발견물\s*(경험치|방법|카드)/.test(line)) {
      const rest = glued[1].trim()
      const compact = parseCompactDiscovery(rest)
      if (compact) {
        name = compact.name
        earlyCategory = compact.category
        earlyRank = compact.rank
        nameIdx = i
        break
      }
      if (rest) {
        name = rest
        nameIdx = i
        break
      }
    }

    const compact = parseCompactDiscovery(line)
    if (compact) {
      name = compact.name
      earlyCategory = compact.category
      earlyRank = compact.rank
      nameIdx = i
      break
    }

    name = line.replace(/^발견물\s*/, '').trim()
    nameIdx = i
    break
  }

  name = name.replace(/\s+/g, ' ')
  if (!name) throw new Error('발견물 이름을 찾지 못했습니다.')

  const state = {
    category: earlyCategory ? resolveDiscoveryCategory(earlyCategory) : null,
    rank: earlyRank,
    cardPoints: null,
    discoveryExp: null,
    cardExp: null,
    reportFame: null,
    skills: [],
    acquireType: null,
    acquireName: null,
    place: null,
    /** @type {Array<{ tag: string|null, title: string, raw: string }>} */
    linkedQuests: [],
    /** @type {{ effect: string|null, comboName: string|null, cards: string[] }|null} */
    debateCombo: null,
  }

  let description = ''
  /** @type {null | 'linked' | 'debate'} */
  let mode = null

  for (let i = nameIdx + 1; i < lines.length; i++) {
    const line = lines[i].replace(/^[\uFEFF\u200B\u200C\u200D]+/, '').trim()
    if (!line) continue

    const cols = splitTabs(line)
    const first = cols[0] || ''

    if (isLinkedSection(line) || isLinkedSection(first)) {
      mode = 'linked'
      const rest = cols.slice(1).join('\t').trim()
      if (rest && /^\[/.test(rest)) {
        const item = parseLinkedQuestLine(rest)
        if (item) state.linkedQuests.push(item)
      }
      continue
    }

    if (isDebateSection(line) || isDebateSection(first)) {
      mode = 'debate'
      if (!state.debateCombo) {
        state.debateCombo = { effect: null, comboName: null, cards: [] }
      }
      continue
    }

    if (mode === 'linked') {
      if (/^\[/.test(line)) {
        const item = parseLinkedQuestLine(line)
        if (item) state.linkedQuests.push(item)
        continue
      }
      // 연결 섹션에서 라벨 행이 나오면 기본 모드로
      if (matchFieldLabel(first) || Object.keys(parseLabeledRow(cols)).length) {
        mode = null
      } else {
        continue
      }
    }

    if (mode === 'debate') {
      if (isDebateHeaderRow(cols)) continue
      if (!state.debateCombo) {
        state.debateCombo = { effect: null, comboName: null, cards: [] }
      }
      const combo = state.debateCombo
      if (!combo.effect && !combo.comboName) {
        combo.effect = cols[0] || null
        combo.comboName = cols[1] || null
        for (const cell of cols.slice(2)) {
          if (cell) combo.cards.push(cell)
        }
      } else {
        for (const cell of cols) {
          if (cell) combo.cards.push(cell)
        }
      }
      continue
    }

    const compact = parseCompactDiscovery(line)
    if (compact && !state.category) {
      state.category = resolveDiscoveryCategory(compact.category)
      state.rank = compact.rank
      continue
    }

    // 발견 방법 직후 [퀘스트] 줄
    if (
      /^\[(퀘스트|입항|낚시|인식|보물지도|침몰선|유적|레거시)/.test(line)
    ) {
      if (!state.acquireName) {
        const acquired = parseAcquireValue(line)
        state.acquireType = acquired.acquireType
        state.acquireName = acquired.acquireName
        continue
      }
      // 발견 방법은 이미 있는데 연결 섹션 헤더 없이 이어지면 연결로 취급
      const item = parseLinkedQuestLine(line)
      if (item) state.linkedQuests.push(item)
      continue
    }

    const fields = parseLabeledRow(cols)
    if (Object.keys(fields).length > 0) {
      applyFieldMap(fields, state)

      if (
        Object.prototype.hasOwnProperty.call(fields, 'acquire') &&
        !fields.acquire
      ) {
        for (let k = i + 1; k < lines.length; k++) {
          const next = lines[k].trim()
          if (!next) continue
          if (isLinkedSection(next) || isDebateSection(next)) break
          if (matchFieldLabel(splitTabs(next)[0])) break
          const acquired = parseAcquireValue(next)
          state.acquireType = acquired.acquireType
          state.acquireName = acquired.acquireName
          i = k
          break
        }
      }
      continue
    }

    if (
      !state.category &&
      !state.skills.length &&
      !state.place &&
      state.cardPoints == null &&
      state.discoveryExp == null &&
      !state.acquireName
    ) {
      description = description ? `${description}\n${line}` : line
    }
  }

  const debate =
    state.debateCombo &&
    (state.debateCombo.effect ||
      state.debateCombo.comboName ||
      state.debateCombo.cards.length > 0)
      ? state.debateCombo
      : null

  return {
    name,
    slug: slugify(name),
    description: description || null,
    category: state.category,
    rank: state.rank,
    cardPoints: state.cardPoints,
    discoveryExp: state.discoveryExp,
    cardExp: state.cardExp,
    reportFame: state.reportFame,
    skills: state.skills,
    acquireType: state.acquireType,
    acquireName: state.acquireName,
    place: state.place,
    linkedQuests: state.linkedQuests,
    debateCombo: debate,
  }
}
