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

/**
 * 탭/공백 혼용 위키 줄에서 라벨 다음 값을 뽑음.
 * 예: "크로노 퀘스트\t기원전\t의뢰 장소\t아덴, …"
 *     "목적지 홍해 서쪽 해안 발견물 [화석] 3 …"
 */
function pickLabeledValue(line, labelRe, nextLabelRes = []) {
  const next =
    nextLabelRes.length > 0
      ? nextLabelRes.map((re) => re.source).join('|')
      : null
  const re = new RegExp(
    `(?:^|[\\t\\s])(?:${labelRe.source})[\\t\\s:：]+(.+?)(?=${
      next ? `[\\t\\s]+(?:${next})(?:[\\t\\s:：]|$)` : '$'
    }|$)`,
    'u',
  )
  const m = String(line || '').match(re)
  return m ? m[1].trim() : null
}

function applyQuestMetaLabels(line, state) {
  const places = pickLabeledValue(line, /의뢰\s*장소/, [
    /목적지/,
    /발견물/,
    /크로노\s*퀘스트/,
    /난이도/,
  ])
  if (places) state.requestPlaces = places

  const dest = pickLabeledValue(line, /목적지/, [
    /발견물/,
    /의뢰\s*장소/,
    /크로노\s*퀘스트/,
  ])
  if (dest) state.destination = dest

  const chrono = pickLabeledValue(line, /크로노\s*퀘스트/, [
    /의뢰\s*장소/,
    /목적지/,
    /발견물/,
  ])
  if (chrono) {
    state.questType = state.questType
      ? `${state.questType} · ${chrono}`
      : chrono
  }

  const disc = pickLabeledValue(line, /발견물/, [
    /목적지/,
    /의뢰\s*장소/,
    /크로노\s*퀘스트/,
  ])
  if (disc) {
    const m = disc.match(/\[([^\]]+)\]\s*(\d+)\s*(.+)/)
    if (m) {
      state.discoveryCategory = m[1].trim()
      state.discoveryRank = Number(m[2])
      state.discoveryName = m[3].trim()
    } else {
      state.discoveryName = disc
    }
  }
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

const QUEST_TAG_RE = /[\[［]퀘스트[\]］]/
const LINKED_HEADING_RE = /연결\s*지도/

function parseChainLine(line) {
  // "1. 모험 | …" 번호·[퀘스트] 접두 제거
  const cleaned = String(line || '')
    .trim()
    .replace(/^\d+\.\s*/, '')
    .replace(/^[\[［]퀘스트[\]］]\s*/, '')
  // 모험 | 아프리카의 거목 (5 생태 조사 1, 생물학 3, 스와힐리어 1) - 아덴, …
  // 난이도 앞에 ⭐/★ 가 붙는 위키 표기 허용
  const m = cleaned.match(
    /^(.+?)\s*\|\s*(.+?)\s*\([⭐★*]?\s*(\d+)\s+(.+?)\)\s*-\s*(.+)$/,
  )
  if (!m) {
    return { raw: cleaned }
  }
  return {
    category: m[1].replace(QUEST_TAG_RE, '').trim(),
    name: m[2].trim(),
    difficulty: Number(m[3]),
    skills: parseSkillList(m[4]),
    places: m[5].trim(),
  }
}

function looksLikeChainEntry(line) {
  return /\|/.test(line) && /\([⭐★*]?\s*\d+/.test(line)
}

function isMapSourceLine(line) {
  return /지도\s*출처/.test(String(line || '').trim())
}

/** 공략 단계 앞부분 지명 — "3. 캘리컷 북쪽, …" → "캘리컷 북쪽" */
function placePrefixFromStep(line) {
  const m = String(line || '')
    .trim()
    .match(/^\d+\.\s*(.+)$/)
  if (!m) return ''
  return normalizeLoose(m[1].split(/[,，]/)[0] || '')
}

function isWalkthroughMapCaption(line, destination, placePrefixes) {
  const t = normalizeLoose(line)
  if (!t) return false
  if (/^\d+\./.test(t) || /^[-–—]/.test(t) || /^[（(]/.test(t)) return false
  if (isMapSourceLine(t)) return true
  if (destination && t === normalizeLoose(destination)) return true
  // 마지막 단계 지명과 같은 지도 위젯 제목 (캘리컷 북쪽, 홍해 서쪽 해안)
  return placePrefixes.some((p) => p && t === p)
}

/** 위키 지도 위젯 제목·출처 제거 (지도 기능 없음) */
export function stripWikiMapNoise(text, destination = null) {
  if (text == null || text === '') return text == null ? null : ''
  const dest = destination ? normalizeLoose(destination) : ''
  const rawLines = String(text).split('\n')
  const placePrefixes = rawLines.map(placePrefixFromStep).filter(Boolean)
  const out = []
  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i]
      .replace(/지도\s*출처\s*[:：]?\s*.*$/, '')
      .trimEnd()
    if (!line.trim() && !rawLines[i].trim()) {
      out.push('')
      continue
    }
    if (isMapSourceLine(line) || isMapSourceLine(rawLines[i])) continue
    const next = rawLines.slice(i + 1).find((l) => l.trim())
    if (next && isMapSourceLine(next) && !/^\d+\./.test(line.trim())) continue
    if (isWalkthroughMapCaption(line, dest, placePrefixes)) continue
    out.push(line)
  }
  // 끝쪽에 남은 지도 제목 한 번 더 정리
  while (out.length) {
    const last = out[out.length - 1].trim()
    if (!last) {
      out.pop()
      continue
    }
    if (isWalkthroughMapCaption(last, dest, placePrefixes)) {
      out.pop()
      continue
    }
    break
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function itemText(item) {
  return [item?.raw, item?.name, item?.category].filter(Boolean).join(' ')
}

function isLinkedHeadingItem(item) {
  const text = itemText(item)
  if (!LINKED_HEADING_RE.test(text)) return false
  if (item?.difficulty != null && item?.name && !LINKED_HEADING_RE.test(String(item.name))) {
    return false
  }
  return (
    !item?.name ||
    LINKED_HEADING_RE.test(String(item.name)) ||
    LINKED_HEADING_RE.test(String(item.raw || ''))
  )
}

function isLinkedQuestItem(item) {
  if (!item || typeof item !== 'object') return false
  if (item.relation === 'linked') return true
  return QUEST_TAG_RE.test(itemText(item))
}

function stripLinkedMeta(item) {
  const next = { ...item }
  delete next.relation
  if (typeof next.category === 'string') {
    next.category = next.category.replace(QUEST_TAG_RE, '').trim() || undefined
  }
  return next
}

/**
 * 이미 저장된 연속 퀘스트 배열에서 연결 지도/퀘스트를 분리
 * @param {unknown} items
 */
export function splitChainAndLinked(items) {
  const chainQuests = []
  const linkedQuests = []
  let inLinked = false
  for (const item of Array.isArray(items) ? items : []) {
    if (isLinkedHeadingItem(item)) {
      inLinked = true
      continue
    }
    if (isLinkedQuestItem(item)) {
      inLinked = true
      linkedQuests.push(stripLinkedMeta(item))
      continue
    }
    if (inLinked) {
      linkedQuests.push(stripLinkedMeta(item))
      continue
    }
    chainQuests.push(item)
  }
  return { chainQuests, linkedQuests }
}

function isLinkedSectionStart(line) {
  const t = String(line || '').trim()
  return LINKED_HEADING_RE.test(t) || QUEST_TAG_RE.test(t)
}

function lineAfterLinkedHeading(line) {
  const t = String(line || '').trim()
  const cut = t.replace(/^.*?연결\s*지도[^\t|]*[\t:：]?\s*/, '').trim()
  if (cut && cut !== t && (looksLikeChainEntry(cut) || QUEST_TAG_RE.test(cut))) {
    return cut
  }
  return ''
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
    if (isMapSourceLine(line)) continue
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
  /** @type {Array<Record<string, unknown>>} */
  let linkedQuests = []
  /** 번호(1. 2. …) 있는 연속 퀘스트를 본 적 있는지 — 이후 번호 없는 줄은 연결 지도로 본다 */
  let chainSawNumbered = false
  /** @type {string[]} */
  const walkthroughLines = []
  /** @type {string[]} */
  const progressLines = []

  let mode = 'meta'
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^[\uFEFF\u200B\u200C\u200D]+/, '').trim()
    if (!line) {
      if (mode === 'walkthrough' || mode === 'progress') {
        if (mode === 'walkthrough') walkthroughLines.push('')
        else progressLines.push('')
      }
      continue
    }

    if (isMapSourceLine(line)) continue

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

    // 일반: 의뢰 장소 … 목적지 …
    // 크로노: 크로노 퀘스트 … 의뢰 장소 …
    //         목적지 … 발견물 …
    if (
      mode === 'meta' &&
      (/의뢰\s*장소/.test(line) ||
        /목적지/.test(line) ||
        /발견물/.test(line) ||
        /크로노\s*퀘스트/.test(line))
    ) {
      const meta = {
        requestPlaces,
        destination,
        questType,
        discoveryCategory,
        discoveryRank,
        discoveryName,
      }
      applyQuestMetaLabels(line, meta)
      requestPlaces = meta.requestPlaces
      destination = meta.destination
      questType = meta.questType
      discoveryCategory = meta.discoveryCategory
      discoveryRank = meta.discoveryRank
      discoveryName = meta.discoveryName
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
      const rest = line.replace(/^연속\s*퀘스트\s*[\t:：]?\s*/, '').trim()
      if (rest && looksLikeChainEntry(rest)) {
        if (/^\d+\.\s*/.test(rest)) chainSawNumbered = true
        chainQuests.push(parseChainLine(rest))
      }
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

    if (mode === 'linked') {
      if (/^공략/.test(line) || /^진행/.test(line)) {
        i -= 1
        mode = 'meta'
        continue
      }
      const rest = lineAfterLinkedHeading(line) || line
      if (looksLikeChainEntry(rest) || QUEST_TAG_RE.test(rest)) {
        linkedQuests.push(parseChainLine(rest))
      }
      continue
    }

    if (mode === 'chain') {
      if (isLinkedSectionStart(line)) {
        mode = 'linked'
        const rest = lineAfterLinkedHeading(line) || line
        if (looksLikeChainEntry(rest) || QUEST_TAG_RE.test(rest)) {
          linkedQuests.push(parseChainLine(rest))
        }
        continue
      }
      const numbered = /^\d+\.\s*/.test(line)
      if (numbered) chainSawNumbered = true
      // 번호 목록 뒤에 오는 번호 없는 항목 = 연결 지도 퀘스트
      if (!numbered && chainSawNumbered && looksLikeChainEntry(line)) {
        mode = 'linked'
        linkedQuests.push(parseChainLine(line))
        continue
      }
      if (!looksLikeChainEntry(line) && !numbered) {
        continue
      }
      chainQuests.push(parseChainLine(line))
      continue
    }

    if (mode === 'walkthrough') {
      if (/^진행/.test(line)) {
        i -= 1
        mode = 'meta'
        continue
      }
      // 위키 지도 위젯/출처 잡음 제거
      if (
        line === '×' ||
        line === '+' ||
        line === '-' ||
        isMapSourceLine(line) ||
        /^[\d,\s]+$/.test(line)
      ) {
        continue
      }
      const nextLine = lines
        .slice(i + 1)
        .map((l) => l.replace(/^[\uFEFF\u200B\u200C\u200D]+/, '').trim())
        .find(Boolean)
      if (nextLine && isMapSourceLine(nextLine) && !/^\d+\./.test(line)) {
        continue
      }
      const prefixes = [
        ...walkthroughLines.map(placePrefixFromStep),
        placePrefixFromStep(line),
      ].filter(Boolean)
      if (isWalkthroughMapCaption(line, destination, prefixes)) {
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
    description: stripWikiMapNoise(description) || null,
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
    linkedQuests,
    walkthrough:
      stripWikiMapNoise(
        cleanWalkthrough(walkthroughLines.join('\n')),
        destination,
      ) || null,
    progress: stripWikiMapNoise(progressLines.join('\n'), destination) || null,
  }
}

function cleanWalkthrough(text) {
  return String(text || '')
    .replace(/\n×\n[\d,\s]+(?:\n\+)?(?:\n-)?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeLoose(s) {
  return s.trim().replace(/\s+/g, ' ')
}
