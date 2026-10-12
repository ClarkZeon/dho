/**
 * 위키형 소비품 텍스트 → DB용 객체
 *
 * 소비품의뢰 알선서
 * 조합의 의뢰를 새롭게 제시받을 수 있다.
 *
 * 분류	아이템 획득	사용효과	의뢰 알선
 * 획득 방법
 * 구입생산퀘스트…
 * 판매 NPC	지역	장소
 * 모험가조합 마스터	유럽 북부	런던 모험가조합, …
 * 유럽 서부	리스본 모험가조합, …
 */

import { createHash } from 'node:crypto'

const ACQUIRE_METHODS = [
  '육지 재조사',
  '아이템 사용',
  '트레져박스',
  '애완동물',
  '이벤트',
  '퀘스트',
  '생산',
  '구입',
]

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `consumable-${hash}`
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

function parseTitleName(line) {
  const t = String(line || '').trim()
  if (!t) return ''
  const pipe = t.match(/^소비품\s*[|｜]\s*(.+)$/)
  if (pipe) return pipe[1].trim()
  const tab = t.match(/^소비품\t+(.+)$/)
  if (tab) return tab[1].trim()
  if (t.startsWith('소비품')) return t.slice(3).trim()
  return t
}

/** 탭 없이 이어 붙은 획득 방법 탭 라벨 분리 */
function splitAcquireMethods(line) {
  let rest = String(line || '').replace(/\s+/g, ' ').trim()
  if (!rest) return []
  const found = []
  while (rest) {
    let hit = null
    for (const method of ACQUIRE_METHODS) {
      if (rest.startsWith(method)) {
        hit = method
        break
      }
    }
    if (!hit) {
      // 탭/콤마 구분 시도
      const parts = rest
        .split(/[\t,，/|｜]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      for (const p of parts) {
        if (ACQUIRE_METHODS.includes(p) && !found.includes(p)) found.push(p)
      }
      break
    }
    if (!found.includes(hit)) found.push(hit)
    rest = rest.slice(hit.length).trim()
  }
  return found
}

function isPurchaseHeader(cols) {
  const joined = cols.join(' ')
  return /판매\s*NPC/.test(joined) && /지역/.test(joined) && /장소/.test(joined)
}

/**
 * @param {string} text
 */
export function parseConsumableText(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trimEnd())

  let name = ''
  let description = ''
  let category = null
  let useEffect = null
  /** @type {string[]} */
  let acquireMethods = []
  /** @type {Array<{ npc: string, region: string, place: string }>} */
  const purchases = []

  let i = 0
  while (i < lines.length && !lines[i].trim()) i++
  if (i >= lines.length) throw new Error('소비품 텍스트가 비어 있습니다.')

  name = parseTitleName(lines[i].trim())
  i++
  if (!name) throw new Error('소비품 이름이 없습니다.')

  const descLines = []
  while (i < lines.length) {
    const t = lines[i].trim()
    if (!t) {
      i++
      if (descLines.length) break
      continue
    }
    if (/^분류(\t|$)/.test(t) || /^획득\s*방법/.test(t)) break
    if (/^(판매\s*NPC|구입|생산|퀘스트)/.test(t)) break
    descLines.push(t)
    i++
  }
  description = descLines.join('\n').trim() || null

  while (i < lines.length) {
    const t = lines[i].trim()
    if (!t) {
      i++
      continue
    }
    if (/^획득\s*방법/.test(t)) {
      i++
      break
    }
    if (/^분류/.test(t) || /사용효과/.test(t)) {
      const cols = splitTabs(t)
      for (let c = 0; c < cols.length - 1; c++) {
        const label = cols[c]
        const value = (cols[c + 1] || '').trim()
        if (!value) continue
        if (/^분류$/.test(label)) category = value
        if (/^사용효과$/.test(label)) useEffect = value
      }
      category =
        pickLabeledValue(t, /분류/, [/사용효과/]) || category
      useEffect =
        pickLabeledValue(t, /사용효과/, [/분류/]) || useEffect
      i++
      continue
    }
    break
  }

  // 획득 방법 헤더 뒤: 방법 목록 줄
  while (i < lines.length && !lines[i].trim()) i++
  if (i < lines.length) {
    const t = lines[i].trim()
    if (!isPurchaseHeader(splitTabs(t)) && !/^판매\s*NPC/.test(t)) {
      const methods = splitAcquireMethods(t)
      if (methods.length) {
        acquireMethods = methods
        i++
      }
    }
  }

  // 구입 테이블
  let inPurchase = false
  let currentNpc = ''
  while (i < lines.length) {
    const t = lines[i].trim()
    i++
    if (!t) continue
    const cols = splitTabs(t)
    if (isPurchaseHeader(cols) || /^판매\s*NPC/.test(t)) {
      inPurchase = true
      if (!acquireMethods.includes('구입')) acquireMethods.push('구입')
      continue
    }
    if (!inPurchase) {
      // 헤더 없이 바로 데이터일 수 있음
      if (cols.length >= 2) {
        inPurchase = true
        if (!acquireMethods.includes('구입')) acquireMethods.push('구입')
      } else {
        continue
      }
    }

    if (cols.length >= 3) {
      const npc = cols[0] || currentNpc
      const region = cols[1] || ''
      const place = cols.slice(2).join('\t').trim()
      if (cols[0]) currentNpc = cols[0]
      if (npc && (region || place)) {
        purchases.push({ npc, region, place })
      }
    } else if (cols.length === 2 && currentNpc) {
      purchases.push({
        npc: currentNpc,
        region: cols[0],
        place: cols[1],
      })
    }
  }

  if (!acquireMethods.length && purchases.length) {
    acquireMethods = ['구입']
  }

  return {
    slug: slugify(name),
    name,
    description,
    category,
    useEffect,
    acquireMethods,
    purchases,
  }
}
