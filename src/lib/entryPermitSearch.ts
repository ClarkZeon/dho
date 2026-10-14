import type { EntryPermitDetail } from '../types'

export function matchesEntryPermitQuery(
  permit: EntryPermitDetail,
  query: string,
) {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const haystack = [
    permit.name,
    permit.altName,
    permit.description,
    permit.requirement,
    ...(permit.cityQuests || []).flatMap((c) => [
      c.city,
      ...c.quests.map((quest) => `${quest.kind} ${quest.name}`),
    ]),
  ]
    .filter((v) => v != null && v !== '')
    .join(' ')
    .toLowerCase()

  return haystack.includes(q)
}
