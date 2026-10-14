/**
 * 위키 readBody HTML → 소비품 획득 상세 객체
 * (이름·설명은 HTML에 없으므로 caller가 name 을 넘김)
 */

import { ACQUIRE_METHODS } from './consumableTextParse.mjs'

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
}

function stripTags(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function attr(tag, name) {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i')
  const m = String(tag || '').match(re)
  return m ? decodeEntities(m[2] ?? m[3] ?? '') : ''
}

/** 링크/툴팁 셀 → 표시 이름 (말줄임이면 tooltip 우선) */
function richCellName(html) {
  const raw = String(html || '')
  const a = raw.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)
  const inner = a ? a[1] : raw
  const tip = inner.match(
    /<span\b[^>]*class="[^"]*tooltip[^"]*"[^>]*tooltip="([^"]*)"[^>]*>([\s\S]*?)<\/span>/i,
  )
  if (tip) {
    const tooltip = decodeEntities(tip[1]).trim()
    const visible = stripTags(tip[2])
    if (/가격\s*:/.test(tooltip)) return visible
    if (
      !visible ||
      /…|\.\.\.$/.test(visible) ||
      /noTitle/i.test(tip[0]) ||
      (tooltip && tooltip.length > visible.length)
    ) {
      return tooltip || visible
    }
    return visible
  }
  return stripTags(inner) || stripTags(raw)
}

function priceFromCell(html) {
  const m = String(html || '').match(/tooltip="(가격\s*:[^"]*)"/i)
  return m ? decodeEntities(m[1]).trim() : null
}

function splitTdCells(trHtml) {
  const cells = []
  const re = /<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi
  let m
  while ((m = re.exec(trHtml))) {
    cells.push({
      attrs: m[1] || '',
      html: m[2] || '',
      rowspan: Number(attr(m[1], 'rowspan') || 1) || 1,
    })
  }
  return cells
}

function tableRows(tableHtml) {
  const body = String(tableHtml || '').match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)
  const chunk = body ? body[1] : String(tableHtml || '')
  const rows = []
  const re = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  let m
  while ((m = re.exec(chunk))) rows.push(m[1])
  return rows
}

function firstTable(html) {
  const m = String(html || '').match(/<table\b[^>]*>([\s\S]*?)<\/table>/i)
  return m ? m[0] : ''
}

function parseNamedList(html) {
  /** @type {Array<{ name: string, detail: string|null }>} */
  const items = []
  const re =
    /<a\b[^>]*>([\s\S]*?)<\/a>\s*(?:<span\b[^>]*class="[^"]*extraName[^"]*"[^>]*>([\s\S]*?)<\/span>)?/gi
  let m
  while ((m = re.exec(html))) {
    const name = richCellName(m[0])
    const detail = m[2] ? stripTags(m[2]) || null : null
    if (name) items.push({ name, detail })
  }
  return items
}

function metaValue(html, label) {
  const re = new RegExp(
    `<th\\b[^>]*>\\s*${label}\\s*<\\/th>\\s*<td\\b[^>]*>([\\s\\S]*?)<\\/td>`,
    'i',
  )
  const m = String(html || '').match(re)
  return m ? stripTags(m[1]) || null : null
}

function sectionBlocks(html) {
  /** @type {Array<{ title: string, body: string }>} */
  const out = []
  const re = /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi
  let m
  while ((m = re.exec(html))) {
    out.push({ title: stripTags(m[1]), body: m[2] })
  }
  return out
}

function parsePurchases(bodyHtml) {
  const table = firstTable(bodyHtml)
  if (!table) return []
  /** @type {Array<{ npc: string, region: string, place: string, price: string|null }>} */
  const rows = []
  let npc = ''
  let npcLeft = 0
  for (const tr of tableRows(table)) {
    const cells = splitTdCells(tr)
    if (!cells.length) continue
    // header skip
    if (cells.every((c) => /<th\b/i.test(`<th ${c.attrs}>`) || /판매\s*NPC|지역|장소/.test(stripTags(c.html)))) {
      if (/판매\s*NPC|지역|장소/.test(cells.map((c) => stripTags(c.html)).join(' '))) {
        continue
      }
    }
    let idx = 0
    if (npcLeft <= 0) {
      const c = cells[idx++]
      if (!c) continue
      npc = stripTags(c.html)
      npcLeft = Math.max(1, c.rowspan)
    }
    const regionCell = cells[idx++]
    const placeCell = cells[idx++]
    if (!regionCell || !placeCell) {
      npcLeft -= 1
      continue
    }
    const region = stripTags(regionCell.html)
    const place = parseNamedList(placeCell.html)
      .map((p) => p.name)
      .join(', ') || stripTags(placeCell.html)
    const price = priceFromCell(placeCell.html)
    if (npc && (region || place)) {
      rows.push({ npc, region, place, price })
    }
    npcLeft -= 1
  }
  return rows
}

function parseProductions(bodyHtml) {
  const table = firstTable(bodyHtml)
  if (!table) return []
  const rows = []
  for (const tr of tableRows(table)) {
    const cells = splitTdCells(tr)
    if (cells.length < 2) continue
    const heads = cells.map((c) => stripTags(c.html)).join(' ')
    if (/레시피\s*책|레시피|스킬|재료/.test(heads) && cells.length >= 3) {
      // could be header row inside tbody rarely
      if (/^레시피/.test(heads) || heads.includes('레시피 책')) continue
    }
    const recipeBook = richCellName(cells[0]?.html || '')
    const recipe = richCellName(cells[1]?.html || '')
    const skill = stripTags(cells[2]?.html || '')
    const materials = parseNamedList(cells[3]?.html || '')
      .map((m) => {
        // "이름 N" quantity often after </a>
        return m.name
      })
      .join(', ')
    // keep quantity text from cell if list empty
    const materialsText =
      materials ||
      stripTags(cells[3]?.html || '').replace(/\s+/g, ' ').trim()
    // better: reconstruct materials with quantities from cell
    const matHtml = cells[3]?.html || ''
    const matParts = []
    const matRe =
      /<a\b[^>]*>([\s\S]*?)<\/a>(\s*\d+)?/gi
    let mm
    while ((mm = matRe.exec(matHtml))) {
      const name = richCellName(mm[0])
      const qty = (mm[2] || '').trim()
      if (name) matParts.push(qty ? `${name} ${qty}` : name)
    }
    if (recipeBook || recipe || skill || matParts.length) {
      rows.push({
        recipeBook,
        recipe,
        skill,
        materials: matParts.length ? matParts.join(', ') : materialsText,
      })
    }
  }
  return rows
}

function parseRegionFields(bodyHtml) {
  const table = firstTable(bodyHtml)
  if (!table) return []
  const rows = []
  for (const tr of tableRows(table)) {
    const cells = splitTdCells(tr)
    if (cells.length < 2) continue
    const joined = cells.map((c) => stripTags(c.html)).join(' ')
    if (/^지역/.test(joined) && /필드/.test(joined)) continue
    const region = stripTags(cells[0].html)
    const fields =
      parseNamedList(cells[1].html)
        .map((p) => p.name)
        .join(', ') || stripTags(cells[1].html)
    if (region || fields) rows.push({ region, fields })
  }
  return rows
}

function parsePets(bodyHtml) {
  const table = firstTable(bodyHtml)
  if (!table) return []
  const rows = []
  let category = ''
  let catLeft = 0
  for (const tr of tableRows(table)) {
    const cells = splitTdCells(tr)
    if (!cells.length) continue
    const joined = cells.map((c) => stripTags(c.html)).join(' ')
    if (/분류/.test(joined) && /지역/.test(joined)) continue
    let idx = 0
    if (catLeft <= 0) {
      const c = cells[idx++]
      if (!c) continue
      category = stripTags(c.html)
      catLeft = Math.max(1, c.rowspan)
    }
    const regionCell = cells[idx++]
    const placeCell = cells[idx++]
    if (!regionCell || !placeCell) {
      catLeft -= 1
      continue
    }
    const region = stripTags(regionCell.html)
    const place =
      parseNamedList(placeCell.html)
        .map((p) => p.name)
        .join(', ') || stripTags(placeCell.html)
    if (category || region || place) {
      rows.push({ category, region, place })
    }
    catLeft -= 1
  }
  return rows
}

function parseItemListSection(bodyHtml) {
  const table = firstTable(bodyHtml)
  if (table) {
    const items = []
    for (const tr of tableRows(table)) {
      for (const cell of splitTdCells(tr)) {
        if (/^아이템$/.test(stripTags(cell.html))) continue
        items.push(...parseNamedList(cell.html))
      }
    }
    if (items.length) return items
  }
  const text = stripTags(bodyHtml)
  return text ? [{ name: text, detail: null }] : []
}

/**
 * @param {string} html
 * @param {{ name?: string }} [opts]
 */
export function parseConsumableReadBody(html, opts = {}) {
  const raw = String(html || '').trim()
  if (!raw) throw new Error('readBody HTML이 비어 있습니다.')

  const name = String(opts.name || '').trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('소비품 이름이 필요합니다.')

  const category = metaValue(raw, '분류')
  const useEffect = metaValue(raw, '사용효과')

  /** @type {string[]} */
  const acquireMethods = []
  const tabRe = /<ul\b[^>]*class="[^"]*tab[^"]*"[^>]*>([\s\S]*?)<\/ul>/i
  const tabBlock = raw.match(tabRe)
  if (tabBlock) {
    const liRe = /<li\b[^>]*>[\s\S]*?<span\b[^>]*>([\s\S]*?)<\/span>/gi
    let lm
    while ((lm = liRe.exec(tabBlock[1]))) {
      const label = stripTags(lm[1])
      if (ACQUIRE_METHODS.includes(label) && !acquireMethods.includes(label)) {
        acquireMethods.push(label)
      }
    }
  }

  const purchases = []
  const productions = []
  const quests = []
  const itemUses = []
  const treasureBoxes = []
  const events = []
  const landResurveys = []
  const pets = []

  for (const sec of sectionBlocks(raw)) {
    const title = sec.title.replace(/\s+/g, ' ')
    if (title === '구입') {
      purchases.push(...parsePurchases(sec.body))
    } else if (title === '생산') {
      productions.push(...parseProductions(sec.body))
    } else if (title === '퀘스트') {
      quests.push(...parseItemListSection(sec.body))
    } else if (title === '아이템 사용') {
      itemUses.push(...parseItemListSection(sec.body))
    } else if (title === '트레져박스') {
      treasureBoxes.push(...parseItemListSection(sec.body))
    } else if (title === '이벤트') {
      events.push(...parseItemListSection(sec.body))
    } else if (title === '육지 재조사') {
      landResurveys.push(...parseRegionFields(sec.body))
    } else if (title === '애완동물') {
      pets.push(...parsePets(sec.body))
    }
  }

  if (!acquireMethods.length) {
    const checks = [
      [purchases, '구입'],
      [productions, '생산'],
      [quests, '퀘스트'],
      [itemUses, '아이템 사용'],
      [treasureBoxes, '트레져박스'],
      [events, '이벤트'],
      [landResurveys, '육지 재조사'],
      [pets, '애완동물'],
    ]
    for (const [arr, label] of checks) {
      if (arr.length) acquireMethods.push(label)
    }
  }

  return {
    name,
    description: null,
    category,
    useEffect,
    acquireMethods,
    purchases,
    productions,
    quests,
    itemUses,
    treasureBoxes,
    events,
    landResurveys,
    pets,
  }
}
