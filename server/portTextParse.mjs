/**
 * 위키형 항구(도시) 텍스트 → DB용 객체
 *
 * 도시리스본
 * 분류	포르투갈본거지	지역	유럽 서부
 * 해역	리스본 앞바다	좌표	15784, 3205
 * 입항허가	북대서양	문화	이베리아
 * 언어	포르투갈어
 * 보상
 * 종류	금액	보상
 * 투자	1,000,000두캇	서 지중해의 명물요리집
 * 수집 아이템
 * 낚시
 * 랭크	종류	아이템
 * 1	교역품	고등어(교환), …
 */

import { createHash } from 'node:crypto'

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
]

function isExactMetaLabel(label) {
  const t = String(label || '').trim()
  return /^(분류|지역|해역|좌표|입항\s*허가|문화(?:권)?|언어)$/.test(t)
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
      // 시설은 무시 (메모성)
      if (/^시설$/.test(label)) continue
      if (!isExactMetaLabel(label)) continue
      for (const meta of META_LABELS) {
        if (meta.re.test(label)) {
          fields[meta.key] = value
          break
        }
      }
    }
  }
  const stopLabels = [...META_LABELS.map((m) => m.re), /시설/]
  for (const meta of META_LABELS) {
    const v = pickLabeledValue(
      line,
      meta.re,
      stopLabels.filter((r) => r !== meta.re),
    )
    if (v) fields[meta.key] = v
  }
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
  }

  let description = ''
  /** @type {Array<{ kind: string, amount: string, reward: string }>} */
  const rewards = []
  /** @type {Array<{ source: string, rank: number|null, type: string|null, items: string }>} */
  const collectItems = []

  let mode = 'meta'
  let collectSource = null

  for (let i = nameIdx + 1; i < lines.length; i++) {
    const line = lines[i].replace(/^[\uFEFF\u200B\u200C\u200D]+/, '').trim()
    if (!line) continue

    if (/^보상$/.test(line)) {
      mode = 'reward'
      continue
    }
    if (/^수집\s*아이템/.test(line)) {
      mode = 'collect'
      collectSource = null
      continue
    }

    if (mode === 'reward') {
      if (/^종류\t|^종류$/.test(line)) continue
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

    if (mode === 'collect') {
      if (/^랭크\t|^랭크$/.test(line)) continue
      const cols = splitTabs(line)
      // 탭이 없고 짧은 줄이면 수집 분류 탭명 (낚시, 채집 …)
      if (cols.length === 1 && !/^\d+$/.test(cols[0])) {
        collectSource = cols[0]
        continue
      }
      if (cols.length >= 3 && /^\d+$/.test(cols[0])) {
        collectItems.push({
          source: collectSource || '기타',
          rank: Number(cols[0]),
          type: cols[1] || null,
          items: cols.slice(2).join('\t').trim(),
        })
      }
      continue
    }

    // meta: 분류/지역/해역 … 또는 소개 문단
    // 시설은 메모성 정보라 저장하지 않음
    if (/^시설\b/.test(splitTabs(line)[0] || '') || /^시설\t/.test(line)) {
      continue
    }

    const looksLabeled =
      META_LABELS.some((m) => m.re.test(splitTabs(line)[0] || '')) ||
      /분류|지역|해역|좌표|입항\s*허가|문화|언어/.test(line)

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
    description: description || null,
    category: fields.category,
    region: fields.region,
    seaArea: fields.seaArea,
    coordX,
    coordY,
    entryPermit: fields.entryPermit,
    culture: fields.culture,
    language: fields.language,
    rewards,
    collectItems,
  }
}
