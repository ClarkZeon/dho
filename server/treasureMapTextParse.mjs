/**
 * 위키형 보물지도 텍스트.
 * 지도 출처·지도이름 출처는 버린다.
 */

import { createHash } from 'node:crypto'

const SECTION_KEYS = new Set([
  '분류',
  '서고',
  '학문 분야',
  '학문분야',
  '목적지',
  '발견물',
  '필요',
  '보상',
  '연결 지도/퀘스트',
  '연결지도/퀘스트',
  '공략',
  '설명',
  '추가 이름',
  '스킬',
  '경험치',
  '아이템',
  '두캇',
  '도시',
])

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `map-${hash}`
}

function splitCols(line) {
  if (line.includes('\t')) return line.split('\t').map((s) => s.trim())
  return [line.trim()]
}

function parseHeader(line) {
  const t = String(line || '').trim()
  const pipe = t.match(/^(보물지도|지도)\s*[|｜]\s*(.+)$/)
  if (pipe) return { mapKind: '보물지도', name: pipe[2].trim() }
  const cols = splitCols(t)
  if (cols[0] === '보물지도' || cols[0] === '지도') {
    return { mapKind: '보물지도', name: cols.slice(1).join(' ').trim() }
  }
  if (t.startsWith('보물지도')) {
    return { mapKind: '보물지도', name: t.slice('보물지도'.length).trim() }
  }
  return { mapKind: '보물지도', name: t }
}

function isSourceLine(line) {
  return /^지도\s*(이름\s*)?출처/.test(line.trim())
}

function parseDestination(raw) {
  const t = String(raw || '')
    .replace(/\s*(?:→|->)\s*/g, '  ')
    .trim()
  if (!t) return { city: null, place: null }
  const parts = t.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { city: parts[0], place: parts.slice(1).join(' ') }
  }
  return { city: null, place: t }
}

function parseDiscovery(raw) {
  const t = String(raw || '').trim()
  if (!t) return null
  const m = t.match(/^\[([^\]]+)\]\s*(?:★\s*)?(\d+)?\s*(.*)$/)
  if (!m) return { category: null, rank: null, name: t }
  return {
    category: m[1].trim() || null,
    rank: m[2] ? Number(m[2]) : null,
    name: (m[3] || '').trim(),
  }
}

function parseSkills(raw) {
  return String(raw || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.*?)(?:\s+|랭크\s*)(\d+)$/)
      if (!m) return { name: part, rank: null }
      return { name: m[1].trim(), rank: Number(m[2]) }
    })
    .filter((row) => row.name)
}

function parseNumber(raw) {
  const m = String(raw || '').match(/([\d,]+)/)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseExp(raw) {
  const text = String(raw || '')
  const discovery = text.match(/발견\s*경험치\s*[:：]?\s*([\d,]+)/)
  const card = text.match(/카드\s*획득\s*경험치\s*[:：]?\s*([\d,]+)/)
  return {
    discoveryExp: discovery ? parseNumber(discovery[1]) : null,
    cardExp: card ? parseNumber(card[1]) : null,
  }
}

function parseItem(raw) {
  const t = String(raw || '').trim()
  if (!t) return null
  const m = t.match(/^(.*?)(?:\s+(\d+))?$/)
  if (!m) return null
  const name = m[1].trim()
  if (!name) return null
  return { name, count: m[2] ? Number(m[2]) : 1 }
}

function parseLink(raw) {
  const t = String(raw || '').trim()
  if (!t || isSourceLine(t)) return null
  const m = t.match(/^\[([^\]]+)\]\s*(.*)$/)
  return {
    tag: m ? m[1].trim() : null,
    title: (m ? m[2] : t).trim(),
    raw: t,
  }
}

function isSectionStart(line) {
  const cols = splitCols(line)
  return SECTION_KEYS.has(cols[0])
}

/**
 * @param {string} text
 */
export function parseTreasureMapText(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').replace(/[ \t]+$/g, ''))

  let i = 0
  while (i < lines.length && !lines[i].trim()) i++
  if (i >= lines.length) throw new Error('지도 텍스트가 비어 있습니다.')

  const header = parseHeader(lines[i].trim())
  i++
  if (!header.name) throw new Error('지도 이름이 없습니다.')

  const descLines = []
  while (i < lines.length) {
    const t = lines[i].trim()
    if (!t) {
      i++
      if (descLines.length) break
      continue
    }
    if (isSectionStart(t) || isSourceLine(t)) break
    descLines.push(t)
    i++
  }

  let category = null
  /** @type {string[]} */
  const libraries = []
  let academicField = null
  let destinationCity = null
  let destination = null
  /** @type {ReturnType<typeof parseDiscovery>[]} */
  const discoveries = []
  /** @type {ReturnType<typeof parseSkills>} */
  const skillReqs = []
  let discoveryExp = null
  let cardExp = null
  let ducat = null
  /** @type {NonNullable<ReturnType<typeof parseItem>>[]} */
  const rewardItems = []
  /** @type {NonNullable<ReturnType<typeof parseLink>>[]} */
  const linkedQuests = []
  const walkLines = []
  let altName = null
  let mode = ''

  function applyPair(key, value) {
    const v = String(value || '').trim()
    if (key === '분류' && v) category = v
    else if (key === '서고' && v) {
      for (const name of v.split(/[,，]/).map((s) => s.trim()).filter(Boolean)) {
        if (!libraries.includes(name)) libraries.push(name)
      }
    } else if ((key === '학문 분야' || key === '학문분야') && v) {
      academicField = v
    } else if (key === '목적지' && v) {
      const dest = parseDestination(v)
      destinationCity = dest.city
      destination = dest.place
    } else if (key === '발견물' && v) {
      const row = parseDiscovery(v)
      if (row?.name) discoveries.push(row)
    } else if (key === '추가 이름' && v) altName = v
    else if (key === '설명' && v) descLines.push(v)
    else if (key === '스킬' && v) skillReqs.push(...parseSkills(v))
    else if (key === '경험치' && v) {
      const exp = parseExp(v)
      if (exp.discoveryExp != null) discoveryExp = exp.discoveryExp
      if (exp.cardExp != null) cardExp = exp.cardExp
      if (discoveryExp == null && cardExp == null) {
        discoveryExp = parseNumber(v)
      }
    } else if (key === '두캇' && v) ducat = parseNumber(v)
    else if (key === '아이템' && v) {
      const item = parseItem(v)
      if (item) rewardItems.push(item)
    } else if (key === '공략' && v) walkLines.push(v)
    else if (
      (key === '연결 지도/퀘스트' || key === '연결지도/퀘스트') &&
      v
    ) {
      const link = parseLink(v)
      if (link) linkedQuests.push(link)
    }
  }

  function consumePairs(cols) {
    let k = 0
    while (k < cols.length) {
      const key = cols[k]
      if (!key) {
        k++
        continue
      }
      if (key === '종류' || key === '내용') {
        k++
        continue
      }
      if (!SECTION_KEYS.has(key)) {
        if (mode === 'linked') {
          const link = parseLink(cols.slice(k).join(' '))
          if (link) linkedQuests.push(link)
        } else if (mode === 'walk') {
          walkLines.push(cols.slice(k).join(' '))
        }
        break
      }
      if (
        key === '필요' ||
        key === '보상' ||
        key === '연결 지도/퀘스트' ||
        key === '연결지도/퀘스트' ||
        key === '공략'
      ) {
        if (key === '필요') mode = 'need'
        else if (key === '보상') mode = 'reward'
        else if (key.startsWith('연결')) mode = 'linked'
        else mode = 'walk'
        const rest = cols.slice(k + 1).filter(Boolean)
        if (rest.length && SECTION_KEYS.has(rest[0])) {
          k++
          continue
        }
        if (rest.length) applyPair(key, rest.join(' '))
        break
      }
      const next = cols[k + 1]
      const after = cols[k + 2]
      if (
        next &&
        SECTION_KEYS.has(next) &&
        after &&
        SECTION_KEYS.has(after)
      ) {
        applyPair(key, next)
        k += 2
        continue
      }
      const valueParts = []
      let n = k + 1
      while (n < cols.length && !SECTION_KEYS.has(cols[n])) {
        if (cols[n]) valueParts.push(cols[n])
        n++
      }
      applyPair(key, valueParts.join(' '))
      k = n
    }
  }

  while (i < lines.length) {
    const raw = lines[i]
    const t = raw.trim()
    i++
    if (!t || isSourceLine(t)) continue
    if (t === '종류' || /^종류\t+내용/.test(t)) continue

    const cols = splitCols(t)
    if (SECTION_KEYS.has(cols[0])) {
      consumePairs(cols)
      continue
    }
    if (mode === 'linked') {
      const link = parseLink(t)
      if (link) linkedQuests.push(link)
      continue
    }
    if (mode === 'walk') {
      walkLines.push(t)
      continue
    }
    if (mode === 'need' && !t.startsWith('종류')) {
      skillReqs.push(...parseSkills(t))
    }
  }

  const place = destination
  const walkthrough =
    walkLines
      .map((line) => line.trim())
      .filter((line) => line && !isSourceLine(line))
      .filter((line) => !(place && line === place))
      .join('\n')
      .trim() || null

  return {
    slug: slugify(header.name),
    name: header.name,
    altName,
    mapKind: header.mapKind,
    description: descLines.join('\n').trim() || null,
    category,
    libraries,
    academicField,
    destinationCity,
    destination,
    discoveries,
    skillReqs,
    discoveryExp,
    cardExp,
    ducat,
    rewardItems,
    linkedQuests,
    walkthrough,
  }
}
