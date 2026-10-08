/**
 * 위키형 퀘스트 텍스트 → DB용 객체
 */

import { createHash } from 'node:crypto'

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `quest-${hash}`
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
  // 생태 조사 1, 생물학 3, 스와힐리어 1
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

function parseItemList(text) {
  // 목재 21, 의뢰 알선서 5
  return String(text || '')
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.+?)\s+(\d+)\s*$/)
      if (!m) return { name: part, qty: null }
      return { name: m[1].trim(), qty: Number(m[2]) }
    })
}

function parseChainLine(line) {
  // 모험 | 아프리카의 거목 (5 생태 조사 1, 생물학 3, 스와힐리어 1) - 아덴, …
  const m = line.match(
    /^(.+?)\s*\|\s*(.+?)\s*\((\d+)\s+(.+?)\)\s*-\s*(.+)$/,
  )
  if (!m) {
    return { raw: line.trim() }
  }
  return {
    category: m[1].trim(),
    name: m[2].trim(),
    difficulty: Number(m[3]),
    skills: parseSkillList(m[4]),
    places: m[5].trim(),
  }
}

/**
 * @param {string} text
 */
export function parseQuestText(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!raw) throw new Error('텍스트가 비어 있습니다.')

  const lines = raw.split('\n').map((l) => l.trimEnd())

  let name = ''
  let description = ''
  let nameIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (/^퀘스트/.test(line) && line.length > 3) {
      name = line.replace(/^퀘스트\s*/, '').trim()
      nameIdx = i
      break
    }
    name = line.replace(/^퀘스트\s*/, '').trim()
    nameIdx = i
    break
  }
  name = name.trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('퀘스트 이름을 찾지 못했습니다.')

  for (let i = nameIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (/^분류/.test(line)) break
    description = description ? `${description}\n${line}` : line
  }

  let category = null
  let questType = null
  let difficulty = null
  let requestPlaces = null
  let destination = null
  let discoveryCategory = null
  let discoveryRank = null
  let discoveryName = null
  /** @type {Array<{ name: string, level: number|null }>} */
  let skills = []
  let rewardDucat = null
  let rewardAdvance = null
  let expDiscovery = null
  let expCard = null
  let expReport = null
  let fameReport = null
  /** @type {Array<{ name: string, qty: number|null }>} */
  let rewardItems = []
  /** @type {Array<Record<string, unknown>>} */
  let chainQuests = []
  /** @type {string[]} */
  const walkthroughLines = []
  /** @type {string[]} */
  const progressLines = []

  let mode = 'meta'
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      if (mode === 'walkthrough' || mode === 'progress') {
        if (mode === 'walkthrough') walkthroughLines.push('')
        else progressLines.push('')
      }
      continue
    }

    if (/^분류/.test(line)) {
      const cols = splitTabs(line)
      // 분류	[모험] 일반	난이도	(별은 이미지가 비어있을 수 있음)
      const catCell = cols[1] || ''
      const catMatch = catCell.match(/\[([^\]]+)\]\s*(.*)/)
      if (catMatch) {
        category = catMatch[1].trim()
        questType = catMatch[2].trim() || null
      } else if (catCell) {
        category = catCell
      }
      const diffIdx = cols.findIndex((c) => c === '난이도')
      if (diffIdx >= 0 && cols[diffIdx + 1]) {
        difficulty = toNum(cols[diffIdx + 1])
      }
      // 별만 있고 숫자 없으면 다음 줄/메타에서 못 찾으면 chain의 첫 항목 등으로 보완하지 않음
      continue
    }

    if (/^의뢰\s*장소/.test(line)) {
      const cols = splitTabs(line)
      requestPlaces = cols[1] || null
      const destIdx = cols.findIndex((c) => c === '목적지')
      if (destIdx >= 0) destination = cols[destIdx + 1] || null
      continue
    }

    if (/^발견물/.test(line)) {
      const cols = splitTabs(line)
      const disc = cols[1] || ''
      const m = disc.match(/\[([^\]]+)\]\s*(\d+)\s*(.+)/)
      if (m) {
        discoveryCategory = m[1].trim()
        discoveryRank = Number(m[2])
        discoveryName = m[3].trim()
      } else if (disc) {
        discoveryName = disc
      }
      continue
    }

    if (/^필요$/.test(line)) {
      mode = 'need'
      continue
    }
    if (/^보상$/.test(line)) {
      mode = 'reward'
      continue
    }
    if (/^연속\s*퀘스트/.test(line)) {
      mode = 'chain'
      continue
    }
    if (/^공략/.test(line)) {
      mode = 'walkthrough'
      const rest = line.replace(/^공략\s*/, '').trim()
      if (rest) walkthroughLines.push(rest)
      continue
    }
    if (/^진행/.test(line)) {
      mode = 'progress'
      const rest = line.replace(/^진행\s*/, '').trim()
      if (rest) progressLines.push(rest)
      continue
    }

    if (mode === 'need') {
      if (/^종류\t|^종류$/.test(line)) continue
      const cols = splitTabs(line)
      if (cols[0] === '스킬' && cols[1]) {
        skills = parseSkillList(cols[1])
      }
      continue
    }

    if (mode === 'reward') {
      if (/^종류\t|^종류$/.test(line)) continue
      const cols = splitTabs(line)
      if (cols[0] === '두캇' && cols[1]) {
        const reward = cols[1].match(/보상금\s*[:：]?\s*([\d,]+)/)
        const advance = cols[1].match(/선금\s*[:：]?\s*([\d,]+)/)
        if (reward) rewardDucat = toNum(reward[1])
        if (advance) rewardAdvance = toNum(advance[1])
      } else if (cols[0] === '경험치' && cols[1]) {
        const d = cols[1].match(/발견\s*경험치\s*[:：]?\s*([\d,]+)/)
        const c = cols[1].match(/카드\s*획득\s*경험치\s*[:：]?\s*([\d,]+)/)
        const r = cols[1].match(/보고시\s*경험치\s*[:：]?\s*([\d,]+)/)
        const f = cols[1].match(/보고시\s*명성\s*[:：]?\s*([\d,]+)/)
        if (d) expDiscovery = toNum(d[1])
        if (c) expCard = toNum(c[1])
        if (r) expReport = toNum(r[1])
        if (f) fameReport = toNum(f[1])
      } else if (cols[0] === '아이템' && cols[1]) {
        rewardItems = parseItemList(cols[1])
      }
      continue
    }

    if (mode === 'chain') {
      if (/^공략|^진행/.test(line)) {
        i -= 1
        mode = 'meta'
        continue
      }
      chainQuests.push(parseChainLine(line))
      // 연속 퀘스트 첫 줄에서 난이도 보완
      if (difficulty == null && chainQuests[0]?.difficulty != null) {
        const first = chainQuests[0]
        if (
          first.name === name ||
          String(first.name || '').includes(name) ||
          name.includes(String(first.name || ''))
        ) {
          difficulty = first.difficulty
        }
      }
      continue
    }

    if (mode === 'walkthrough') {
      if (/^진행/.test(line)) {
        i -= 1
        mode = 'meta'
        continue
      }
      walkthroughLines.push(line)
      continue
    }

    if (mode === 'progress') {
      progressLines.push(line)
    }
  }

  // 연속 퀘스트 첫 항목이 본 퀘스트면 난이도 채움
  if (difficulty == null) {
    const self = chainQuests.find(
      (q) => q.name && normalizeLoose(String(q.name)) === normalizeLoose(name),
    )
    if (self?.difficulty != null) difficulty = self.difficulty
  }

  return {
    name,
    slug: slugify(name),
    description: description || null,
    category,
    questType,
    difficulty,
    requestPlaces,
    destination,
    discoveryCategory,
    discoveryRank,
    discoveryName,
    skills,
    rewardDucat,
    rewardAdvance,
    expDiscovery,
    expCard,
    expReport,
    fameReport,
    rewardItems,
    chainQuests,
    walkthrough: walkthroughLines.join('\n').trim() || null,
    progress: progressLines.join('\n').trim() || null,
  }
}

function normalizeLoose(s) {
  return s.trim().replace(/\s+/g, ' ')
}
