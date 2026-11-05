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

const DEST_SEP = /\s*(?:»|>>|›|→|➜|➔|⟶|⇒|->)\s*/

/**
 * `리마 >> 리마 북동쪽` / `런던 → 옥스포드 → 옥스포드 주점`
 * / 구분자 빠진 `런던 옥스포드 옥스포드 주점` → `런던 » 옥스포드 » 옥스포드 주점`
 */
function normalizeQuestDestination(raw) {
  const text = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!text) return null

  const segments = text
    .split(DEST_SEP)
    .map((s) => s.trim())
    .filter(Boolean)
  if (segments.length >= 2) {
    return segments.join(' » ')
  }

  const parts = text.split(' ').filter(Boolean)
  // `런던 옥스포드 옥스포드 주점` — 동일 토큰 연속 = 마지막 도시·육지 머리
  // cities: [런던, 옥스포드], place: `옥스포드 주점`
  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i] !== parts[i + 1]) continue
    const cities = parts.slice(0, i + 1)
    const place = [parts[i], ...parts.slice(i + 2)].join(' ')
    if (cities.length && place) {
      return [...cities, place].join(' » ')
    }
  }
  // `리마 리마 북동쪽` / `산토 도밍고 산토 도밍고 외곽`
  for (let i = 1; i < parts.length; i++) {
    const city = parts.slice(0, i).join(' ')
    const place = parts.slice(i).join(' ')
    if (place === city || place.startsWith(`${city} `)) {
      return `${city} » ${place}`
    }
  }
  return text
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
    /특징/,
    /난이도/,
  ])
  if (places) state.requestPlaces = places

  const dest = pickLabeledValue(line, /목적지/, [
    /발견물/,
    /의뢰\s*장소/,
    /크로노\s*퀘스트/,
    /특징/,
  ])
  if (dest) state.destination = normalizeQuestDestination(dest)

  // 크로노·특징은 분류(questType)와 별도 — 붙이지 않음
  const chrono = pickLabeledValue(line, /크로노\s*퀘스트/, [
    /특징/,
    /의뢰\s*장소/,
    /목적지/,
    /발견물/,
    /난이도/,
  ])
  if (chrono) state.chronoQuest = chrono

  const feature = pickLabeledValue(line, /특징/, [
    /크로노\s*퀘스트/,
    /의뢰\s*장소/,
    /목적지/,
    /발견물/,
    /난이도/,
  ])
  if (feature) state.feature = feature

  const disc = pickLabeledValue(line, /발견물/, [
    /목적지/,
    /의뢰\s*장소/,
    /크로노\s*퀘스트/,
    /특징/,
  ])
  if (disc) {
    // [대형생물] 5성 비단뱀  /  [화석] 3 목이 긴 …
    const withSeong = disc.match(/\[([^\]]+)\]\s*(\d+)\s*성\s+(.+)/)
    const plain = disc.match(/\[([^\]]+)\]\s*(\d+)\s+(.+)/)
    const m = withSeong || plain
    if (m) {
      state.discoveryCategory = m[1].trim()
      state.discoveryRank = Number(m[2])
      state.discoveryName = m[3].replace(/^성\s+/, '').trim()
    } else {
      state.discoveryName = disc
    }
  }
}

/**
 * 위키는 「종교학 2」와 라벨 「추가」가 별도.
 * 복붙 시 공백이 빠져 `종교학 2추가 : 프랑스어 1`처럼 보여도
 * main=`종교학 2`, extra=`프랑스어 1` 로 나눈다.
 */
function splitMainAndExtraSkills(raw) {
  const text = String(raw || '').trim()
  if (!text) return { main: '', extra: '' }
  // "종교학 2" + "추가" + "프랑스어 1" (공백 유무 모두)
  const afterLevel = text.match(
    /^(.*?)\s+(\d+)\s*추가\s*(?:\([^)]*\)|[?？])?\s*[:：]?\s*(.+)$/u,
  )
  if (afterLevel) {
    return {
      main: `${afterLevel[1].trim()} ${afterLevel[2]}`.trim(),
      extra: afterLevel[3].trim(),
    }
  }
  const m = text.match(
    /^(.*?)(?:\s+추가\s*(?:\([^)]*\)|[?？])?\s*[:：]?\s*)(.+)$/u,
  )
  if (m) {
    return { main: m[1].trim(), extra: m[2].trim() }
  }
  return { main: text, extra: '' }
}

function parseSkillAtom(part) {
  let cleaned = String(part || '')
    .replace(/^추가\s*(?:\([^)]*\)|[?？])?\s*[:：]?\s*/u, '')
    .trim()
  if (!cleaned || /^추가(?:\s*[?？])?$/.test(cleaned)) return null
  // 위키 전문 표기: `생태 조사 1*` → 이름 + 레벨, `*` 는 저장하지 않음
  const withStar = cleaned.match(/^(.+?)\s+(\d+)\s*\*+\s*$/u)
  if (withStar) {
    return { name: withStar[1].trim(), level: Number(withStar[2]) }
  }
  cleaned = cleaned.replace(/\*+\s*$/u, '').trim()
  if (!cleaned) return null
  const m = cleaned.match(/^(.+?)\s+(\d+)\s*$/)
  if (!m) return { name: cleaned, level: null }
  return { name: m[1].trim(), level: Number(m[2]) }
}

function parseSkillList(text) {
  // 생태 조사 1, 생물학 3, 스와힐리어 1
  /** @type {Array<{ name: string, level: number|null }>} */
  const out = []
  for (const part of String(text || '').split(/[,，]/)) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const split = splitMainAndExtraSkills(trimmed)
    if (split.extra) {
      const mainSkill = parseSkillAtom(split.main)
      if (mainSkill) out.push(mainSkill)
      for (const extraPart of split.extra.split(/[,，]/)) {
        const extraSkill = parseSkillAtom(extraPart)
        if (extraSkill) out.push(extraSkill)
      }
      continue
    }
    const skill = parseSkillAtom(trimmed)
    if (skill) out.push(skill)
  }
  return out
}

/**
 * 잘못 저장된 「종교학 2추가 : 프랑스어」(level=1) →
 * [{종교학,2},{프랑스어,1}]  (「추가」는 구분 라벨일 뿐 스킬명 아님)
 * @param {Array<{ name?: string, level?: number|null }>|null|undefined} skills
 */
export function normalizeQuestSkills(skills) {
  /** @type {Array<{ name: string, level: number|null }>} */
  const out = []
  for (const skill of skills || []) {
    const name = String(skill?.name || '').trim()
    let level =
      skill?.level == null || skill?.level === ''
        ? null
        : Number(skill.level)
    if (!Number.isFinite(level)) level = null
    if (!name) continue

    const glued = name.match(
      /^(.*?)\s+(\d+)\s*추가\s*(?:\([^)]*\)|[?？])?\s*[:：]?\s*(.+)$/u,
    )
    if (glued) {
      out.push({ name: glued[1].trim(), level: Number(glued[2]) })
      const extras = parseSkillList(glued[3])
      if (!extras.length) {
        const rest = glued[3].trim()
        if (rest) out.push({ name: rest, level })
      } else {
        extras.forEach((item, idx) => {
          if (idx === extras.length - 1 && item.level == null && level != null) {
            out.push({ ...item, level })
          } else {
            out.push(item)
          }
        })
      }
      continue
    }

    out.push({ name, level })
  }
  return out
}

/** 스킬 행 탭 컬럼 → 본문+추가 스킬 합침 */
function parseSkillRowCols(cols) {
  const cells = (cols || []).map((c) => String(c || '').trim())
  if (!cells.length || cells[0] !== '스킬') return []
  const addIdx = cells.findIndex((c, i) => i > 0 && c === '추가')
  let main = ''
  let extra = ''
  if (addIdx > 0) {
    main = cells.slice(1, addIdx).join(' ').trim()
    extra = cells
      .slice(addIdx + 1)
      .filter((c) => c && c !== ':' && c !== '：' && c !== '?' && c !== '？')
      .join(' ')
      .trim()
  } else {
    const split = splitMainAndExtraSkills(cells.slice(1).join('\t'))
    main = split.main
    extra = split.extra
  }
  return normalizeQuestSkills([
    ...parseSkillList(main),
    ...parseSkillList(extra),
  ])
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

/** 연결 지도/퀘스트 줄 — [퀘스트] 있으면 quest, 없으면 map. raw에 태그 보존 */
function parseLinkedChainLine(line) {
  const raw = String(line || '').trim()
  const linkKind = QUEST_TAG_RE.test(raw) ? 'quest' : 'map'
  return { ...parseChainLine(raw), linkKind, raw }
}

function looksLikeChainEntry(line) {
  return /\|/.test(line) && /\([⭐★*]?\s*\d+/.test(line)
}

/**
 * 선행 발견/퀘스트 한 줄
 * [화석] 1 목이 긴 도마뱀의 뼈 <도마뱀뼈의 지도 …>
 * 모험 | 이상한 드래곤 (6 …) - 런던, …
 */
export function parsePrerequisiteLine(line) {
  const raw = String(line || '').trim()
  if (!raw) return null

  const disc = raw.match(
    /^\[([^\]]+)\]\s*(\d+)\s*(?:성\s+)?(.+?)(?:\s*<\s*(.+?)\s*>\s*)?$/,
  )
  if (disc) {
    return {
      kind: 'discovery',
      raw,
      discoveryCategory: disc[1].trim(),
      discoveryRank: Number(disc[2]),
      discoveryName: disc[3].trim(),
      nested: disc[4] ? disc[4].trim() : null,
      children: [],
    }
  }

  if (looksLikeChainEntry(raw) || QUEST_TAG_RE.test(raw)) {
    const parsed = parseChainLine(raw)
    return {
      kind: 'quest',
      raw,
      ...parsed,
    }
  }

  return { kind: 'other', raw }
}

/**
 * 평탄 목록 → 발견물 아래 퀘스트 중첩.
 * 이미 children 이 있는 항목은 유지하고, 뒤에 오는 quest/other 만 붙인다.
 */
export function nestPrerequisiteItems(items) {
  if (!Array.isArray(items) || !items.length) return []
  /** @type {Array<Record<string, unknown>>} */
  const out = []
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue
    const item = { ...raw }
    if (item.kind === 'discovery') {
      const kids = Array.isArray(item.children)
        ? item.children.map((c) => ({ ...c }))
        : []
      out.push({ ...item, children: kids })
      continue
    }
    const last = out[out.length - 1]
    if (last && last.kind === 'discovery') {
      if (!Array.isArray(last.children)) last.children = []
      last.children.push(item)
      continue
    }
    out.push(item)
  }
  return out
}

/** @param {Array<Record<string, unknown>>} list */
function pushPrerequisite(list, item) {
  if (!item) return
  if (item.kind === 'discovery') {
    list.push({ ...item, children: Array.isArray(item.children) ? item.children : [] })
    return
  }
  const last = list[list.length - 1]
  if (last && last.kind === 'discovery') {
    if (!Array.isArray(last.children)) last.children = []
    last.children.push(item)
    return
  }
  list.push(item)
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

/** 목적지 전체 + `»`/`→` 단계별 지명 (지도 위젯 제목 ※ 노트) */
function destinationCaptionNames(destination) {
  const dest = normalizeLoose(destination || '')
  if (!dest) return []
  const names = new Set([dest])
  for (const part of dest.split(DEST_SEP)) {
    const p = normalizeLoose(part)
    if (p) names.add(p)
  }
  return [...names]
}

function isWalkthroughMapCaption(line, destinationNames, placePrefixes) {
  const t = normalizeLoose(line)
  if (!t) return false
  if (/^\d+\./.test(t) || /^[-–—]/.test(t) || /^[（(]/.test(t)) return false
  if (isMapSourceLine(t)) return true
  if (
    Array.isArray(destinationNames) &&
    destinationNames.some((name) => name && t === normalizeLoose(name))
  ) {
    return true
  }
  // 마지막 단계 지명과 같은 지도 위젯 제목 (캘리컷 북쪽, 홍해 서쪽 해안)
  return placePrefixes.some((p) => p && t === p)
}

/** 위키 지도 위젯 제목·출처 제거 (지도 기능 없음) */
export function stripWikiMapNoise(text, destination = null) {
  if (text == null || text === '') return text == null ? null : ''
  const destinationNames = destinationCaptionNames(destination)
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
    if (isWalkthroughMapCaption(line, destinationNames, placePrefixes)) continue
    out.push(line)
  }
  // 끝쪽에 남은 지도 제목 한 번 더 정리
  while (out.length) {
    const last = out[out.length - 1].trim()
    if (!last) {
      out.pop()
      continue
    }
    if (isWalkthroughMapCaption(last, destinationNames, placePrefixes)) {
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
  if (item.linkKind === 'quest' || item.linkKind === 'map') return true
  if (item.relation === 'linked') return true
  return QUEST_TAG_RE.test(itemText(item))
}

function stripLinkedMeta(item, fallback = 'quest') {
  const next = { ...item }
  const fromTag = QUEST_TAG_RE.test(itemText(item))
  // [퀘스트] 태그가 raw 등에 남아 있으면 무조건 퀘스트
  let linkKind
  if (fromTag) linkKind = 'quest'
  else if (next.linkKind === 'quest' || next.linkKind === 'map') {
    linkKind = next.linkKind
  } else {
    linkKind = fallback
  }
  delete next.relation
  if (typeof next.category === 'string') {
    next.category = next.category.replace(QUEST_TAG_RE, '').trim() || undefined
  }
  next.linkKind = linkKind
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
      // [퀘스트]·구데이터(relation)는 퀘스트. 명시적 linkKind:map 만 지도.
      const fallback = item?.linkKind === 'map' ? 'map' : 'quest'
      linkedQuests.push(stripLinkedMeta(item, fallback))
      continue
    }
    if (inLinked) {
      linkedQuests.push(stripLinkedMeta(item, 'map'))
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
  let chronoQuest = null
  let feature = null
  let difficulty = null
  let requestPlaces = null
  let destination = null
  let discoveryCategory = null
  let discoveryRank = null
  let discoveryName = null
  /** @type {Array<{ name: string, level: number|null }>} */
  let skills = []
  /** @type {Array<Record<string, unknown>>} */
  let prerequisites = []
  /** 필요 섹션에서 「선행 발견/퀘스트」 이후 줄 수집 */
  let collectingPrereq = false
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
    // 크로노: 크로노 퀘스트 … 특징 …
    //         의뢰 장소 … / 목적지 … 발견물 …
    if (
      mode === 'meta' &&
      (/의뢰\s*장소/.test(line) ||
        /목적지/.test(line) ||
        /발견물/.test(line) ||
        /크로노\s*퀘스트/.test(line) ||
        /특징/.test(line))
    ) {
      const meta = {
        requestPlaces,
        destination,
        chronoQuest,
        feature,
        discoveryCategory,
        discoveryRank,
        discoveryName,
      }
      applyQuestMetaLabels(line, meta)
      requestPlaces = meta.requestPlaces
      destination = meta.destination
      chronoQuest = meta.chronoQuest
      feature = meta.feature
      discoveryCategory = meta.discoveryCategory
      discoveryRank = meta.discoveryRank
      discoveryName = meta.discoveryName
      continue
    }

    if (/^필요$/.test(line)) {
      mode = 'need'
      collectingPrereq = false
      continue
    }
    if (/^보상$/.test(line)) {
      mode = 'reward'
      collectingPrereq = false
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
    // 보상/필요 뒤에 바로 오는 「연결 지도/퀘스트」(연속 퀘스트 없이도)
    if (LINKED_HEADING_RE.test(line) && !looksLikeChainEntry(line)) {
      mode = 'linked'
      const rest = lineAfterLinkedHeading(line)
      if (rest && (looksLikeChainEntry(rest) || QUEST_TAG_RE.test(rest))) {
        linkedQuests.push(parseLinkedChainLine(rest))
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

    // 헤더 없이 [퀘스트] 연결 줄 — 필요(선행) 수집 중에는 연결로 보내지 않음
    if (
      (mode === 'reward' || mode === 'meta' || (mode === 'need' && !collectingPrereq)) &&
      (QUEST_TAG_RE.test(line) || looksLikeChainEntry(line))
    ) {
      // need 모드에서 스킬 행이 아닌 퀘스트형 줄은 선행으로 취급
      if (mode === 'need') {
        collectingPrereq = true
        pushPrerequisite(prerequisites, parsePrerequisiteLine(line))
        continue
      }
      mode = 'linked'
      linkedQuests.push(parseLinkedChainLine(line))
      continue
    }

    if (mode === 'need') {
      if (/^종류\t|^종류$/.test(line)) continue
      const cols = splitTabs(line)

      if (/^선행/.test(cols[0] || '') || /^선행\s*발견/.test(line)) {
        collectingPrereq = true
        const rest =
          cols.length >= 2
            ? cols.slice(1).join('\t').trim()
            : line.replace(/^선행\s*발견\s*\/?\s*퀘스트\s*/, '').trim()
        if (rest) {
          pushPrerequisite(prerequisites, parsePrerequisiteLine(rest))
        }
        continue
      }

      if (cols[0] === '스킬' && cols[1]) {
        collectingPrereq = false
        skills = parseSkillRowCols(cols)
        continue
      }

      if (collectingPrereq) {
        // 발견물 [화석] … 또는 그 아래 붙는 퀘스트형 줄
        if (
          /^\[[^\]]+\]/.test(line) ||
          looksLikeChainEntry(line) ||
          QUEST_TAG_RE.test(line)
        ) {
          pushPrerequisite(prerequisites, parsePrerequisiteLine(line))
        } else if (line && !/^종류/.test(line) && !/^스킬/.test(line)) {
          pushPrerequisite(prerequisites, parsePrerequisiteLine(line))
        }
        continue
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
        linkedQuests.push(parseLinkedChainLine(rest))
      }
      continue
    }

    if (mode === 'chain') {
      if (isLinkedSectionStart(line)) {
        mode = 'linked'
        const rest = lineAfterLinkedHeading(line) || line
        if (looksLikeChainEntry(rest) || QUEST_TAG_RE.test(rest)) {
          linkedQuests.push(parseLinkedChainLine(rest))
        }
        continue
      }
      const numbered = /^\d+\.\s*/.test(line)
      if (numbered) chainSawNumbered = true
      // 번호 목록 뒤에 오는 번호 없는 항목 = 연결 지도 퀘스트
      if (!numbered && chainSawNumbered && looksLikeChainEntry(line)) {
        mode = 'linked'
        linkedQuests.push(parseLinkedChainLine(line))
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
    chronoQuest,
    feature,
    difficulty,
    requestPlaces,
    destination,
    discoveryCategory,
    discoveryRank,
    discoveryName,
    skills,
    prerequisites: nestPrerequisiteItems(prerequisites),
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
    // `2/3 지점` → `3분의 2지점` (슬래시 파싱 충돌 방지)
    .replace(/(\d+)\s*\/\s*(\d+)\s*지점/g, '$2분의 $1지점')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$2분의 $1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeLoose(s) {
  return s.trim().replace(/\s+/g, ' ')
}
