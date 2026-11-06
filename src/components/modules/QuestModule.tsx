import { formatDiscoveryAcquire } from '../../lib/discoveryAcquire'
import { formatQuestSkillLabel } from '../../lib/questSkills'
import type {
  DiscoveryDetail,
  DiscoveryQuestRef,
  QuestSkillReq,
} from '../../types'

export type QuestJumpTarget = {
  name: string
  slug?: string
  id?: number
}

type QuestModuleProps = {
  discovery: DiscoveryDetail
  canEdit?: boolean
  /** 카탈로그 점프 */
  onOpenQuest?: (target: QuestJumpTarget) => void
  discoveryBusy?: boolean
}

type QuestEntry = {
  key: string
  /** 표시용 원문 라벨 (파싱 폴백) */
  label: string
  quest: DiscoveryQuestRef | null
  /** 연결 퀘스트 태그 (예: 퀘스트, 보물지도) */
  tag?: string | null
  /** 연결 항목 — 지도일 때만 뱃지 */
  linkKind?: 'quest' | 'map' | null
}

/** `[퀘스트] 모험 | 이름 (스킬) - 장소` */
function splitAcquireLabel(label: string | null | undefined): {
  kind: string | null
  detail: string
  places: string | null
  difficulty: number | null
  skills: QuestSkillReq[]
} {
  const raw = String(label || '').trim()
  if (!raw) {
    return { kind: null, detail: '', places: null, difficulty: null, skills: [] }
  }

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

  let difficulty: number | null = null
  let skills: QuestSkillReq[] = []
  const paren = body.match(/^(.*?)\s*\(([⭐★*]?\s*.+)\)\s*$/)
  if (paren) {
    body = paren[1].trim()
    const inner = paren[2].replace(/^[⭐★*]\s*/, '').trim()
    const m = inner.match(/^(\d+)\s+(.*)$/)
    if (m) {
      difficulty = Number(m[1])
      skills = parseSkillClause(m[2])
    } else if (/^\d+$/.test(inner)) {
      difficulty = Number(inner)
    } else {
      skills = parseSkillClause(inner)
    }
  }

  return {
    kind,
    detail: body || raw,
    places,
    difficulty,
    skills,
  }
}

function parseSkillClause(text: string): QuestSkillReq[] {
  return String(text || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.*?)(?:\s+|랭크\s*)(\d+)\s*\**\s*$/)
      if (!m) return { name: part.replace(/\*+\s*$/u, '').trim(), level: null }
      return {
        name: m[1].trim().replace(/\*+\s*$/u, '').trim(),
        level: Number(m[2]),
      }
    })
    .filter((s) => s.name)
}

function categoryLabel(
  kind: string | null,
  tag: string | null | undefined,
  quest: DiscoveryQuestRef | null,
) {
  if (quest?.category?.trim()) return quest.category.trim()
  if (tag?.trim() && !/^퀘스트|보물지도|지도$/u.test(tag.trim())) {
    return tag.trim()
  }
  const raw = String(kind || '').trim()
  if (!raw) return null
  const matched = raw.match(/^\[([^\]]+)\]\s*(.*)$/)
  if (matched) {
    return matched[2].trim() || matched[1].trim() || null
  }
  return raw
}

/** 발견 방법 카드형이면 퀘스트 */
function looksLikeQuestAcquireLabel(label: string) {
  const raw = String(label || '').trim()
  if (!raw) return false
  if (/[\[［](?:보물)?지도[\]］]/u.test(raw)) return false
  if (/[\[［]퀘스트[\]］]/u.test(raw)) return true
  return /\|/.test(raw) && /\([⭐★*]?\s*\d+/.test(raw)
}

function resolveLinkKind(
  tag: string | null | undefined,
  label: string,
  hasQuestRef = false,
): 'quest' | 'map' {
  const t = String(tag || '').trim()
  if (/^퀘스트$/u.test(t)) return 'quest'
  if (/보물지도|지도/u.test(t)) return 'map'
  if (/[\[［]퀘스트[\]］]/u.test(label)) return 'quest'
  if (/[\[［](?:보물)?지도[\]］]/u.test(label)) return 'map'
  if (hasQuestRef || looksLikeQuestAcquireLabel(label)) return 'quest'
  if (t) return 'quest'
  return 'map'
}

function QuestEntryCard({
  item,
  onOpenQuest,
  busy = false,
}: {
  item: QuestEntry
  onOpenQuest?: (target: QuestJumpTarget) => void
  busy?: boolean
}) {
  const parsed = splitAcquireLabel(item.label)
  const quest = item.quest
  const title =
    quest?.name ||
    parsed.detail ||
    item.label.replace(/^\[[^\]]+\]\s*/, '').trim() ||
    '-'
  const places = quest?.requestPlaces?.trim() || parsed.places
  const skills =
    quest?.skills && quest.skills.length > 0 ? quest.skills : parsed.skills
  const difficulty = quest?.difficulty ?? parsed.difficulty
  const category = categoryLabel(parsed.kind, item.tag, quest)
  const jumpName = (quest?.name || title).trim()
  const canJump = Boolean(onOpenQuest && jumpName && jumpName !== '-')
  const linkKind = item.linkKind || null
  const meta = [
    category,
    difficulty != null ? `난이도 ${difficulty}` : null,
    places,
  ]
    .filter(Boolean)
    .join(' · ')
  const skillsLine =
    skills.length > 0
      ? skills
          .map((s) => formatQuestSkillLabel(s))
          .filter(Boolean)
          .join(', ')
      : ''

  const body = (
    <>
      <div className="quest-chain-title-row">
        <strong>{title}</strong>
        {linkKind ? (
          <span
            className={`quest-link-kind is-${linkKind}`}
            aria-label={linkKind === 'map' ? '지도' : '퀘스트'}
          >
            {linkKind === 'map' ? '지도' : '퀘스트'}
          </span>
        ) : null}
      </div>
      {meta ? <p>{meta}</p> : null}
      {skillsLine ? (
        <p className="quest-chain-skills">{skillsLine}</p>
      ) : null}
    </>
  )

  return (
    <li className={canJump ? 'is-jumpable' : undefined}>
      {canJump ? (
        <button
          type="button"
          className="quest-chain-jump"
          disabled={busy}
          onClick={() =>
            onOpenQuest?.({
              name: jumpName,
              slug: quest?.slug,
              id: quest?.id,
            })
          }
        >
          {body}
        </button>
      ) : (
        <div>{body}</div>
      )}
    </li>
  )
}

function QuestEntryList({
  entries,
  onOpenQuest,
  busy = false,
}: {
  entries: QuestEntry[]
  onOpenQuest?: (target: QuestJumpTarget) => void
  busy?: boolean
}) {
  return (
    <ul className="quest-chain is-linked">
      {entries.map((item) => (
        <QuestEntryCard
          key={item.key}
          item={item}
          onOpenQuest={onOpenQuest}
          busy={busy}
        />
      ))}
    </ul>
  )
}

/**
 * 발견물 상세 — 「발견 방법」과 「연결 지도/퀘스트」를 분리 표기.
 * 연결 항목은 우측 퀘스트/지도 뱃지.
 */
export function QuestModule({
  discovery,
  canEdit = false,
  onOpenQuest,
  discoveryBusy = false,
}: QuestModuleProps) {
  const acquireEntries = collectAcquireEntries(discovery)
  const linkedEntries = collectLinkedEntries(discovery)

  const showAcquire = canEdit || acquireEntries.length > 0
  const showLinked = canEdit || linkedEntries.length > 0

  if (!showAcquire && !showLinked) return null

  return (
    <>
      {showAcquire ? (
        <section className="quest-detail-section" data-module="acquire">
          <h3>발견 방법</h3>
          {acquireEntries.length > 0 ? (
            <QuestEntryList
              entries={acquireEntries}
              onOpenQuest={onOpenQuest}
              busy={discoveryBusy}
            />
          ) : (
            <p className="quest-muted">없음</p>
          )}
        </section>
      ) : null}

      {showLinked ? (
        <section className="quest-detail-section" data-module="linked-quest">
          <h3>연결 지도/퀘스트</h3>
          {linkedEntries.length > 0 ? (
            <QuestEntryList
              entries={linkedEntries}
              onOpenQuest={onOpenQuest}
              busy={discoveryBusy}
            />
          ) : (
            <p className="quest-muted">없음</p>
          )}
        </section>
      ) : null}
    </>
  )
}

function collectAcquireEntries(discovery: DiscoveryDetail): QuestEntry[] {
  const acquireLabel = formatDiscoveryAcquire(discovery)?.trim()
  if (!discovery.acquireQuest && !acquireLabel) return []
  const label = acquireLabel || discovery.acquireQuest?.name || '-'
  const tag =
    discovery.acquireType?.trim() ||
    (discovery.acquireQuest || looksLikeQuestAcquireLabel(label)
      ? '퀘스트'
      : null)
  return [
    {
      key: discovery.acquireQuest
        ? `acquire:${discovery.acquireQuest.id}`
        : `acquire:${acquireLabel}`,
      label,
      quest: discovery.acquireQuest,
      tag,
      linkKind: resolveLinkKind(tag, label, Boolean(discovery.acquireQuest)),
    },
  ]
}

function collectLinkedEntries(discovery: DiscoveryDetail): QuestEntry[] {
  const entries: QuestEntry[] = []
  const seen = new Set<string>()

  for (const [index, item] of (discovery.linkedQuests || []).entries()) {
    // 퀘스트 매칭 시에도 원문 라벨을 유지해 발견 방법과 같은 파싱·표기
    const label = String(item.raw || '').trim()
      ? item.raw
      : item.tag
        ? `[${item.tag}] ${item.quest?.name || item.title}`
        : item.quest?.name || item.title
    if (!String(label || '').trim()) continue
    const dedupe = item.quest
      ? `id:${item.quest.id}`
      : `raw:${item.raw}-${index}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    entries.push({
      key: item.quest
        ? `linked:${item.quest.id}`
        : `linked:${item.raw}-${index}`,
      label,
      quest: item.quest,
      tag: item.tag,
      linkKind: resolveLinkKind(item.tag, label, Boolean(item.quest)),
    })
  }

  return entries
}
