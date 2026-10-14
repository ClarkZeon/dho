/**
 * 위키형 필드 텍스트 → DB용 객체
 *
 * 필드 | 북미 대륙 서해안
 * 필드 종류	상륙지	지역	북미 서해안
 * 해역	알렉산더 제도 앞바다	좌표	10616, 2776
 * 육지 조사
 * 단계	필수	종류	조사 항목	횟수	획득 완성도	완성도 제한
 * …
 * 육지 재조사 보상
 * 종류	아이템
 * 소비품	…
 */

import { createHash } from 'node:crypto'

function slugify(name) {
  const normalized = String(name).trim().toLowerCase()
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii && ascii.length >= 2) return ascii
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 10)
  return `field-${hash}`
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
  { key: 'fieldKind', re: /필드\s*종류/ },
  { key: 'region', re: /지역/ },
  { key: 'seaArea', re: /해역/ },
  { key: 'coordinates', re: /좌표/ },
]

function isExactMetaLabel(label) {
  const t = String(label || '').trim()
  return /^(필드\s*종류|지역|해역|좌표)$/.test(t)
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
      if (!isExactMetaLabel(label)) continue
      for (const meta of META_LABELS) {
        if (meta.re.test(label)) {
          fields[meta.key] = value
          break
        }
      }
    }
  }
  const stopLabels = META_LABELS.map((m) => m.re)
  for (const meta of META_LABELS) {
    const v = pickLabeledValue(
      line,
      meta.re,
      stopLabels.filter((r) => r !== meta.re),
    )
    if (v) fields[meta.key] = v
  }
}

const TASK_KINDS = /^(채집|퀘스트|조사|전투|인식|낚시|탐색)$/

const COLLECT_TABS = ['탐색', '채집', '조달', '애완동물', '낚시']
const DEST_TABS = ['발견물', '보물지도', '퀘스트']

/** 탭이 뭉개진 "탐색채집조달애완동물" / 정상 탭 분리 모두 처리 */
function matchTabHeader(line, tabs) {
  const trimmed = String(line || '').trim()
  if (!trimmed) return null
  const cols = splitTabs(trimmed).filter(Boolean)
  if (cols.length >= 2 && cols.every((c) => tabs.includes(c))) return cols
  if (tabs.includes(trimmed)) return [trimmed]
  const mashed = trimmed.replace(/\s+/g, '')
  if (mashed === tabs.join('')) return [...tabs]
  // 탐색채집조달애완동물 (낚시 제외 4탭)
  if (mashed === '탐색채집조달애완동물') return ['탐색', '채집', '조달', '애완동물']
  return null
}

function isRequiredCell(value) {
  const t = String(value || '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim()
  if (!t) return false
  if (/^(✗|✘|×|✕|x|X|N|no|false|0|-|없음|무)$/i.test(t)) return false
  // 위키 체크/동그라미/필수 표기
  if (/^(✓|✔|☑|✅|■|●|◎|○|◯|★|☆|※|＊|\*|필수|O|ㅇ|V)$/i.test(t)) {
    return true
  }
  // 종류명이 아닌 짧은 기호는 필수로 간주
  if (t.length <= 2 && !TASK_KINDS.test(t) && !/^\d+$/.test(t)) return true
  return false
}

function parsePercent(value) {
  const t = String(value || '').trim()
  if (!t) return null
  return t
}

function parseCount(value) {
  const t = String(value || '').replace(/,/g, '').trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function parseSurveyTaskCols(cols) {
  // Full: stage, required, kind, item, count, gain, limit
  // Cont (no stage): kind, item?, count, gain  OR  '', '', kind, item, count, gain
  if (/^\d+$/.test(cols[0] || '')) {
    // 필수 열 없이 종류가 바로 오는 경우: 1\t채집\t…
    if (TASK_KINDS.test(cols[1] || '')) {
      return {
        stage: Number(cols[0]),
        required: false,
        kind: cols[1] || null,
        item: cols[2] || null,
        count: parseCount(cols[3]),
        completionGain: parsePercent(cols[4]),
        completionLimit: parsePercent(cols[5]),
      }
    }
    if (cols.length >= 6) {
      return {
        stage: Number(cols[0]),
        required: isRequiredCell(cols[1]),
        kind: cols[2] || null,
        item: cols[3] || null,
        count: parseCount(cols[4]),
        completionGain: parsePercent(cols[5]),
        completionLimit: parsePercent(cols[6]),
      }
    }
    if (cols.length >= 5) {
      return {
        stage: Number(cols[0]),
        required: isRequiredCell(cols[1]),
        kind: cols[2] || null,
        item: cols[3] || null,
        count: parseCount(cols[4]),
        completionGain: parsePercent(cols[5]),
        completionLimit: null,
      }
    }
  }
  // Continuation starting with kind
  // 퀘스트\t\t1\t10%  or  조사\t겹바위\t1\t10%
  if (cols.length >= 3 && TASK_KINDS.test(cols[0])) {
    const itemEmpty = cols[1] === ''
    if (itemEmpty) {
      return {
        stage: null,
        required: false,
        kind: cols[0],
        item: null,
        count: parseCount(cols[2]),
        completionGain: parsePercent(cols[3]),
        completionLimit: null,
      }
    }
    if (!/^\d+$/.test(cols[1])) {
      return {
        stage: null,
        required: false,
        kind: cols[0],
        item: cols[1] || null,
        count: parseCount(cols[2]),
        completionGain: parsePercent(cols[3]),
        completionLimit: null,
      }
    }
    return {
      stage: null,
      required: false,
      kind: cols[0],
      item: null,
      count: parseCount(cols[1]),
      completionGain: parsePercent(cols[2]),
      completionLimit: null,
    }
  }
  return null
}

function parseRewardItems(text) {
  return String(text || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.+?)\s+(\d+)\s*$/)
      if (m) return { name: m[1].trim(), qty: Number(m[2]) }
      return { name: part, qty: null }
    })
}

/**
 * @param {string} text
 */
export function parseFieldText(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!raw) throw new Error('텍스트가 비어 있습니다.')

  const lines = raw.split('\n').map((l) => l.trimEnd())

  let name = ''
  let nameIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    name = line
      .replace(/^필드\s*[|｜]\s*/, '')
      .replace(/^필드\s*/, '')
      .trim()
    nameIdx = i
    break
  }
  name = name.replace(/\s+/g, ' ')
  if (!name) throw new Error('필드 이름이 없습니다.')

  /** @type {Record<string, string>} */
  const meta = {}
  /** @type {Array<{ stage: number, completionLimit: string|null, tasks: Array<{ required: boolean, kind: string|null, item: string|null, count: number|null, completionGain: string|null }> }>} */
  const landSurveys = []
  /** @type {Array<{ kind: string, items: Array<{ name: string, qty: number|null }>, raw: string }>} */
  const resurveyRewards = []
  /** @type {Array<{ kind: string, name: string }>} */
  const linkedPlaces = []
  /** @type {Array<{ source: string, name: string, rank: number|null, type: string|null, recommendSpot: string|null, canExchange: boolean|null, canRelease: boolean|null }>} */
  const collectItems = []
  /** @type {Array<{ source: string, discovery: string, content: string }>} */
  const destinations = []
  /** @type {Array<{ level: number|null, trait: string|null, names: string[] }>} */
  const landNpcs = []

  let mode = 'meta' // meta | linked | map | survey | rewards | collect | dest | npc
  let currentStage = null
  let collectSource = '탐색'
  let destSource = '보물지도'

  for (let i = nameIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    if (/^필드\s*지도/.test(line) || /^지도\s*출처/.test(line)) {
      mode = 'map'
      continue
    }
    if (/^연결된\s*장소/.test(line)) {
      mode = 'linked'
      continue
    }
    if (/^육지\s*조사/.test(line)) {
      mode = 'survey'
      continue
    }
    if (/^육지\s*재조사\s*보상|^재조사\s*보상/.test(line)) {
      mode = 'rewards'
      continue
    }
    if (/^수집\s*아이템/.test(line)) {
      mode = 'collect'
      collectSource = '탐색'
      continue
    }
    if (/^목적지/.test(line)) {
      mode = 'dest'
      destSource = '발견물'
      continue
    }
    if (/^육상\s*NPC/.test(line)) {
      mode = 'npc'
      continue
    }
    if (
      (mode === 'linked' || mode === 'meta') &&
      /^종류(\t|$)/.test(line) &&
      /내용/.test(line)
    ) {
      mode = 'linked'
      continue
    }
    if (mode === 'survey' && /^단계\t|^단계\s/.test(line)) continue
    if (mode === 'rewards' && /^종류\t|^종류\s/.test(line) && /아이템/.test(line)) {
      continue
    }

    if (mode === 'map') continue

    if (mode === 'linked' || (mode === 'meta' && /^(\d+\s*차\s*)?필드\t/.test(line))) {
      const cols = splitTabs(line)
      if (cols.length >= 2) {
        const kind = cols[0]
        const placeName = cols.slice(1).join(' ').replace(/\s+/g, ' ').trim()
        if (kind && placeName && !/^(종류|내용)$/.test(kind)) {
          linkedPlaces.push({ kind, name: placeName })
          mode = 'linked'
        }
      }
      if (mode === 'meta') applyMetaLine(line, meta)
      continue
    }

    if (mode === 'meta') {
      applyMetaLine(line, meta)
      continue
    }

    if (mode === 'survey') {
      const cols = splitTabs(line)
      const task = parseSurveyTaskCols(cols)
      if (!task || !task.kind) continue
      if (task.stage != null) {
        currentStage = {
          stage: task.stage,
          completionLimit: task.completionLimit,
          tasks: [],
        }
        landSurveys.push(currentStage)
      } else if (!currentStage) {
        currentStage = {
          stage: landSurveys.length + 1,
          completionLimit: null,
          tasks: [],
        }
        landSurveys.push(currentStage)
      }
      currentStage.tasks.push({
        required: task.required,
        kind: task.kind,
        item: task.item,
        count: task.count,
        completionGain: task.completionGain,
      })
      continue
    }

    if (mode === 'rewards') {
      const cols = splitTabs(line)
      if (cols.length < 2) continue
      const kind = cols[0]
      const itemsText = cols.slice(1).join('\t')
      if (!kind || !itemsText) continue
      if (/^(종류|아이템)$/.test(kind)) continue
      resurveyRewards.push({
        kind,
        items: parseRewardItems(itemsText),
        raw: itemsText,
      })
      continue
    }

    if (mode === 'collect') {
      const tabs = matchTabHeader(line, COLLECT_TABS)
      if (tabs) {
        collectSource = tabs[0]
        continue
      }
      if (/^랭크\t|^랭크$/.test(line)) continue
      const cols = splitTabs(line)
      if (cols.length === 1 && COLLECT_TABS.includes(cols[0])) {
        collectSource = cols[0]
        continue
      }
      if (
        cols.length === 1 &&
        cols[0] &&
        !/^\d+$/.test(cols[0]) &&
        !COLLECT_TABS.includes(cols[0])
      ) {
        collectItems.push({
          source: collectSource || '기타',
          name: cols[0],
          rank: null,
          type: null,
          recommendSpot: null,
          canExchange: null,
          canRelease: null,
        })
        continue
      }
      if (cols.length >= 3 && /^\d+$/.test(cols[0])) {
        const rank = Number(cols[0])
        const type = cols[1] || null
        const names = cols
          .slice(2)
          .join('\t')
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean)
        for (const itemName of names) {
          collectItems.push({
            source: collectSource || '기타',
            name: itemName,
            rank,
            type,
            recommendSpot: null,
            canExchange: null,
            canRelease: null,
          })
        }
      }
      continue
    }

    if (mode === 'dest') {
      const tabs = matchTabHeader(line, DEST_TABS)
      if (tabs) {
        destSource = tabs[0]
        continue
      }
      if (/^발견물\t|^발견물$/.test(line)) continue
      const cols = splitTabs(line)
      if (cols.length === 1 && DEST_TABS.includes(cols[0])) {
        destSource = cols[0]
        continue
      }
      if (cols.length >= 2 && cols[0] && !/^(발견물|내용)$/.test(cols[0])) {
        destinations.push({
          source: destSource || '발견물',
          discovery: cols[0],
          content: cols.slice(1).join('\t').trim(),
        })
      } else if (
        cols.length === 1 &&
        cols[0] &&
        !DEST_TABS.includes(cols[0]) &&
        !/^(발견물|내용)$/.test(cols[0])
      ) {
        destinations.push({
          source: destSource || '발견물',
          discovery: '',
          content: cols[0],
        })
      }
      continue
    }

    if (mode === 'npc') {
      if (/^레벨/.test(line)) continue
      const cols = splitTabs(line)
      if (cols.length >= 1 && /^\d+$/.test(cols[0])) {
        const namesText = (cols[2] ?? cols.slice(2).join('\t')).trim()
        const names = namesText
          ? namesText
              .split(/[,，]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : []
        landNpcs.push({
          level: Number(cols[0]),
          trait: cols[1] ? cols[1].trim() || null : null,
          names,
        })
      }
    }
  }

  // 위키 텍스트 복사 시 필수(✓) 열이 비는 경우가 많아,
  // 단계에 필수 표시가 하나도 없으면 첫 조사 항목을 필수로 둔다.
  // 5단계는 기본적으로 필수 없음(선택).
  for (const stage of landSurveys) {
    if (!stage.tasks.length) continue
    if (Number(stage.stage) === 5) continue
    if (!stage.tasks.some((task) => task.required)) {
      stage.tasks[0].required = true
    }
  }

  const { coordX, coordY } = parseCoordinates(meta.coordinates)

  return {
    name,
    slug: slugify(name),
    altName: null,
    description: null,
    fieldKind: meta.fieldKind || null,
    region: meta.region || null,
    seaArea: meta.seaArea || null,
    coordX,
    coordY,
    linkedPlaces,
    landSurveys,
    resurveyRewards,
    collectItems,
    destinations,
    landNpcs,
  }
}
