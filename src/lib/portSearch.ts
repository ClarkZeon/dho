import type { PortDetail } from '../types'

export function matchesPortQuery(port: PortDetail, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const haystack = [
    port.name,
    port.altName,
    port.slug,
    port.description,
    port.category,
    port.region,
    port.seaArea,
    port.entryPermit,
    port.culture,
    port.language,
    port.facilities,
    port.flagQuest,
    ...(port.characters || []).map((c) => c.name),
    ...(port.linkedPlaces || []).map((p) => `${p.kind} ${p.content}`),
    ...(port.saleItems || []).map((s) => `${s.vendor} ${s.item}`),
  ]
    .filter((v) => v != null && v !== '')
    .join(' ')
    .toLowerCase()

  return haystack.includes(q)
}
