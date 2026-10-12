/** 발견 방법 표시: [퀘스트] 모험 | 이름 (조건) - 도시 */
export function formatDiscoveryAcquire(discovery: {
  acquireType?: string | null
  acquireName?: string | null
}) {
  const type = String(discovery.acquireType || '').trim()
  const name = String(discovery.acquireName || '').trim()
  if (type && name) return `[${type}] ${name}`
  if (type) return `[${type}]`
  return name
}
