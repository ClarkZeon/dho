import type { RegionDetail } from '../types'

export function matchesRegionQuery(region: RegionDetail, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const haystack = [
    region.name,
    region.altName,
    region.description,
    ...(region.seaGroups || []).flatMap((g) => [g.group, ...g.seaAreas]),
  ]
    .filter((v) => v != null && v !== '')
    .join(' ')
    .toLowerCase()

  return haystack.includes(q)
}
