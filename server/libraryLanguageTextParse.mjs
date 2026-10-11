/**
 * 위키형 언어(스킬) 텍스트 → DB용 객체
 *
 * 스킬북극어 / 스킬 | 북극어
 * 회화나 서적열람이 가능.
 * 러시아와 북극에서 사용한다.
 * 분류	언어	행동력	자동효과
 * 범위	함대	습득 비용	1,000,000두캇
 * 스킬 습득
 * 지역	도시	도시 인물
 * 유럽 북부	상트 페테르부르크	다이고쿠야 코다로
 * 사용 도시
 * 지역	도시
 * 유럽 북부	상트 페테르부르크
 */

import { createHash } from 'node:crypto'

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `lang-${hash}`
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

/**
 * @param {string} text
 */
export function parseLibraryLanguageText(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!raw) throw new Error('텍스트가 비어 있습니다.')

  const lines = raw.split('\n').map((l) => l.trimEnd())

  let name = ''
  let nameIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (/^스킬\s*습득/.test(line) || /^사용\s*도시/.test(line)) continue

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
  if (!name) throw new Error('언어 이름을 찾지 못했습니다.')

  let description = ''
  let category = '언어'
  let rangeScope = null
  let actionPower = null
  let autoEffect = null
  let learnCost = null
  let prerequisite = null
  /** @type {Array<{ region: string, city: string, npc: string|null }>} */
  let learnPlaces = []
  /** @type {Array<{ region: string, city: string }>} */
  let useCities = []

  /** @type {null | 'meta' | 'learn' | 'use'} */
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

    const cols = splitTabs(line)

    if (mode === 'learn') {
      if (isLearnHeader(cols) || isUseHeader(cols)) continue
      if (cols[0] && cols[1]) {
        learnPlaces.push({
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
        useCities.push({ region: cols[0], city: cols[1] })
      }
      continue
    }

    // 헤더: 분류	언어	행동력	자동효과
    if (
      cols.length >= 2 &&
      /^분류$/.test(cols[0] || '') &&
      /^(언어|종류)$/.test(cols[1] || '')
    ) {
      category = cols[1]
      mode = 'meta'
      continue
    }

    // 값 행: 범위	함대	습득 비용	1,000,000두캇
    if (/^범위$/.test(cols[0] || '')) {
      if (cols[1]) rangeScope = cols[1]
      const costIdx = cols.findIndex((c) => /^습득\s*비용$/.test(c))
      if (costIdx >= 0 && cols[costIdx + 1]) {
        learnCost = toNum(cols[costIdx + 1])
      }
      mode = 'meta'
      continue
    }

    if (/^습득\s*비용$|^학습\s*비용$|^비용$/.test(cols[0] || '') && cols[1]) {
      learnCost = toNum(cols[1])
      continue
    }

    if (/^범위$/.test(cols[0] || '') && cols[1]) {
      rangeScope = cols[1]
      continue
    }

    if (/^행동력$/.test(cols[0] || '') && cols[1]) {
      actionPower = cols.slice(1).join('\t') || null
      continue
    }

    if (/^자동\s*효과$/.test(cols[0] || '') && cols[1]) {
      autoEffect = cols.slice(1).join('\t') || null
      continue
    }

    if (/^선행\s*스킬$|^선행$/.test(cols[0] || '') && cols[1]) {
      prerequisite = cols.slice(1).join('\t') || null
      continue
    }

    // 메타 헤더 전 설명
    if (!mode || mode === 'meta') {
      if (
        !/^분류$/.test(cols[0] || '') &&
        !/^범위$/.test(cols[0] || '') &&
        !/^습득/.test(cols[0] || '')
      ) {
        description = description ? `${description}\n${line}` : line
      }
    }
  }

  return {
    name,
    slug: slugify(name),
    description: description || null,
    category,
    rangeScope,
    actionPower,
    autoEffect,
    learnCost,
    prerequisite,
    learnPlaces,
    useCities,
  }
}
