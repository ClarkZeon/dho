/**
 * 위키형 항구(도시) 텍스트 → DB용 객체
 *
 * 도시캘리컷
 * 분류	동맹항	지역	아프리카 동부-인도
 * …
 * 보상 / 연결된 장소 / 도시 인물 / 생산 / 목적지 / 판매 아이템
 */

import { createHash } from 'node:crypto'

const PRODUCTION_TABS = [
  '장식품 제작',
  '고정 레시피 책',
  '일반 건조',
  '특수 건조',
]

const DEST_TABS = ['보물지도', '퀘스트']

const SALE_VENDORS = [
  '교역소주인',
  '대장장이',
  '도구점 주인',
  '무기장인',
  '번역가',
  '제재소장인',
  '조각가',
  '조선소주인',
  '판매원',
  '행상인',
]

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `port-${hash}`
}

function splitTabs(line) {
  return line.split('\t').map((s) => s.trim())
}

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

const META_LABELS = [
  { key: 'category', re: /분류/ },
  { key: 'region', re: /지역/ },
  { key: 'seaArea', re: /해역/ },
  { key: 'coordinates', re: /좌표/ },
  { key: 'entryPermit', re: /입항\s*허가/ },
  { key: 'culture', re: /문화(?:권)?/ },
  { key: 'language', re: /언어/ },
  { key: 'facilities', re: /시설/ },
  { key: 'flagQuest', re: /플래그\s*퀘스트/ },
  { key: 'altName', re: /추가\s*이름/ },
]

function isExactMetaLabel(label) {
  const t = String(label || '').trim()
  return /^(분류|지역|해역|좌표|입항\s*허가|문화(?:권)?|언어|시설|플래그\s*퀘스트|추가\s*이름)$/.test(
    t,
  )
}

function parseCoordinates(text) {
  const m = String(text || '').match(/(-?\d+)\s*[,，]\s*(-?\d+)/)
  if (!m) return { coordX: null, coordY: null }
  return { coordX: Number(m[1]), coordY: Number(m[2]) }
}

function applyMetaLine(line, fields) {
  const cols = splitTabs(line)
  if (cols.length >= 2) {
    for (let c = 0; c < cols.length - 1; c++) {
      const label = cols[c]
      const value = (cols[c + 1] || '').trim()
      if (!value) continue
      if (!isExactMetaLabel(label)) continue
      for (const meta of META_LABELS) {
        if (meta.re.test(label)) {
          fields[meta.key] = value
          break
        }
      }
    }
  }
  const stopLabels = META_LABELS.map((m) => m.re)
  for (const meta of META_LABELS) {
    const v = pickLabeledValue(
      line,
      meta.re,
      stopLabels.filter((r) => r !== meta.re),
    )
    if (v) fields[meta.key] = v
  }
}

function matchKnownTab(line, tabs) {
  const t = String(line || '').trim()
  if (!t) return null
  if (tabs.includes(t)) return t
  // 탭이 붙어서 온 경우: 장식품 제작고정 레시피 책…
  for (const tab of tabs) {
    if (t === tab || t.startsWith(tab)) return tab
  }
  return null
}

function splitPackedTabs(line, tabs) {
  let rest = String(line || '').trim()
  const found = []
  // 긴 이름 우선
  const ordered = [...tabs].sort((a, b) => b.length - a.length)
  while (rest) {
    let hit = null
    for (const tab of ordered) {
      if (rest.startsWith(tab)) {
        hit = tab
        break
      }
    }
    if (!hit) break
    found.push(hit)
    rest = rest.slice(hit.length).trim()
  }
  return found
}

function emptyCell(v) {
  const t = String(v || '').trim()
  return t ? t : null
}

/**
 * @param {string} text
 */
export function parsePortText(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!raw) throw new Error('텍스트가 비어 있습니다.')

  const lines = raw.split('\n').map((l) => l.trimEnd())

  let name = ''
  let nameIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    name = line
      .replace(/^(항구|도시)\s*[|｜]?\s*/, '')
      .replace(/^(항구|도시)\s*/, '')
      .trim()
    nameIdx = i
    break
  }
  name = name.replace(/\s+/g, ' ')
  if (!name) throw new Error('항구(도시) 이름을 찾지 못했습니다.')

  /** @type {Record<string, string|null>} */
  const fields = {
    category: null,
    region: null,
    seaArea: null,
    coordinates: null,
    entryPermit: null,
    culture: null,
    language: null,
    facilities: null,
    flagQuest: null,
    altName: null,
  }

  let description = ''
  /** @type {Array<{ kind: string, amount: string, reward: string }>} */
  const rewards = []
  /** @type {Array<{ source: string, name: string, rank: number|null, type: string|null, recommendSpot: string|null, canExchange: boolean|null, canRelease: boolean|null }>} */
  const collectItems = []
  /** @type {Array<{ kind: string, content: string }>} */
  const linkedPlaces = []
  /** @type {Array<{ name: string, preferredReport: string|null, skills: string|null, tarot: string|null }>} */
  const characters = []
  /** @type {Array<{ tab: string, maker: string, items: string }>} */
  const productions = []
  /** @type {Array<{ source: string, discovery: string, content: string }>} */
  const destinations = []
  /** @type {Array<{ vendor: string, category: string, item: string, development: string|null, investment: string|null, contribution: string|null, capital: string|null, era: string|null, price: string|null }>} */
  const saleItems = []

  let mode = 'meta'
  let collectSource = null
  let productionTab = PRODUCTION_TABS[0]
  let destSource = DEST_TABS[0]
  let saleVendor = SALE_VENDORS[0]

  for (let i = nameIdx + 1; i < lines.length; i++) {
    const line = lines[i].replace(/^[\uFEFF\u200B\u200C\u200D]+/, '').trim()
    if (!line) continue

    if (/^보상$/.test(line)) {
      mode = 'reward'
      continue
    }
    if (/^연결된\s*장소/.test(line)) {
      mode = 'linked'
      continue
    }
    if (/^도시\s*인물$/.test(line)) {
      mode = 'character'
      continue
    }
    if (/^생산$/.test(line)) {
      mode = 'production'
      productionTab = PRODUCTION_TABS[0]
      continue
    }
    if (/^목적지$/.test(line)) {
      mode = 'dest'
      destSource = DEST_TABS[0]
      continue
    }
    if (/^판매\s*아이템/.test(line)) {
      mode = 'sale'
      saleVendor = SALE_VENDORS[0]
      continue
    }
    if (/^수집\s*아이템/.test(line)) {
      mode = 'collect'
      collectSource = null
      continue
    }
    if (/^(탐색|낚시|채집|조달)$/.test(line) && mode === 'collect') {
      collectSource = line
      continue
    }

    if (mode === 'reward') {
      if (/^종류(\t|$)/.test(line) && /금액|보상/.test(line)) continue
      const cols = splitTabs(line)
      if (cols.length >= 3 && cols[0] && cols[0] !== '종류') {
        rewards.push({
          kind: cols[0],
          amount: cols[1] || '',
          reward: cols.slice(2).join('\t').trim(),
        })
      }
      continue
    }

    if (mode === 'linked') {
      if (/^종류(\t|$)/.test(line) && /내용/.test(line)) continue
      const cols = splitTabs(line)
      if (cols.length >= 2 && cols[0] && !/^(종류|내용)$/.test(cols[0])) {
        linkedPlaces.push({
          kind: cols[0],
          content: cols.slice(1).join('\t').trim(),
        })
      }
      continue
    }

    if (mode === 'character') {
      if (/^도시\s*인물(\t|$)/.test(line) && /우대|스킬|타로/.test(line)) {
        continue
      }
      const cols = splitTabs(line)
      if (cols.length >= 1 && cols[0] && cols[0] !== '도시 인물') {
        characters.push({
          name: cols[0],
          preferredReport: emptyCell(cols[1]),
          skills: emptyCell(cols[2]),
          tarot: emptyCell(cols[3]),
        })
      }
      continue
    }

    if (mode === 'production') {
      const packed = splitPackedTabs(line, PRODUCTION_TABS)
      if (packed.length >= 2 && !line.includes('\t')) {
        productionTab = packed[0]
        continue
      }
      const tabOnly = matchKnownTab(line, PRODUCTION_TABS)
      if (tabOnly && (line === tabOnly || packed.length === 1)) {
        productionTab = tabOnly
        continue
      }
      if (/^제작자(\t|$)/.test(line)) continue
      const cols = splitTabs(line)
      if (cols.length >= 2 && cols[0] && cols[0] !== '제작자') {
        productions.push({
          tab: productionTab,
          maker: cols[0],
          items: cols.slice(1).join('\t').trim(),
        })
      }
      continue
    }

    if (mode === 'dest') {
      const packed = splitPackedTabs(line, DEST_TABS)
      if (packed.length >= 2 && !line.includes('\t')) {
        destSource = packed[0]
        continue
      }
      const tabOnly = matchKnownTab(line, DEST_TABS)
      if (tabOnly && (line === tabOnly || packed.length === 1) && !line.includes('\t')) {
        destSource = tabOnly
        continue
      }
      if (/^발견물(\t|$)/.test(line) && /내용/.test(line)) continue
      const cols = splitTabs(line)
      if (cols.length >= 2 && cols[0] && cols[0] !== '발견물') {
        destinations.push({
          source: destSource,
          discovery: cols[0],
          content: cols.slice(1).join('\t').trim(),
        })
      }
      continue
    }

    if (mode === 'sale') {
      const packed = splitPackedTabs(line, SALE_VENDORS)
      if (packed.length >= 2 && !line.includes('\t')) {
        saleVendor = packed[0]
        continue
      }
      if (SALE_VENDORS.includes(line)) {
        saleVendor = line
        continue
      }
      if (/^분류(\t|$)/.test(line) && /아이템|가격/.test(line)) continue
      const cols = splitTabs(line)
      // 단독 벤더 소제목 반복
      if (cols.length === 1 && SALE_VENDORS.includes(cols[0])) {
        saleVendor = cols[0]
        continue
      }
      if (cols.length >= 2 && cols[0] && cols[0] !== '분류') {
        saleItems.push({
          vendor: saleVendor,
          category: cols[0] || '',
          item: cols[1] || '',
          development: emptyCell(cols[2]),
          investment: emptyCell(cols[3]),
          contribution: emptyCell(cols[4]),
          capital: emptyCell(cols[5]),
          era: emptyCell(cols[6]),
          price: emptyCell(cols[7]),
        })
      }
      continue
    }

    if (mode === 'collect') {
      if (/^랭크(\t|$)/.test(line)) continue
      const cols = splitTabs(line)
      if (cols.length === 1 && !/^\d+$/.test(cols[0])) {
        collectSource = cols[0]
        continue
      }
      // 신형: 이름 / 랭크 / 추천지점 …
      if (cols.length >= 2 && !/^\d+$/.test(cols[0])) {
        collectItems.push({
          source: collectSource || '탐색',
          name: cols[0],
          rank: cols[1] && /^\d+$/.test(cols[1]) ? Number(cols[1]) : null,
          type: null,
          recommendSpot: emptyCell(cols[2]),
          canExchange: null,
          canRelease: null,
        })
        continue
      }
      // 구형: 랭크 / 종류 / 아이템
      if (cols.length >= 3 && /^\d+$/.test(cols[0])) {
        collectItems.push({
          source: collectSource || '기타',
          name: cols.slice(2).join('\t').trim(),
          rank: Number(cols[0]),
          type: cols[1] || null,
          recommendSpot: null,
          canExchange: null,
          canRelease: null,
        })
      }
      continue
    }

    // meta
    const looksLabeled =
      META_LABELS.some((m) => m.re.test(splitTabs(line)[0] || '')) ||
      /분류|지역|해역|좌표|입항\s*허가|문화|언어|시설|플래그\s*퀘스트/.test(
        line,
      )

    if (looksLabeled) {
      applyMetaLine(line, fields)
      continue
    }

    if (!fields.category && !fields.seaArea) {
      description = description ? `${description}\n${line}` : line
    }
  }

  const { coordX, coordY } = parseCoordinates(fields.coordinates)

  return {
    name,
    slug: slugify(name),
    altName: fields.altName,
    description: description || null,
    category: fields.category,
    region: fields.region,
    seaArea: fields.seaArea,
    coordX,
    coordY,
    entryPermit: fields.entryPermit,
    culture: fields.culture,
    language: fields.language,
    facilities: fields.facilities,
    flagQuest: fields.flagQuest,
    rewards,
    collectItems,
    linkedPlaces,
    characters,
    productions,
    destinations,
    saleItems,
  }
}

export { PRODUCTION_TABS, DEST_TABS, SALE_VENDORS }
