import type { ReactNode } from 'react'
import { formatDiscoveryAcquire } from '../../lib/discoveryAcquire'
import { getModuleDef } from '../../lib/detailModules'
import type {
  DiscoveryDetail,
  DiscoveryQuestRef,
  QuestSkillReq,
} from '../../types'

type QuestModuleProps = {
  discovery: DiscoveryDetail
  canEdit?: boolean
  onOpenQuest?: (quest: DiscoveryQuestRef) => void
}

type QuestEntry = {
  key: string
  /** 표시용 원문 라벨 (파싱 폴백) */
  label: string
  quest: DiscoveryQuestRef | null
  /** 연결 퀘스트 태그 (예: 지도) */
  tag?: string | null
}

/** `[퀘스트] 모험 | 이름 (스킬) - 장소` */
function splitAcquireLabel(label: string | null | undefined): {
  kind: string | null
  detail: string
  places: string | null
} {
  const raw = String(label || '').trim()
  if (!raw) return { kind: null, detail: '', places: null }

  let body = raw
  let kind: string | null = null
  const pipeParts = body.split(/\s*\|\s*/)
  if (pipeParts.length >= 2) {
    kind = pipeParts[0].trim() || null
    body = pipeParts.slice(1).join(' | ').trim()
  }

  let places: string | null = null
  const dash = body.match(/^(.*?)\s+-\s+(.+)$/)
  if (dash) {
    body = dash[1].trim()
    places = dash[2].trim() || null
  }

  // 이름 (스킬절) 에서 이름만
  const nameOnly = body.replace(/\s*\([^)]*\)\s*$/, '').trim()
  return { kind, detail: nameOnly || body, places }
}

function KindBadge({ kind }: { kind: string | null | undefined }) {
  const raw = String(kind || '').trim()
  if (!raw) return null
  const matched = raw.match(/^\[([^\]]+)\]\s*(.*)$/)
  if (matched) {
    const head = matched[1].trim()
    const type = matched[2].trim()
    return (
      <span className="quest-cat-label">
        <em className="quest-cat-bracket">[{head}]</em>
        {type ? <span className="quest-cat-type">{type}</span> : null}
      </span>
    )
  }
  return (
    <span className="quest-cat-label">
      <span className="quest-cat-type">{raw}</span>
    </span>
  )
}

function DifficultyStars({ value }: { value: number | null | undefined }) {
  if (value == null) return null
  const filled = Math.max(0, Math.min(10, value))
  return (
    <span className="quest-stars" aria-label={`난이도 ${filled}`}>
      {Array.from({ length: Math.min(filled, 10) || 0 }, (_, i) => (
        <span key={i} className="is-on">
          ★
        </span>
      ))}
      <em>{filled}</em>
    </span>
  )
}

function SkillChips({ skills }: { skills: QuestSkillReq[] | null | undefined }) {
  const list = (skills || []).filter((s) => s.name?.trim())
  if (list.length === 0) return null
  return (
    <ul className="quest-skill-chips">
      {list.map((skill, idx) => (
        <li key={`${skill.name}-${skill.level}-${idx}`}>
          <span>{skill.name}</span>
          {skill.level != null && <em>Lv.{skill.level}</em>}
        </li>
      ))}
    </ul>
  )
}

function PlaceChips({ places }: { places: string | null | undefined }) {
  const chips = String(places || '')
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (chips.length === 0) return null
  return (
    <ul className="quest-skill-chips discovery-quest-place-chips">
      {chips.map((place) => (
        <li key={place}>
          <span>{place}</span>
        </li>
      ))}
    </ul>
  )
}

function QuestRefButton({
  quest,
  children,
  onOpenQuest,
}: {
  quest: DiscoveryQuestRef
  children: ReactNode
  onOpenQuest?: (quest: DiscoveryQuestRef) => void
}) {
  if (!onOpenQuest) {
    return <span className="discovery-quest-link is-static">{children}</span>
  }
  return (
    <button
      type="button"
      className="discovery-quest-link"
      onClick={() => onOpenQuest(quest)}
    >
      {children}
    </button>
  )
}

function QuestEntryCard({
  item,
  onOpenQuest,
}: {
  item: QuestEntry
  onOpenQuest?: (quest: DiscoveryQuestRef) => void
}) {
  const parsed = splitAcquireLabel(item.label)
  const quest = item.quest
  const kind =
    parsed.kind ||
    (item.tag
      ? `[${item.tag}]`
      : quest?.category
        ? `[퀘스트] ${quest.category}`
        : null)
  const title =
    quest?.name ||
    parsed.detail ||
    item.label.replace(/^\[[^\]]+\]\s*/, '').trim() ||
    '-'
  const places = quest?.requestPlaces?.trim() || parsed.places
  const skills = quest?.skills
  const difficulty = quest?.difficulty ?? null

  return (
    <li className="discovery-quest-card">
      <div className="discovery-quest-card-head">
        <KindBadge kind={kind} />
        {difficulty != null ? <DifficultyStars value={difficulty} /> : null}
      </div>
      <strong className="discovery-quest-card-title">
        {quest ? (
          <QuestRefButton quest={quest} onOpenQuest={onOpenQuest}>
            {title}
          </QuestRefButton>
        ) : (
          title
        )}
      </strong>
      <SkillChips skills={skills} />
      <PlaceChips places={places} />
    </li>
  )
}

/**
 * 발견물 페이지에 붙는 「퀘스트」 모듈 (여러 개 가능).
 *
 * 위키의 「발견 방법」 행 + 「연결 지도/퀘스트」를 합친 목록:
 * 1) acquireQuest / acquireName (주 발견 방법)
 * 2) linkedQuests (추가 연결 퀘스트)
 */
export function QuestModule({
  discovery,
  canEdit = false,
  onOpenQuest,
}: QuestModuleProps) {
  const moduleTitle = getModuleDef('quest')?.title ?? '퀘스트'
  const entries = collectQuestEntries(discovery)

  if (!canEdit && entries.length === 0) return null

  return (
    <section className="quest-detail-section" data-module="quest">
      <h3>{moduleTitle}</h3>
      {entries.length > 0 ? (
        <ul className="discovery-quest-list">
          {entries.map((item) => (
            <QuestEntryCard
              key={item.key}
              item={item}
              onOpenQuest={onOpenQuest}
            />
          ))}
        </ul>
      ) : (
        <p className="quest-muted">없음</p>
      )}
    </section>
  )
}

function collectQuestEntries(discovery: DiscoveryDetail): QuestEntry[] {
  const entries: QuestEntry[] = []
  const seen = new Set<string>()

  function push(entry: QuestEntry) {
    const dedupe = entry.quest
      ? `id:${entry.quest.id}`
      : `raw:${entry.label}`
    if (seen.has(dedupe)) return
    seen.add(dedupe)
    entries.push(entry)
  }

  const acquireLabel = formatDiscoveryAcquire(discovery)?.trim()
  if (discovery.acquireQuest || acquireLabel) {
    push({
      key: discovery.acquireQuest
        ? `acquire:${discovery.acquireQuest.id}`
        : `acquire:${acquireLabel}`,
      label: acquireLabel || discovery.acquireQuest?.name || '-',
      quest: discovery.acquireQuest,
    })
  }

  for (const [index, item] of (discovery.linkedQuests || []).entries()) {
    const label = item.tag
      ? `[${item.tag}] ${item.quest?.name || item.title}`
      : item.quest?.name || item.raw
    if (!String(label || '').trim()) continue
    push({
      key: item.quest
        ? `linked:${item.quest.id}`
        : `linked:${item.raw}-${index}`,
      label,
      quest: item.quest,
      tag: item.tag,
    })
  }

  return entries
}
