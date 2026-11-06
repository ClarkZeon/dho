import type { QuestChainItem } from '../types'

const QUEST_TAG_RE = /[\[［]퀘스트[\]］]/
const MAP_TAG_RE = /[\[［](?:보물)?지도[\]］]/
const LINKED_HEADING_RE = /연결\s*지도/

type ChainItemRaw = QuestChainItem & { relation?: string }

function itemText(item: ChainItemRaw) {
  return [item.raw, item.name, item.category].filter(Boolean).join(' ')
}

/** 발견 방법 카드형이면 퀘스트 (`모험 | 이름 (난이도 스킬) - 장소`) */
function looksLikeQuestCard(item: ChainItemRaw) {
  if (QUEST_TAG_RE.test(itemText(item))) return true
  if (MAP_TAG_RE.test(itemText(item))) return false
  if (item.difficulty != null && Boolean(item.name?.trim())) return true
  const raw = String(item.raw || '').trim()
  return /\|/.test(raw) && /\([⭐★*]?\s*\d+/.test(raw)
}

function isLinkedHeading(item: ChainItemRaw) {
  const text = itemText(item)
  if (!LINKED_HEADING_RE.test(text)) return false
  if (
    item.difficulty != null &&
    item.name &&
    !LINKED_HEADING_RE.test(item.name)
  ) {
    return false
  }
  return (
    !item.name ||
    LINKED_HEADING_RE.test(item.name) ||
    LINKED_HEADING_RE.test(item.raw || '')
  )
}

function isLinkedMarked(item: ChainItemRaw) {
  if (item.linkKind === 'quest' || item.linkKind === 'map') return true
  if (item.relation === 'linked') return true
  return QUEST_TAG_RE.test(itemText(item))
}

function stripTag(
  item: ChainItemRaw,
  fallback: 'quest' | 'map',
): QuestChainItem {
  const text = itemText(item)
  const category = item.category?.replace(QUEST_TAG_RE, '').trim()
  let linkKind: 'quest' | 'map'
  if (MAP_TAG_RE.test(text)) linkKind = 'map'
  else if (QUEST_TAG_RE.test(text) || looksLikeQuestCard(item)) linkKind = 'quest'
  else if (item.linkKind === 'quest' || item.linkKind === 'map') {
    linkKind = item.linkKind
  } else {
    linkKind = fallback
  }
  const { relation: _relation, ...rest } = item
  return {
    ...rest,
    category: category || undefined,
    linkKind,
  }
}

/**
 * 연결 지도/퀘스트 구분.
 * 발견 방법 카드형(종류·난이도·장소·스킬)이면 퀘스트.
 */
export function resolveLinkedKind(
  item: QuestChainItem,
): 'quest' | 'map' {
  const text = itemText(item)
  if (MAP_TAG_RE.test(text)) return 'map'
  if (QUEST_TAG_RE.test(text) || looksLikeQuestCard(item)) return 'quest'
  if (item.linkKind === 'map') return 'map'
  if (item.linkKind === 'quest') return 'quest'
  return 'quest'
}

export function splitChainAndLinked(items: QuestChainItem[] | undefined) {
  const chainQuests: QuestChainItem[] = []
  const linkedQuests: QuestChainItem[] = []
  let inLinked = false
  for (const raw of items || []) {
    const item = raw as ChainItemRaw
    if (isLinkedHeading(item)) {
      inLinked = true
      continue
    }
    if (isLinkedMarked(item)) {
      inLinked = true
      linkedQuests.push(stripTag(item, 'quest'))
      continue
    }
    if (inLinked) {
      // 연결 섹션에서 태그 없는 줄 = 지도
      linkedQuests.push(stripTag(item, 'map'))
      continue
    }
    chainQuests.push(item)
  }
  return { chainQuests, linkedQuests }
}
