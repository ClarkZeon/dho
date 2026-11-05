import { getModuleDef } from '../../lib/detailModules'
import type { QuestDetail } from '../../types'
import { DiscoveryChips } from './DiscoveryChips'

type DiscoveryRef = { id: number; slug: string; name: string }

type DiscoveryModuleProps = {
  quest: QuestDetail
  canEdit?: boolean
  discoveryLoading?: boolean
  discoveryError?: string
  onOpenDiscovery?: (ref: DiscoveryRef) => void
}

/**
 * 「발견물」 모듈 — 퀘스트 페이지에 붙는 연결 발견물.
 * 데이터: quest.discoveryName / quest.discoveryRef
 * 클릭: onOpenDiscovery → 발견물 상세
 */
export function DiscoveryModule({
  quest,
  canEdit = false,
  discoveryLoading = false,
  discoveryError = '',
  onOpenDiscovery,
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
        <>
          <DiscoveryChips
            items={[chip]}
            onOpen={
              onOpenDiscovery
                ? (item) => {
                    if (item.id == null || !item.slug) return
                    onOpenDiscovery({
                      id: item.id,
                      slug: item.slug,
                      name: item.name,
                    })
                  }
                : undefined
            }
          />
          {discoveryLoading ? (
            <p className="form-note">발견물 불러오는 중…</p>
          ) : null}
          {discoveryError ? (
            <p className="form-note error" role="alert">
              {discoveryError}
            </p>
          ) : null}
        </>
      ) : (
        <p className="quest-muted">없음</p>
      )}
    </section>
  )
}
