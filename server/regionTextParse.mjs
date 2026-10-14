/**
 * 위키형 지역 텍스트 → DB용 객체
 *
 * 지역아프리카 동부-인도
 * 해역
 * 해역 그룹	해역
 * 홍해	메소포타미아 유역, 아라비아 해, …
 */

import { createHash } from 'node:crypto'

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `region-${hash}`
}

function splitTabs(line) {
  return line.split('\t').map((s) => s.trim())
}

function splitSeaNames(text) {
  return String(text || '')
    .split(/[,\uFF0C]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * @param {string} text
 */
export function parseRegionText(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!raw) throw new Error('텍스트가 비어 있습니다.')

  const lines = raw.split('\n').map((l) => l.trimEnd())

  let name = ''
  let nameIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    name = line
      .replace(/^지역\s*[|｜]?\s*/, '')
      .replace(/^지역\s*/, '')
      .trim()
    nameIdx = i
    break
  }
  name = name.replace(/\s+/g, ' ')
  if (!name) throw new Error('지역 이름을 찾지 못했습니다.')

  let altName = null
  let description = ''
  /** @type {Array<{ group: string, seaAreas: string[] }>} */
  const seaGroups = []

  let mode = 'meta'

  for (let i = nameIdx + 1; i < lines.length; i++) {
    const line = lines[i].replace(/^[\uFEFF\u200B\u200C\u200D]+/, '').trim()
    if (!line) continue

    if (/^해역$/.test(line)) {
      mode = 'sea'
      continue
    }
    if (/^설명$/.test(line)) {
      mode = 'description'
      continue
    }
    if (/^추가\s*이름/.test(line)) {
      const cols = splitTabs(line)
      if (cols.length >= 2) altName = cols.slice(1).join('\t').trim() || null
      else {
        const m = line.match(/^추가\s*이름\s*[:：]?\s*(.+)$/)
        if (m) altName = m[1].trim() || null
      }
      continue
    }

    if (mode === 'sea') {
      if (/^해역\s*그룹(\t|$)/.test(line) && /해역/.test(line)) continue
      const cols = splitTabs(line)
      if (cols.length >= 2 && cols[0] && cols[0] !== '해역 그룹') {
        seaGroups.push({
          group: cols[0],
          seaAreas: splitSeaNames(cols.slice(1).join('\t')),
        })
      }
      continue
    }

    if (mode === 'description') {
      description = description ? `${description}\n${line}` : line
      continue
    }

    // meta: 설명 문단 (해역 섹션 전)
    if (!/분류|지역|해역/.test(splitTabs(line)[0] || '')) {
      description = description ? `${description}\n${line}` : line
    }
  }

  return {
    name,
    slug: slugify(name),
    altName,
    description: description || null,
    seaGroups,
  }
}
