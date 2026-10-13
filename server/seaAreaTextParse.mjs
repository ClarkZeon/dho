/**
 * 위키형 해역 텍스트 → DB용 객체
 *
 * 해역 | 동 캐롤라인 해저분지
 * 분류	남태평양	지역	동남아시아
 * 경계	북 : 4096, 서 : 6400, 남 : 5120, 동 : 7168	파도	12
 * 조류	16	최대 속도 증가	50%
 * 해역 내 장소
 * 종류	내용
 * 도시	괌
 * 수집 아이템
 * 낚시채집애완동물
 * 랭크	종류	아이템
 * 1	교역품	정어리
 * 목적지
 * 보물지도퀘스트
 * 발견물	내용
 * [지리] 1 비스마크 제도	다 쓰여지지 않은 지도 …
 * 해상 NPC
 * 함대 수	특징	해상 NPC
 * 2	기습	표류선습격단
 */

import { createHash } from 'node:crypto'

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `sea-area-${hash}`
}

function splitTabs(line) {
  return line.split('\t').map((s) => s.trim())
}

function toNum(value) {
  if (value == null) return null
  const n = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
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
  { key: 'bounds', re: /경계/ },
  { key: 'wave', re: /파도/ },
  { key: 'current', re: /조류/ },
  { key: 'maxSpeedBonus', re: /최대\s*속도\s*증가/ },
]

function isExactMetaLabel(label) {
  const t = String(label || '').trim()
  return /^(분류|지역|경계|파도|조류|최대\s*속도\s*증가)$/.test(t)
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

function parseBounds(text) {
  const raw = String(text || '')
  const pick = (label) => {
    const m = raw.match(
      new RegExp(`${label}\\s*[:：]?\\s*(-?\\d+)`, 'u'),
    )
    return m ? Number(m[1]) : null
  }
  return {
    boundNorth: pick('북'),
    boundWest: pick('서'),
    boundSouth: pick('남'),
    boundEast: pick('동'),
  }
}

const COLLECT_TABS = ['낚시', '채집', '애완동물']
const DEST_TABS = ['보물지도', '퀘스트']

/** 탭이 뭉개진 "낚시채집애완동물" / 정상 탭 분리 모두 처리 */
function matchTabHeader(line, tabs) {
  const trimmed = String(line || '').trim()
  if (!trimmed) return null
  const cols = splitTabs(trimmed).filter(Boolean)
  if (cols.length >= 2 && cols.every((c) => tabs.includes(c))) return cols
  if (tabs.includes(trimmed)) return [trimmed]
  const mashed = trimmed.replace(/\s+/g, '')
  if (mashed === tabs.join('')) return [...tabs]
  return null
}

/**
 * @param {string} text
 */
export function parseSeaAreaText(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!raw) throw new Error('텍스트가 비어 있습니다.')

  const lines = raw.split('\n').map((l) => l.trimEnd())

  let name = ''
  let nameIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    name = line
      .replace(/^해역\s*[|｜]\s*/, '')
      .replace(/^해역\s*/, '')
      .trim()
    nameIdx = i
    break
  }
  name = name.replace(/\s+/g, ' ')
  if (!name) throw new Error('해역 이름을 찾지 못했습니다.')

  /** @type {Record<string, string|null>} */
  const meta = {
    category: null,
    region: null,
    bounds: null,
    wave: null,
    current: null,
    maxSpeedBonus: null,
  }

  /** @type {Array<{ kind: string, name: string }>} */
  const places = []
  /** @type {Array<{ source: string, rank: number|null, type: string|null, items: string }>} */
  const collectItems = []
  /** @type {Array<{ source: string, discovery: string, content: string }>} */
  const destinations = []
  /** @type {Array<{ fleetCount: number|null, trait: string|null, names: string[] }>} */
  const seaNpcs = []

  let mode = 'meta'
  let collectSource = '낚시'
  let destSource = '보물지도'

  for (let i = nameIdx + 1; i < lines.length; i++) {
    const line = lines[i].replace(/^[\uFEFF\u200B\u200C\u200D]+/, '').trim()
    if (!line) continue

    if (/^해역\s*내\s*장소/.test(line)) {
      mode = 'places'
      continue
    }
    if (/^수집\s*아이템/.test(line)) {
      mode = 'collect'
      collectSource = '낚시'
      continue
    }
    if (/^목적지/.test(line)) {
      mode = 'dest'
      destSource = '보물지도'
      continue
    }
    if (/^해상\s*NPC/.test(line)) {
      mode = 'npc'
      continue
    }

    if (mode === 'places') {
      if (/^종류\t|^종류$/.test(line)) continue
      const cols = splitTabs(line)
      if (cols.length >= 2) {
        const kind = cols[0]
        const placeName = cols.slice(1).join(' ').replace(/\s+/g, ' ').trim()
        if (kind && placeName && !/^(종류|내용)$/.test(kind)) {
          places.push({ kind, name: placeName })
        }
      }
      continue
    }

    if (mode === 'collect') {
      const tabs = matchTabHeader(line, COLLECT_TABS)
      if (tabs) {
        collectSource = tabs[0]
        continue
      }
      if (/^랭크\t|^랭크$/.test(line)) continue
      const cols = splitTabs(line)
      if (cols.length === 1 && COLLECT_TABS.includes(cols[0])) {
        collectSource = cols[0]
        continue
      }
      // 랭크 없는 단순 이름 목록 (애완동물 등)
      if (
        cols.length === 1 &&
        cols[0] &&
        !/^\d+$/.test(cols[0]) &&
        !COLLECT_TABS.includes(cols[0])
      ) {
        collectItems.push({
          source: collectSource || '기타',
          name: cols[0],
          rank: null,
          type: null,
          recommendSpot: null,
          canExchange: null,
          canRelease: null,
        })
        continue
      }
      // 랭크	종류	아이템(콤마 구분 → 개별 행)
      if (cols.length >= 3 && /^\d+$/.test(cols[0])) {
        const rank = Number(cols[0])
        const type = cols[1] || null
        const names = cols
          .slice(2)
          .join('\t')
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean)
        for (const itemName of names) {
          collectItems.push({
            source: collectSource || '기타',
            name: itemName,
            rank,
            type,
            recommendSpot: null,
            canExchange: null,
            canRelease: null,
          })
        }
      }
      continue
    }

    if (mode === 'dest') {
      const tabs = matchTabHeader(line, DEST_TABS)
      if (tabs) {
        destSource = tabs[0]
        continue
      }
      if (/^발견물\t|^발견물$/.test(line)) continue
      const cols = splitTabs(line)
      if (cols.length === 1 && DEST_TABS.includes(cols[0])) {
        destSource = cols[0]
        continue
      }
      if (cols.length >= 2 && cols[0] && !/^(발견물|내용)$/.test(cols[0])) {
        destinations.push({
          source: destSource || '보물지도',
          discovery: cols[0],
          content: cols.slice(1).join('\t').trim(),
        })
      }
      continue
    }

    if (mode === 'npc') {
      if (/^함대\s*수/.test(line)) continue
      const cols = splitTabs(line)
      if (cols.length >= 1 && /^\d+$/.test(cols[0])) {
        const namesText = (cols[2] ?? cols.slice(2).join('\t')).trim()
        const names = namesText
          ? namesText
              .split(/[,，]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : []
        seaNpcs.push({
          fleetCount: Number(cols[0]),
          trait: cols[1] ? cols[1].trim() || null : null,
          names,
        })
      }
      continue
    }

    const looksLabeled =
      META_LABELS.some((m) => m.re.test(splitTabs(line)[0] || '')) ||
      /분류|지역|경계|파도|조류|최대\s*속도/.test(line)
    if (looksLabeled) {
      applyMetaLine(line, meta)
    }
  }

  const bounds = parseBounds(meta.bounds)

  const regions = meta.region
    ? String(meta.region)
        .split(/[,，/]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  return {
    name,
    slug: slugify(name),
    altName: null,
    description: null,
    category: meta.category,
    region: regions[0] || meta.region,
    regions,
    boundNorth: bounds.boundNorth,
    boundWest: bounds.boundWest,
    boundSouth: bounds.boundSouth,
    boundEast: bounds.boundEast,
    wave: toNum(meta.wave),
    current: toNum(meta.current),
    maxSpeedBonus: meta.maxSpeedBonus,
    places,
    collectItems,
    destinations,
    seaNpcs,
  }
}
