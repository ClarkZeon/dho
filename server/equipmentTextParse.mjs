/**
 * 위키형 장비품 텍스트 → DB용 객체
 *
 * 장비품동식물도감
 * 여러 동식물의 생태가 적혀있는 책.
 *
 * 분류	장신구	내구도	20
 * 스킬	생물학 +1	메모리얼 앨범 	모험가 입문서
 * 변성연금
 * 정책	스킬	재료	생산품
 * …
 * 획득 방법
 * 퀘스트보물지도메모리얼 앨범
 * 퀘스트	목적지
 * …
 */

import { createHash } from 'node:crypto'

const ACQUIRE_METHODS = [
  '구입',
  '생산',
  '퀘스트',
  '보물지도',
  '메모리얼 앨범',
  '아이템 사용',
  '트레져박스',
  '이벤트',
  '육지 재조사',
  '애완동물',
]

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `equipment-${hash}`
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
  const pipe = t.match(/^장비\s*품\s*[|｜]\s*(.+)$/)
  if (pipe) return pipe[1].trim()
  const tab = t.match(/^장비\s*품\t+(.+)$/)
  if (tab) return tab[1].trim()
  if (/^장비\s*품/.test(t)) return t.replace(/^장비\s*품\s*/, '').trim()
  return t
}

function splitAcquireMethods(line) {
  let rest = String(line || '').replace(/\s+/g, ' ').trim()
  if (!rest) return []
  const found = []
  const ordered = [...ACQUIRE_METHODS].sort((a, b) => b.length - a.length)
  while (rest) {
    let hit = null
    for (const method of ordered) {
      if (rest.startsWith(method)) {
        hit = method
        break
      }
    }
    if (!hit) {
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

function parseSkillBonuses(raw) {
  const text = String(raw || '').trim()
  if (!text) return []
  const parts = text
    .split(/[,，/|｜]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  /** @type {Array<{ name: string, rank: string|null }>} */
  const out = []
  for (const part of parts) {
    const m = part.match(/^(.+?)\s*\+\s*(\d+)\s*$/)
    if (m) {
      out.push({ name: m[1].trim(), rank: m[2] })
      continue
    }
    const m2 = part.match(/^(.+?)\s+(\d+)\s*$/)
    if (m2) {
      out.push({ name: m2[1].trim(), rank: m2[2] })
      continue
    }
    out.push({ name: part, rank: null })
  }
  return out
}

function isPurchaseHeader(cols) {
  const joined = cols.join(' ')
  return /판매\s*NPC/.test(joined) && /지역/.test(joined) && /장소/.test(joined)
}

function isTransmuteHeader(cols) {
  const joined = cols.join(' ')
  return /정책/.test(joined) && /스킬/.test(joined) && /재료/.test(joined)
}

function isQuestHeader(cols) {
  const joined = cols.join(' ')
  return /^퀘스트/.test(cols[0] || '') && /목적지/.test(joined)
}

function emptyRequirements() {
  return {
    fame: null,
    infamy: null,
    gender: null,
    jobClass: null,
    title: null,
    alias: null,
  }
}

/**
 * @param {string} text
 */
export function parseEquipmentText(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trimEnd())

  let name = ''
  let description = null
  let category = null
  let useEffect = null
  let equipSlot = null
  let durability = null
  let attack = null
  let defense = null
  let dressEtiquette = null
  let disguise = null
  /** @type {Array<{ name: string, rank: string|null }>} */
  let skills = []
  /** @type {Array<{ name: string, rank: string|null }>} */
  let equipmentEffects = []
  let memorialAlbum = null
  const requirements = emptyRequirements()
  let nonTradable = false
  /** @type {string[]} */
  let acquireMethods = []
  /** @type {Array<{ npc: string, region: string, place: string, price: string|null }>} */
  const purchases = []
  /** @type {Array<{ policy: string, skills: string, materials: string, product: string }>} */
  const transmutations = []
  /** @type {Array<{ quest: string, destination: string }>} */
  const quests = []
  /** @type {Array<{ name: string, detail: string|null }>} */
  const treasureMaps = []
  /** @type {Array<{ name: string, detail: string|null }>} */
  const memorialAlbums = []

  let i = 0
  while (i < lines.length && !lines[i].trim()) i++
  if (i >= lines.length) throw new Error('장비품 텍스트가 비어 있습니다.')

  name = parseTitleName(lines[i].trim())
  i++
  if (!name) throw new Error('장비품 이름이 없습니다.')

  const descLines = []
  while (i < lines.length) {
    const t = lines[i].trim()
    if (!t) {
      i++
      if (descLines.length) break
      continue
    }
    if (
      /^분류(\t|$)/.test(t) ||
      /^획득\s*방법/.test(t) ||
      /^변성연금/.test(t) ||
      /^장착\s*부위/.test(t) ||
      /^내구도/.test(t) ||
      /^스킬(\t|$)/.test(t) ||
      /^(판매\s*NPC|구입)/.test(t)
    ) {
      break
    }
    descLines.push(t)
    i++
  }
  description = descLines.join('\n').trim() || null

  /** @type {null | 'meta' | 'transmute' | 'acquire'} */
  let phase = 'meta'
  /** @type {null | 'purchase' | 'quest' | 'treasureMap' | 'memorialAlbum'} */
  let acquireMode = null
  let currentNpc = ''

  while (i < lines.length) {
    const raw = lines[i]
    const t = raw.trim()
    i++
    if (!t) continue

    if (/^변성연금/.test(t)) {
      phase = 'transmute'
      acquireMode = null
      continue
    }
    if (/^획득\s*방법/.test(t)) {
      phase = 'acquire'
      acquireMode = null
      const after = t.replace(/^획득\s*방법\s*/, '').trim()
      if (after) {
        const methods = splitAcquireMethods(after)
        if (methods.length) acquireMethods = methods
      }
      continue
    }

    if (phase === 'meta') {
      if (
        /^분류/.test(t) ||
        /사용효과/.test(t) ||
        /장착\s*부위/.test(t) ||
        /내구도/.test(t) ||
        /공격력/.test(t) ||
        /방어력/.test(t) ||
        /복장예절/.test(t) ||
        /변장도/.test(t)
      ) {
        category =
          pickLabeledValue(t, /분류/, [
            /사용효과/,
            /장착\s*부위/,
            /내구도/,
            /공격력/,
            /방어력/,
            /복장예절/,
            /변장도/,
            /스킬/,
            /메모리얼\s*앨범/,
          ]) || category
        useEffect =
          pickLabeledValue(t, /사용효과/, [
            /분류/,
            /장착\s*부위/,
            /내구도/,
            /공격력/,
            /방어력/,
            /스킬/,
          ]) || useEffect
        equipSlot =
          pickLabeledValue(t, /장착\s*부위/, [
            /분류/,
            /사용효과/,
            /내구도/,
            /스킬/,
          ]) || equipSlot
        durability =
          pickLabeledValue(t, /내구도/, [
            /분류/,
            /사용효과/,
            /장착\s*부위/,
            /공격력/,
            /방어력/,
            /스킬/,
            /메모리얼\s*앨범/,
          ]) || durability
        attack =
          pickLabeledValue(t, /공격력/, [/방어력/, /내구도/, /분류/]) || attack
        defense =
          pickLabeledValue(t, /방어력/, [/공격력/, /내구도/, /분류/]) || defense
        dressEtiquette =
          pickLabeledValue(t, /복장예절/, [/변장도/, /분류/]) || dressEtiquette
        disguise =
          pickLabeledValue(t, /변장도/, [/복장예절/, /분류/]) || disguise
        continue
      }

      if (/^스킬(\t|$)/.test(t) || /메모리얼\s*앨범/.test(t)) {
        const skillRaw = pickLabeledValue(t, /스킬/, [/메모리얼\s*앨범/])
        if (skillRaw) skills = parseSkillBonuses(skillRaw)
        memorialAlbum =
          pickLabeledValue(t, /메모리얼\s*앨범/, [/스킬/]) || memorialAlbum
        continue
      }

      if (/^장비효과(\t|$)/.test(t)) {
        const effectRaw = pickLabeledValue(t, /장비효과/, [])
        if (effectRaw) equipmentEffects = parseSkillBonuses(effectRaw)
        continue
      }

      if (/거래\s*불가/.test(t)) {
        nonTradable = true
        continue
      }
      continue
    }

    if (phase === 'transmute') {
      const cols = splitTabs(t)
      if (isTransmuteHeader(cols)) continue
      if (cols.length >= 3) {
        transmutations.push({
          policy: cols[0] || '',
          skills: cols[1] || '',
          materials: cols[2] || '',
          product: cols[3] || '',
        })
      }
      continue
    }

    if (phase === 'acquire') {
      const cols = splitTabs(t)

      if (
        !acquireMethods.length &&
        !isPurchaseHeader(cols) &&
        !isQuestHeader(cols) &&
        !/^판매\s*NPC/.test(t) &&
        !/^(구입|퀘스트|보물지도|메모리얼\s*앨범)$/.test(t)
      ) {
        const methods = splitAcquireMethods(t)
        if (methods.length) {
          acquireMethods = methods
          continue
        }
      }

      if (cols.length === 1 && cols[0] === '구입') {
        acquireMode = 'purchase'
        if (!acquireMethods.includes('구입')) acquireMethods.push('구입')
        continue
      }
      if (isPurchaseHeader(cols) || /^판매\s*NPC/.test(t)) {
        acquireMode = 'purchase'
        if (!acquireMethods.includes('구입')) acquireMethods.push('구입')
        currentNpc = ''
        continue
      }
      if (isQuestHeader(cols) || (cols.length === 1 && cols[0] === '퀘스트')) {
        acquireMode = 'quest'
        if (!acquireMethods.includes('퀘스트')) acquireMethods.push('퀘스트')
        continue
      }
      if (/^보물지도/.test(t)) {
        acquireMode = 'treasureMap'
        if (!acquireMethods.includes('보물지도')) acquireMethods.push('보물지도')
        continue
      }
      if (/^메모리얼\s*앨범/.test(t)) {
        acquireMode = 'memorialAlbum'
        if (!acquireMethods.includes('메모리얼 앨범')) {
          acquireMethods.push('메모리얼 앨범')
        }
        continue
      }

      if (acquireMode === 'purchase') {
        if (cols.length >= 4) {
          const npc = cols[0] || currentNpc
          const region = cols[1] || ''
          const place = cols[2] || ''
          const price = cols[3]?.trim() || null
          if (cols[0]) currentNpc = cols[0]
          if (npc && (region || place)) {
            purchases.push({ npc, region, place, price })
          }
        } else if (cols.length >= 3) {
          const npc = cols[0] || currentNpc
          const region = cols[1] || ''
          const place = cols.slice(2).join('\t').trim()
          if (cols[0]) currentNpc = cols[0]
          if (npc && (region || place)) {
            purchases.push({ npc, region, place, price: null })
          }
        } else if (cols.length === 2 && currentNpc) {
          purchases.push({
            npc: currentNpc,
            region: cols[0],
            place: cols[1],
            price: null,
          })
        }
        continue
      }

      if (acquireMode === 'quest') {
        if (cols.length >= 2) {
          quests.push({
            quest: cols[0] || '',
            destination: cols.slice(1).join('\t').trim(),
          })
        } else if (cols.length === 1 && cols[0]) {
          quests.push({ quest: cols[0], destination: '' })
        }
        continue
      }

      if (acquireMode === 'treasureMap' || acquireMode === 'memorialAlbum') {
        const target =
          acquireMode === 'treasureMap' ? treasureMaps : memorialAlbums
        if (cols.length >= 1 && cols[0]) {
          target.push({
            name: cols[0],
            detail:
              cols.length >= 2 ? cols.slice(1).join('\t').trim() || null : null,
          })
        }
        continue
      }

      // 헤더 없이 퀘스트|… 형태가 오면 퀘스트로 간주
      if (/^(모험|교역|전투)\s*[|｜]/.test(t) || cols.length >= 2) {
        acquireMode = 'quest'
        if (!acquireMethods.includes('퀘스트')) acquireMethods.push('퀘스트')
        if (cols.length >= 2) {
          quests.push({
            quest: cols[0] || '',
            destination: cols.slice(1).join('\t').trim(),
          })
        } else {
          quests.push({ quest: t, destination: '' })
        }
      }
    }
  }

  if (!acquireMethods.length) {
    if (quests.length) acquireMethods.push('퀘스트')
    if (treasureMaps.length) acquireMethods.push('보물지도')
    if (memorialAlbums.length) acquireMethods.push('메모리얼 앨범')
    if (purchases.length) acquireMethods.push('구입')
  }

  return {
    slug: slugify(name),
    name,
    altName: null,
    description,
    category,
    useEffect,
    equipSlot,
    durability,
    attack,
    defense,
    dressEtiquette,
    disguise,
    skills,
    equipmentEffects,
    memorialAlbum,
    requirements,
    nonTradable,
    acquireMethods,
    purchases,
    transmutations,
    quests,
    treasureMaps,
    memorialAlbums,
  }
}
