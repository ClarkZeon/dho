/**
 * 위키형 직업 텍스트 → DB용 객체
 *
 * 직업궁정 정원사
 * 세계의 식물을 수집하는 탐험가.
 * …
 * 별칭 플랜트 헌터.
 *
 * 분류	모험	추천장	궁정 정원사 추천장
 * 비용	90,000두캇
 * 우대 스킬	생물학, 생태 조사*, …
 * 필요
 * 종류	내용
 * 레벨	모험 Lv30, 합계 Lv60
 * 연구
 * 연구	전공	획득 스킬
 * …
 */

import { createHash } from 'node:crypto'

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `job-${hash}`
}

function splitTabs(line) {
  return line.split('\t').map((s) => s.trim())
}

function parseJobName(line) {
  const t = String(line || '').trim()
  if (!t) return ''
  const pipe = t.match(/^직업\s*[|｜]\s*(.+)$/)
  if (pipe) return pipe[1].trim()
  const tab = t.match(/^직업\t+(.+)$/)
  if (tab) return tab[1].trim()
  if (/^직업/.test(t)) return t.replace(/^직업\s*/, '').trim()
  return t
}

function isMetaStart(line) {
  return (
    /^별칭(\s|\t|$)/.test(line) ||
    /^분류(\t|$)/.test(line) ||
    /^추천장(\t|$)/.test(line) ||
    /^비용(\t|$)/.test(line) ||
    /^우대\s*스킬(\t|$)/.test(line) ||
    /^필요(\t|$)/.test(line) ||
    /^연구(\t|$)/.test(line)
  )
}

function parseAltFromLine(line) {
  const t = String(line || '').trim()
  const m =
    t.match(/^별칭\s*[|｜]\s*(.+)$/) ||
    t.match(/^별칭\t+(.+)$/) ||
    t.match(/^별칭\s+(.+)$/)
  if (!m) return null
  return m[1].replace(/[.。]\s*$/, '').trim() || null
}

function splitSkills(raw) {
  return String(raw || '')
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function applyKv(state, key, value) {
  const k = String(key || '').trim()
  const v = String(value || '').trim()
  if (!k) return
  if (/^별칭$/.test(k)) {
    if (v) state.altName = v.replace(/[.。]\s*$/, '')
    return
  }
  if (/^분류$/.test(k)) {
    if (v) state.category = v
    return
  }
  if (/^추천장$/.test(k)) {
    if (v) state.recommendation = v
    return
  }
  if (/^비용$/.test(k)) {
    if (v) state.cost = v
    return
  }
  if (/^우대\s*스킬$/.test(k)) {
    if (v) state.preferredSkills = splitSkills(v)
  }
}

/**
 * @param {string} text
 */
export function parseJobText(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trimEnd())

  let i = 0
  while (i < lines.length && !lines[i].trim()) i++
  if (i >= lines.length) throw new Error('직업 텍스트가 비어 있습니다.')

  const name = parseJobName(lines[i].trim())
  i++
  if (!name) throw new Error('직업 이름이 없습니다.')

  /** @type {{
   *   altName: string|null,
   *   description: string|null,
   *   category: string|null,
   *   recommendation: string|null,
   *   cost: string|null,
   *   preferredSkills: string[],
   *   requirements: Array<{ kind: string, content: string }>,
   *   researches: Array<{ name: string, major: string|null, skill: string|null }>,
   * }} */
  const state = {
    altName: null,
    description: null,
    category: null,
    recommendation: null,
    cost: null,
    preferredSkills: [],
    requirements: [],
    researches: [],
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
    const alt = parseAltFromLine(t)
    if (alt) {
      state.altName = alt
      i++
      continue
    }
    descLines.push(t)
    i++
  }
  state.description = descLines.join('\n').trim() || null

  /** @type {null | 'req' | 'research'} */
  let mode = null

  while (i < lines.length) {
    const raw = lines[i]
    const t = raw.trim()
    i++
    if (!t) continue

    const cols = splitTabs(t)

    if (/^필요(\t|$)/.test(t) && cols.length <= 2 && !(cols[1] || '').trim()) {
      mode = 'req'
      continue
    }
    if (/^연구(\t|$)/.test(t)) {
      const rest = cols.slice(1).filter(Boolean)
      const looksHeader =
        rest.length === 0 ||
        (rest.includes('전공') && rest.includes('획득 스킬')) ||
        (cols[0] === '연구' && cols[1] === '전공')
      if (looksHeader) {
        mode = 'research'
        continue
      }
    }

    if (mode === 'req') {
      if (/^종류$/.test(cols[0] || '') && /^내용$/.test(cols[1] || '')) continue
      if (/^연구(\t|$)/.test(t)) {
        i--
        mode = null
        continue
      }
      const kind = (cols[0] || '').trim()
      const content = cols.slice(1).join('\t').trim()
      if (kind && content) {
        state.requirements.push({ kind, content })
      }
      continue
    }

    if (mode === 'research') {
      if (
        /^연구$/.test(cols[0] || '') &&
        /^전공$/.test(cols[1] || '') &&
        /획득\s*스킬/.test(cols[2] || '')
      ) {
        continue
      }
      const researchName = (cols[0] || '').trim()
      if (!researchName) continue
      state.researches.push({
        name: researchName,
        major: (cols[1] || '').trim() || null,
        skill: (cols[2] || '').trim() || null,
      })
      continue
    }

    if (/^별칭(\s|\t|$)/.test(t)) {
      const alt = parseAltFromLine(t) || cols.slice(1).join('\t').trim()
      if (alt) state.altName = alt.replace(/[.。]\s*$/, '')
      continue
    }

    // 분류	모험	추천장	궁정 정원사 추천장  형태 (키·값 교차)
    if (cols.length >= 2) {
      let consumed = false
      for (let c = 0; c + 1 < cols.length; c += 2) {
        const key = cols[c]
        const value = cols[c + 1]
        if (
          /^(별칭|분류|추천장|비용|우대\s*스킬)$/.test(key || '')
        ) {
          applyKv(state, key, value)
          consumed = true
        }
      }
      if (consumed) continue
    }

    if (/^우대\s*스킬(\t|$)/.test(t) || cols[0] === '우대 스킬') {
      applyKv(state, '우대 스킬', cols.slice(1).join('\t'))
      continue
    }
    if (/^비용(\t|$)/.test(t) || cols[0] === '비용') {
      applyKv(state, '비용', cols.slice(1).join('\t'))
      continue
    }
    if (/^분류(\t|$)/.test(t) || cols[0] === '분류') {
      applyKv(state, '분류', cols[1] || '')
      if (cols[2] === '추천장') applyKv(state, '추천장', cols[3] || '')
      continue
    }
    if (/^추천장(\t|$)/.test(t) || cols[0] === '추천장') {
      applyKv(state, '추천장', cols.slice(1).join('\t'))
      continue
    }
    if (/^필요(\t|$)/.test(t) || cols[0] === '필요') {
      mode = 'req'
      const content = cols.slice(1).join('\t').trim()
      if (content) {
        state.requirements.push({ kind: '필요', content })
      }
      continue
    }
    if (/^연구(\t|$)/.test(t) || cols[0] === '연구') {
      mode = 'research'
      continue
    }
  }

  return {
    slug: slugify(name),
    name,
    altName: state.altName,
    description: state.description,
    category: state.category,
    recommendation: state.recommendation,
    cost: state.cost,
    preferredSkills: state.preferredSkills,
    requirements: state.requirements,
    researches: state.researches,
  }
}
