import type { QuestDetail } from '../types'

export function matchesQuestQuery(quest: QuestDetail, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const haystack = [
    quest.name,
    quest.slug,
    quest.description,
    quest.category,
    quest.questType,
    quest.difficulty,
    quest.requestPlaces,
    quest.destination,
    quest.discoveryCategory,
    quest.discoveryRank,
    quest.discoveryName,
    quest.walkthrough,
    quest.progress,
    ...(quest.skills || []).flatMap((s) => [s.name, s.level]),
    ...(quest.rewardItems || []).map((i) => i.name),
    ...(quest.chainQuests || []).map((c) => c.name),
    ...(quest.linkedQuests || []).map((c) => c.name),
  ]
    .filter((v) => v != null && v !== '')
    .join(' ')
    .toLowerCase()

  return haystack.includes(q)
}
