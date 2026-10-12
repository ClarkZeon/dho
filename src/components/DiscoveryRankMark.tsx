/** 발견물 등급: "3성" → ★3 */
export function DiscoveryRankMark({
  rank,
}: {
  rank: number | null | undefined
}) {
  if (rank == null || !Number.isFinite(Number(rank))) return null
  const n = Math.floor(Number(rank))
  return (
    <span className="discovery-rank-mark" aria-label={`${n}성`}>
      <span className="discovery-rank-mark-star" aria-hidden="true">
        ★
      </span>
      <span className="discovery-rank-mark-num">{n}</span>
    </span>
  )
}

type DiscoveryFields = {
  discoveryCategory?: string | null
  discoveryRank?: number | null
  discoveryName?: string | null
}

/** 퀘스트 발견물: [분류] ★n 이름 */
export function QuestDiscoveryLabel({
  quest,
  empty = '-',
}: {
  quest: DiscoveryFields
  empty?: string
}) {
  const has =
    Boolean(quest.discoveryCategory) ||
    quest.discoveryRank != null ||
    Boolean(quest.discoveryName)
  if (!has) return <>{empty}</>
  return (
    <span className="quest-discovery-label">
      {quest.discoveryCategory ? (
        <span className="quest-discovery-cat">
          [{quest.discoveryCategory}]
        </span>
      ) : null}
      <DiscoveryRankMark rank={quest.discoveryRank} />
      {quest.discoveryName ? (
        <span className="quest-discovery-name">{quest.discoveryName}</span>
      ) : null}
    </span>
  )
}
