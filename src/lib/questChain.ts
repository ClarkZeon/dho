import type { QuestChainItem } from '../types'

const QUEST_TAG_RE = /[\[［]퀘스트[\]］]/
const LINKED_HEADING_RE = /연결\s*지도/

function itemText(item: QuestChainItem) {
  return [item.raw, item.name, item.category].filter(Boolean).join(' ')
}

function isLinkedHeading(item: QuestChainItem) {
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

function isLinkedQuest(item: QuestChainItem) {
  return QUEST_TAG_RE.test(itemText(item))
}

function stripTag(item: QuestChainItem): QuestChainItem {
  const category = item.category?.replace(QUEST_TAG_RE, '').trim()
  return { ...item, category: category || undefined }
}

export function splitChainAndLinked(items: QuestChainItem[] | undefined) {
  const chainQuests: QuestChainItem[] = []
  const linkedQuests: QuestChainItem[] = []
  let inLinked = false
  for (const item of items || []) {
    if (isLinkedHeading(item)) {
      inLinked = true
      continue
    }
    if (isLinkedQuest(item)) {
      inLinked = true
      linkedQuests.push(stripTag(item))
      continue
    }
    if (inLinked) {
      linkedQuests.push(stripTag(item))
      continue
    }
    chainQuests.push(item)
  }
  return { chainQuests, linkedQuests }
}
