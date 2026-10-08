/**
 * 위키형 선박 텍스트 → DB용 객체
 */

import { createHash } from 'node:crypto'

/** URL/프록시 안전한 ASCII slug (한글명은 name 필드에 유지) */
function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `ship-${hash}`
}

function toNum(value) {
  if (value == null) return 0
  const n = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

function splitTabs(line) {
  // 빈 칸(연속 탭)도 유지 — 스킬 행의 돛/포문 빈칸용
  return line.split('\t').map((s) => s.trim())
}

/** 숫자 행처럼 빈 칸이 거의 없을 때 */
function splitTabsDense(line) {
  return line.split(/\t+/).map((s) => s.trim()).filter((s) => s !== '')
}

function parseCategoryLine(line) {
  // 분류	모험용 (소형1  , 범선)	레벨	모험 Lv4, 교역 Lv2
  // 또는 전투 Lv 포함
  // 분류	모험용 (소형1  , 범선)	레벨	...
  const categoryMatch = line.match(/분류\t*([^\t(]+?)\s*\(([^)]+)\)/)
  let category = null
  let sizeName = null
  let formName = null
  if (categoryMatch) {
    category = categoryMatch[1].trim()
    const parts = categoryMatch[2].split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    sizeName = parts[0] || null
    formName = parts[1] || null
  }

  const levels = { adventureLv: 0, tradeLv: 0, battleLv: 0 }
  const adv = line.match(/모험\s*Lv\s*(\d+)/i)
  const trade = line.match(/교역\s*Lv\s*(\d+)/i)
  const battle = line.match(/전투\s*Lv\s*(\d+)/i)
  if (adv) levels.adventureLv = Number(adv[1])
  if (trade) levels.tradeLv = Number(trade[1])
  if (battle) levels.battleLv = Number(battle[1])

  return { category, sizeName, formName, ...levels }
}

function parseEnhanceCount(line) {
  const m = line.match(/강화\s*횟수\s*(\d+)/)
  return m ? Number(m[1]) : null
}

function parseMaterial(line) {
  const m = line.match(/기본\s*재질\s*(.+?)(?:\t|강화|$)/)
  return m ? m[1].trim() : null
}

function parseBuildDays(line) {
  const m = line.match(/건조\s*일수\s*[:：]?\s*(\d+)/)
  return m ? Number(m[1]) : null
}

function parseShipyardRank(line) {
  const m = line.match(/조선\s*랭크\s*[:：]?\s*(\d+)/)
  return m ? Number(m[1]) : null
}

/**
 * @param {string} text
 */
export function parseShipText(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!raw) throw new Error('텍스트가 비어 있습니다.')

  const lines = raw.split('\n').map((l) => l.trimEnd())

  let name = ''
  let description = ''
  let nameIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (/^선박/.test(line) && line.length > 2) {
      name = line.replace(/^선박\s*/, '').trim()
      nameIdx = i
      break
    }
    // 첫 비어있지 않은 줄을 이름으로
    name = line.replace(/^선박\s*/, '').trim()
    nameIdx = i
    break
  }
  if (!name) throw new Error('선박 이름을 찾지 못했습니다.')

  for (let i = nameIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (/^분류/.test(line)) break
    description = description ? `${description}\n${line}` : line
  }

  let category = null
  let sizeName = null
  let formName = null
  let adventureLv = 0
  let tradeLv = 0
  let battleLv = 0
  let materialName = null
  let enhanceCount = null
  let buildDays = null
  let shipyardRank = null
  let acquireType = null
  let acquireMethod = null

  /** @type {number[]} */
  let performance = []
  /** @type {number[]} */
  let load = []
  /** @type {number[]} */
  let caps = []
  /** @type {number[]} */
  let parts = []
  /** @type {Array<{ name: string, sail: string|null, gunPort: string|null, material1: string|null, material2: string|null }>} */
  const skills = []

  let mode = 'meta'
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    if (/^분류/.test(line)) {
      const parsed = parseCategoryLine(line)
      category = parsed.category
      sizeName = parsed.sizeName
      formName = parsed.formName
      adventureLv = parsed.adventureLv
      tradeLv = parsed.tradeLv
      battleLv = parsed.battleLv
      continue
    }
    if (/기본\s*재질/.test(line)) {
      materialName = parseMaterial(line)
      enhanceCount = parseEnhanceCount(line) ?? enhanceCount
      continue
    }
    if (/선박\s*건조|조선\s*랭크|건조\s*일수/.test(line)) {
      buildDays = parseBuildDays(line) ?? buildDays
      shipyardRank = parseShipyardRank(line) ?? shipyardRank
      continue
    }
    if (/^기본\s*성능/.test(line)) {
      mode = 'perf-header'
      continue
    }
    if (/^적재/.test(line) && !/총/.test(line)) {
      mode = 'load-header'
      continue
    }
    if (/^강화\s*상한/.test(line)) {
      mode = 'caps-header'
      continue
    }
    if (/^선박\s*부품/.test(line)) {
      mode = 'parts-header'
      continue
    }
    if (/^선박\s*스킬/.test(line)) {
      mode = 'skills'
      continue
    }
    if (/^일반\s*건조|^판매\s*NPC|^지역\t/.test(line)) {
      mode = 'extra'
      continue
    }
    if (/^획득\s*방법/.test(line)) {
      mode = 'acquire'
      continue
    }

    if (mode === 'perf-header') {
      if (/내구도/.test(line)) {
        mode = 'perf-values'
        continue
      }
    }
    if (mode === 'perf-values') {
      performance = splitTabsDense(line).map(toNum)
      mode = 'meta'
      continue
    }

    if (mode === 'load-header') {
      if (/선실/.test(line)) {
        mode = 'load-values'
        continue
      }
    }
    if (mode === 'load-values') {
      load = splitTabsDense(line).map(toNum)
      mode = 'meta'
      continue
    }

    if (mode === 'caps-header') {
      if (/내구도/.test(line)) {
        mode = 'caps-values'
        continue
      }
    }
    if (mode === 'caps-values') {
      caps = splitTabsDense(line).map(toNum)
      mode = 'meta'
      continue
    }

    if (mode === 'parts-header') {
      if (/보조돛/.test(line)) {
        mode = 'parts-values'
        continue
      }
    }
    if (mode === 'parts-values') {
      parts = splitTabsDense(line).map(toNum)
      mode = 'meta'
      continue
    }

    if (mode === 'skills') {
      if (/^선박\s*스킬\t|^돛\t|^선박\s*재료$/.test(line)) continue
      if (/^일반\s*건조|^획득\s*방법|^판매\s*NPC/.test(line)) {
        i -= 1
        mode = 'meta'
        continue
      }
      const cols = splitTabs(line)
      if (!cols[0] || /재료/.test(cols[0])) continue
      // 스킬명, 돛, 포문, 재료1, 재료2
      const skillName = cols[0]
      if (/^(지역|유럽|아시아|아프리카|아메리카)/.test(skillName)) continue
      skills.push({
        name: skillName,
        sail: cols[1] || null,
        gunPort: cols[2] || null,
        material1: cols[3] || null,
        material2: cols[4] || null,
      })
      continue
    }

    if (mode === 'acquire') {
      if (/^판매\s*NPC/.test(line)) {
        mode = 'extra'
        continue
      }
      if (!acquireMethod) {
        acquireMethod = line
        acquireType = /구입|교환|아이템|건조|퀘스트/.test(line)
          ? line.includes('구입')
            ? '구입'
            : line.includes('아이템')
              ? '아이템 사용'
              : line
          : line
      }
    }
  }

  if (performance.length < 7) {
    throw new Error('기본 성능 수치(7개)를 찾지 못했습니다.')
  }
  if (load.length < 4) {
    throw new Error('적재 수치(4개)를 찾지 못했습니다.')
  }

  return {
    name,
    slug: slugify(name),
    description: description || null,
    category,
    sizeName,
    formName,
    materialName,
    adventureLv,
    tradeLv,
    battleLv,
    acquireType,
    acquireMethod,
    enhanceCount,
    buildDays,
    shipyardRank,
    durability: performance[0],
    sailVertical: performance[1],
    sailHorizontal: performance[2],
    oar: performance[3],
    turn: performance[4],
    wave: performance[5],
    armor: performance[6],
    cabin: load[0],
    crewRequired: load[1],
    guns: load[2],
    warehouse: load[3],
    caps: {
      durability: caps[0] ?? null,
      sailVertical: caps[1] ?? null,
      sailHorizontal: caps[2] ?? null,
      oar: caps[3] ?? null,
      turn: caps[4] ?? null,
      wave: caps[5] ?? null,
      armor: caps[6] ?? null,
      cabin: caps[7] ?? null,
      guns: caps[8] ?? null,
      warehouse: caps[9] ?? null,
    },
    parts: {
      auxSail: parts[0] ?? 0,
      figurehead: parts[1] ?? 0,
      emblem: parts[2] ?? 0,
      special: parts[3] ?? 0,
      extraArmor: parts[4] ?? 0,
      broadside: parts[5] ?? 0,
      bow: parts[6] ?? 0,
      stern: parts[7] ?? 0,
    },
    skills,
  }
}
