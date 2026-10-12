import type { PortDetail } from '../types'

export function matchesPortQuery(port: PortDetail, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const haystack = [
    port.name,
    port.slug,
    port.description,
    port.category,
    port.region,
    port.seaArea,
    port.entryPermit,
    port.culture,
    port.language,
  ]
    .filter((v) => v != null && v !== '')
    .join(' ')
    .toLowerCase()

  return haystack.includes(q)
}
