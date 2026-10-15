/**
 * 위키형 메모리얼 앨범 텍스트 → DB용 객체
 *
 * 메모리얼 앨범모험가 입문서
 * 모험가에게 유용한
 * 다양한 입문서에 관한 기록.
 *
 * 분류	장비품	보상 NPC	파르네제 공작 (세비야)
 * 보상품	모험 기능 상급교도서(1시간)
 * 항목
 * 아이템	완료	부연 설명
 * 그림감정술
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
  return `memorial-${hash}`
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
  const pipe = t.match(/^메모리얼\s*앨범\s*[|｜]\s*(.+)$/)
  if (pipe) return pipe[1].trim()
  const tab = t.match(/^메모리얼\s*앨범\t+(.+)$/)
  if (tab) return tab[1].trim()
  if (/^메모리얼\s*앨범/.test(t)) {
    return t.replace(/^메모리얼\s*앨범\s*/, '').trim()
  }
  return t
}

function isItemHeader(cols) {
  const joined = cols.join(' ')
  return /아이템/.test(joined) && (/부연/.test(joined) || /설명/.test(joined) || /완료/.test(joined))
}

/**
 * @param {string} text
 */
export function parseMemorialAlbumText(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trimEnd())

  let name = ''
  let description = null
  let category = null
  let rewardNpc = null
  let rewardItem = null
  let itemCount = null
  let altName = null
  /** @type {Array<{ name: string, note: string|null }>} */
  const items = []

  let i = 0
  while (i < lines.length && !lines[i].trim()) i++
  if (i >= lines.length) throw new Error('메모리얼 앨범 텍스트가 비어 있습니다.')

  name = parseTitleName(lines[i].trim())
  i++
  if (!name) throw new Error('메모리얼 앨범 이름이 없습니다.')

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
      /^보상품/.test(t) ||
      /^보상\s*NPC/.test(t) ||
      /^항목/.test(t) ||
      /^추가\s*이름/.test(t)
    ) {
      break
    }
    descLines.push(t)
    i++
  }
  description = descLines.join('\n').trim() || null

  /** @type {null | 'meta' | 'items'} */
  let phase = 'meta'

  while (i < lines.length) {
    const t = lines[i].trim()
    i++
    if (!t) continue
    if (/^선택된\s*항목\s*완료/.test(t)) continue

    if (/^항목(\t|$)/.test(t) || t === '항목') {
      phase = 'items'
      continue
    }

    if (phase === 'meta') {
      if (/^추가\s*이름/.test(t)) {
        const cols = splitTabs(t)
        altName = cols.slice(1).join('\t').trim() || null
        continue
      }
      if (/^항목\s*개수/.test(t)) {
        const raw =
          pickLabeledValue(t, /항목\s*개수/, []) ||
          splitTabs(t).slice(1).join('\t').trim()
        const n = Number(String(raw || '').replace(/,/g, ''))
        if (Number.isFinite(n)) itemCount = n
        continue
      }
      if (
        /^분류/.test(t) ||
        /보상\s*NPC/.test(t) ||
        /^보상품/.test(t)
      ) {
        category =
          pickLabeledValue(t, /분류/, [/보상\s*NPC/, /보상품/]) || category
        rewardNpc =
          pickLabeledValue(t, /보상\s*NPC/, [/분류/, /보상품/]) || rewardNpc
        rewardItem =
          pickLabeledValue(t, /보상품/, [/분류/, /보상\s*NPC/]) || rewardItem
        continue
      }
      continue
    }

    if (phase === 'items') {
      const cols = splitTabs(t)
      if (isItemHeader(cols)) continue
      // 아이템 | 완료 | 부연 설명 — 완료 칸은 비어 있는 경우가 많음
      if (cols.length >= 3) {
        const itemName = cols[0]
        // cols[1] = 완료 (보통 빈칸)
        const note = cols.slice(2).join('\t').trim() || null
        if (itemName) items.push({ name: itemName, note })
      } else if (cols.length === 2) {
        const itemName = cols[0]
        const note = cols[1] || null
        // 헤더 없이 "이름\t부연" 또는 "이름\t" (완료 빈칸)
        if (itemName) {
          items.push({
            name: itemName,
            note: note && note !== '완료' ? note : null,
          })
        }
      } else if (cols.length === 1 && cols[0]) {
        items.push({ name: cols[0], note: null })
      }
    }
  }

  if (itemCount == null && items.length) itemCount = items.length

  return {
    slug: slugify(name),
    name,
    altName,
    description,
    category,
    rewardNpc,
    rewardItem,
    itemCount,
    items,
  }
}
