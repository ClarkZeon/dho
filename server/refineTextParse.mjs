/**
 * 위키형 연성 효과 텍스트 → DB용 객체
 *
 * 연성 효과 | 발견 시 피로 회복
 * 발견물을 발견했을 때 …
 *
 * 행동력	자동효과	스킬	생태 조사, 인식, 탐색
 */

import { createHash } from 'node:crypto'

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `refine-${hash}`
}

function splitTabs(line) {
  return line.split('\t').map((s) => s.trim())
}

function splitSkills(raw) {
  return String(raw || '')
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseRefineName(line) {
  const t = String(line || '').trim()
  if (!t) return ''
  const pipe = t.match(/^연성\s*효과\s*[|｜]\s*(.+)$/)
  if (pipe) return pipe[1].trim()
  const tab = t.match(/^연성\s*효과\t+(.+)$/)
  if (tab) return tab[1].trim()
  if (/^연성\s*효과/.test(t)) {
    return t.replace(/^연성\s*효과\s*/, '').trim()
  }
  return t
}

function isMetaStart(line) {
  return (
    /^행동력(\t|$)/.test(line) ||
    /^스킬(\t|$)/.test(line) ||
    /^자동\s*효과(\t|$)/.test(line)
  )
}

/**
 * @param {string} text
 */
export function parseRefineText(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trimEnd())

  let i = 0
  while (i < lines.length && !lines[i].trim()) i++
  if (i >= lines.length) throw new Error('연성 텍스트가 비어 있습니다.')

  const name = parseRefineName(lines[i].trim())
  i++
  if (!name) throw new Error('연성 효과 이름이 없습니다.')

  /** @type {{
   *   description: string|null,
   *   actionPower: string|null,
   *   skills: string[],
   * }} */
  const state = {
    description: null,
    actionPower: null,
    skills: [],
  }

  const descLines = []
  while (i < lines.length) {
    const t = lines[i].trim()
    if (!t) {
      i++
      if (descLines.length) break
      continue
    }
    if (isMetaStart(t)) break
    descLines.push(t)
    i++
  }
  state.description = descLines.join('\n').trim() || null

  while (i < lines.length) {
    const t = lines[i].trim()
    i++
    if (!t) continue

    const cols = splitTabs(t)

    // 행동력	자동효과	스킬	생태 조사, 인식, 탐색
    if (cols.length >= 2) {
      let consumed = false
      for (let c = 0; c + 1 < cols.length; c += 2) {
        const key = (cols[c] || '').trim()
        const value = (cols[c + 1] || '').trim()
        if (/^행동력$/.test(key)) {
          if (value) state.actionPower = value
          consumed = true
        } else if (/^스킬$/.test(key)) {
          if (value) state.skills = splitSkills(value)
          consumed = true
        } else if (/^자동\s*효과$/.test(key) && !state.actionPower) {
          state.actionPower = value || '자동효과'
          consumed = true
        }
      }
      if (consumed) continue
    }

    if (/^행동력(\t|$)/.test(t) || cols[0] === '행동력') {
      const value = cols.slice(1).join('\t').trim()
      if (value) state.actionPower = value
      continue
    }
    if (/^스킬(\t|$)/.test(t) || cols[0] === '스킬') {
      const value = cols.slice(1).join('\t').trim()
      if (value) state.skills = splitSkills(value)
      continue
    }
  }

  return {
    slug: slugify(name),
    name,
    description: state.description,
    actionPower: state.actionPower,
    skills: state.skills,
  }
}
