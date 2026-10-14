/**
 * 위키형 입항허가 텍스트 → DB용 객체
 *
 * 입항허가동남아시아
 * 퀘스트 (택일)
 * 캘리컷
 * 종류	난이도	퀘스트
 * 모험	4	미지의 매력
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
  return `entry-permit-${hash}`
}

function splitTabs(line) {
  return line.split('\t').map((s) => s.trim())
}

function toDifficulty(value) {
  if (value == null || value === '') return null
  const n = Number(String(value).replace(/[★☆*\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

function emptyCell(v) {
  const t = String(v ?? '').trim()
  return t ? t : null
}

/**
 * @param {string} text
 */
export function parseEntryPermitText(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!raw) throw new Error('텍스트가 비어 있습니다.')

  const lines = raw.split('\n').map((l) => l.trimEnd())

  let name = ''
  let nameIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    name = line
      .replace(/^입항\s*허가\s*[|｜]?\s*/, '')
      .replace(/^입항\s*허가\s*/, '')
      .trim()
    nameIdx = i
    break
  }
  name = name.replace(/\s+/g, ' ')
  if (!name) throw new Error('입항허가 이름을 찾지 못했습니다.')

  let altName = null
  let description = ''
  let requirement = ''
  /** @type {Array<{ nationality: string|null, general: string|null, countryEvent: string|null }>} */
  const fame = []
  /** @type {Array<{ city: string, quests: Array<{ kind: string, difficulty: number|null, name: string }> }>} */
  const cityQuests = []

  /** @type {null | 'meta' | 'quests' | 'fame' | 'requirement' | 'description'} */
  let mode = null
  /** @type {{ city: string, quests: Array<{ kind: string, difficulty: number|null, name: string }> } | null} */
  let currentCity = null

  for (let i = nameIdx + 1; i < lines.length; i++) {
    const line = lines[i].replace(/^[\uFEFF\u200B\u200C\u200D]+/, '').trim()
    if (!line) continue

    if (/^퀘스트\s*\(?\s*택일\s*\)?/.test(line) || /^퀘스트\s*\(택일\)/.test(line)) {
      mode = 'quests'
      currentCity = null
      continue
    }
    if (/^명성$/.test(line)) {
      mode = 'fame'
      continue
    }
    if (/^필요$/.test(line)) {
      mode = 'requirement'
      continue
    }
    if (/^설명$/.test(line)) {
      mode = 'description'
      continue
    }
    if (/^추가\s*이름/.test(line)) {
      const cols = splitTabs(line)
      if (cols.length >= 2) altName = cols.slice(1).join('\t').trim() || null
      continue
    }

    const cols = splitTabs(line)

    if (mode === 'quests') {
      if (/^종류(\t|$)/.test(line) && /난이도|퀘스트/.test(line)) continue

      // 도시 탭명: 단일 셀, 종류 행이 아님
      if (
        cols.length === 1 &&
        cols[0] &&
        !/^(모험|상인|해양|종류)$/.test(cols[0])
      ) {
        currentCity = { city: cols[0], quests: [] }
        cityQuests.push(currentCity)
        continue
      }

      // 모험	4	미지의 매력
      if (cols.length >= 3 && cols[0] && cols[2]) {
        if (!currentCity) {
          currentCity = { city: '', quests: [] }
          cityQuests.push(currentCity)
        }
        currentCity.quests.push({
          kind: cols[0],
          difficulty: toDifficulty(cols[1]),
          name: cols.slice(2).join('\t').trim(),
        })
        continue
      }

      // 수정폼형: 퀘스트 이름만
      if (cols.length === 1 && cols[0] && currentCity) {
        currentCity.quests.push({
          kind: '',
          difficulty: null,
          name: cols[0],
        })
      }
      continue
    }

    if (mode === 'fame') {
      // 국적 / 일반 / 국가 이벤트 라벨 행
      if (/국적|일반|국가\s*이벤트/.test(line)) {
        const nationality = emptyCell(
          (line.match(/국적\s*[:：]?\s*([^\t]*?)(?=\t|일반|$)/) || [])[1],
        )
        const general = emptyCell(
          (line.match(/일반\s*[:：]?\s*([^\t]*?)(?=\t|국가|$)/) || [])[1],
        )
        const countryEvent = emptyCell(
          (line.match(/국가\s*이벤트\s*[:：]?\s*(.+)$/) || [])[1],
        )
        if (nationality || general || countryEvent) {
          fame.push({ nationality, general, countryEvent })
        }
      }
      continue
    }

    if (mode === 'requirement') {
      requirement = requirement ? `${requirement}\n${line}` : line
      continue
    }

    if (mode === 'description') {
      description = description ? `${description}\n${line}` : line
      continue
    }

    // meta 전 설명 문단
    if (!mode) {
      description = description ? `${description}\n${line}` : line
    }
  }

  return {
    name,
    slug: slugify(name),
    altName,
    description: description || null,
    requirement: requirement || null,
    fame,
    cityQuests,
  }
}
