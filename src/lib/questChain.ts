import type { QuestChainItem } from '../types'

const QUEST_TAG_RE = /[\[［]퀘스트[\]］]/
const LINKED_HEADING_RE = /연결\s*지도/

type ChainItemRaw = QuestChainItem & { relation?: string }

function itemText(item: ChainItemRaw) {
  return [item.raw, item.name, item.category].filter(Boolean).join(' ')
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
  const fromTag = QUEST_TAG_RE.test(itemText(item))
  const category = item.category?.replace(QUEST_TAG_RE, '').trim()
  // [퀘스트] 태그가 보이면 무조건 퀘스트. 애매하면 퀘스트(기본).
  const linkKind = fromTag
    ? 'quest'
    : item.linkKind === 'quest' || item.linkKind === 'map'
      ? item.linkKind
      : fallback
  const { relation: _relation, ...rest } = item
  return {
    ...rest,
    category: category || undefined,
    linkKind,
  }
}

/** 연결 지도/퀘스트 구분. [퀘스트]·linkKind 없으면 퀘스트로 본다. */
export function resolveLinkedKind(
  item: QuestChainItem,
): 'quest' | 'map' {
  if (QUEST_TAG_RE.test(itemText(item))) return 'quest'
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
