import { getModuleDef } from '../../lib/detailModules'
import type { QuestDetail } from '../../types'
import { DiscoveryChips, type DiscoveryChipItem } from './DiscoveryChips'

type DiscoveryModuleProps = {
  quest: QuestDetail
  canEdit?: boolean
  /** 카탈로그 점프 — 칩 클릭 */
  onOpenDiscovery?: (item: DiscoveryChipItem) => void
  discoveryBusy?: boolean
}

/**
 * 「발견물」 모듈 — 퀘스트 페이지에 붙는 연결 발견물.
 * 데이터: quest.discoveryName / quest.discoveryRef
 * 클릭: onOpenDiscovery → 카탈로그 점프
 */
export function DiscoveryModule({
  quest,
  canEdit = false,
  onOpenDiscovery,
  discoveryBusy = false,
}: DiscoveryModuleProps) {
  const title = getModuleDef('discovery')?.title ?? '발견물'
  const hasName = Boolean(quest.discoveryName?.trim())
  const hasRef = Boolean(quest.discoveryRef)

  if (!canEdit && !hasName && !hasRef) return null

  const chip = hasName
    ? {
        name: quest.discoveryName!.trim(),
        category: quest.discoveryCategory,
        rank: quest.discoveryRank,
        id: quest.discoveryRef?.id,
        slug: quest.discoveryRef?.slug,
      }
    : null

  return (
    <section className="quest-detail-section" data-module="discovery">
      <h3>{title}</h3>
      {chip ? (
        <DiscoveryChips
          items={[chip]}
          onOpen={
            onOpenDiscovery
              ? (item) => {
                  if (discoveryBusy) return
                  onOpenDiscovery(item)
                }
              : undefined
          }
        />
      ) : (
        <p className="quest-muted">없음</p>
      )}
    </section>
  )
}
