/**
 * 위키형 호칭 텍스트 → DB용 객체
 *
 * 호칭그란데
 * 그란데 가나돌에게 계속해서 승리한 자에게 주어지는 칭호.
 * …
 *
 * 효과	가나돌 전투에서 승리 시 얻는 경험치, 명성, 보상 증가
 * 필요	피사로(그란데 가나돌) 처치.
 */

import { createHash } from 'node:crypto'

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `title-${hash}`
}

function splitTabs(line) {
  return line.split('\t').map((s) => s.trim())
}

function parseTitleName(line) {
  const t = String(line || '').trim()
  if (!t) return ''
  const pipe = t.match(/^호칭\s*[|｜]\s*(.+)$/)
  if (pipe) return pipe[1].trim()
  const tab = t.match(/^호칭\t+(.+)$/)
  if (tab) return tab[1].trim()
  if (/^호칭/.test(t)) return t.replace(/^호칭\s*/, '').trim()
  return t
}

/**
 * @param {string} text
 */
export function parseTitleText(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trimEnd())

  let name = ''
  let altName = null
  let description = null
  let effect = null
  let requirement = null

  let i = 0
  while (i < lines.length && !lines[i].trim()) i++
  if (i >= lines.length) throw new Error('호칭 텍스트가 비어 있습니다.')

  name = parseTitleName(lines[i].trim())
  i++
  if (!name) throw new Error('호칭 이름이 없습니다.')

  const descLines = []
  while (i < lines.length) {
    const t = lines[i].trim()
    if (!t) {
      i++
      if (descLines.length) break
      continue
    }
    if (
      /^효과(\t|$)/.test(t) ||
      /^필요(\t|$)/.test(t) ||
      /^설명(\t|$)/.test(t) ||
      /^추가\s*이름/.test(t)
    ) {
      break
    }
    descLines.push(t)
    i++
  }
  description = descLines.join('\n').trim() || null

  while (i < lines.length) {
    const t = lines[i].trim()
    i++
    if (!t) continue
    const cols = splitTabs(t)

    if (/^추가\s*이름/.test(t)) {
      altName = cols.slice(1).join('\t').trim() || null
      continue
    }
    if (/^설명(\t|$)/.test(t)) {
      const rest = cols.slice(1).join('\t').trim()
      if (rest) {
        description = description ? `${description}\n${rest}` : rest
      }
      continue
    }
    if (/^효과(\t|$)/.test(t) || cols[0] === '효과') {
      effect = cols.slice(1).join('\t').trim() || effect
      continue
    }
    if (/^필요(\t|$)/.test(t) || cols[0] === '필요') {
      requirement = cols.slice(1).join('\t').trim() || requirement
      continue
    }
  }

  return {
    slug: slugify(name),
    name,
    altName,
    description,
    effect,
    requirement,
  }
}
