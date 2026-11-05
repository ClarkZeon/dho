import { getModuleDef } from '../../lib/detailModules'
import { SkillEdgeLabel } from '../SkillEdgeLabel'

export type SkillModuleRef = {
  id?: number
  slug?: string
  /** 원문 이름. 끝의 `*` 는 전문 스킬 표시 */
  name: string
  specialist?: boolean
}

type SkillChip = SkillModuleRef & {
  name: string
  specialist: boolean
}

type SkillModuleProps = {
  /** 다른 호스트 페이지에 붙는 스킬 목록 */
  skills: SkillModuleRef[]
  canEdit?: boolean
  onOpenSkill?: (skill: SkillModuleRef) => void
}

/** 위키 `생태 조사*` → 전문 스킬 */
export function parseSkillMark(raw: string): {
  name: string
  specialist: boolean
} {
  const text = String(raw || '').trim()
  const specialist = /\*+\s*$/.test(text)
  const name = text.replace(/\*+\s*$/, '').trim()
  return { name: name || text, specialist }
}

export type SkillBonusChip = {
  name: string
  /** `+2`, `＋1` 등 보너스 표기. 없으면 null */
  bonus: string | null
  specialist: boolean
}

/** 위키 축약명 → 정식 스킬명 */
const SKILL_NAME_ABBREVS: Record<string, string> = {
  생태: '생태 조사',
  바디: '바디 랭귀지',
}

function expandSkillAbbrev(
  name: string,
  hostSkillName?: string | null,
): string {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  const mapped = SKILL_NAME_ABBREVS[trimmed]
  if (mapped) return mapped
  const host = String(hostSkillName || '').trim()
  const hostCompact = host.replace(/\s+/g, '')
  const compact = trimmed.replace(/\s+/g, '')
  if (hostCompact && compact && hostCompact.startsWith(compact)) return host
  return trimmed
}

/**
 * `생태 조사 +2 / 생물학 +1`, `생태+2, 대화술 +2` 형태를 칩 목록으로.
 * `생태`→`생태 조사`, `바디`→`바디 랭귀지` 축약 복원.
 */
export function parseSkillBonusText(
  raw: string | null | undefined,
  hostSkillName?: string | null,
): SkillBonusChip[] {
  const text = String(raw || '').trim()
  if (!text) return []

  return text
    .split(/[,，/／|·]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(
        /^(.*?)(?:\s*([+＋]\s*\d+(?:\.\d+)?(?:\s*랭크)?))?$/,
      )
      const marked = parseSkillMark((m?.[1] || part).trim())
      const name = expandSkillAbbrev(marked.name, hostSkillName)
      const bonusRaw = m?.[2]?.replace(/\s+/g, '') || null
      const bonus = bonusRaw ? bonusRaw.replace(/＋/g, '+') : null
      return {
        name,
        bonus,
        specialist: marked.specialist,
      }
    })
    .filter((item) => item.name.trim())
}

/** 스킬(+보너스) 칩 목록 */
export function SkillBonusChips({
  text,
  hostSkillName,
}: {
  text: string | null | undefined
  hostSkillName?: string | null
}) {
  const items = parseSkillBonusText(text, hostSkillName)
  if (items.length === 0) return null
  return (
    <ul className="quest-skill-chips">
      {items.map((item, index) => (
        <li
          key={`${item.name}-${item.bonus || ''}-${index}`}
          className={[
            'is-skill-chip',
            item.specialist ? 'is-specialist' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          title={item.specialist ? '전문 스킬' : undefined}
        >
          <SkillEdgeLabel />
          <span>{item.name}</span>
          {item.bonus ? <em>{item.bonus}</em> : null}
        </li>
      ))}
    </ul>
  )
}

function SkillChipList({
  items,
  onOpenSkill,
}: {
  items: SkillChip[]
  onOpenSkill?: (skill: SkillModuleRef) => void
}) {
  return (
    <ul className="quest-skill-chips">
      {items.map((item, index) => (
        <li
          key={
            item.id != null ? `id:${item.id}` : `name:${item.name}-${index}`
          }
          className={[
            'is-skill-chip',
            item.specialist ? 'is-specialist' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          title={item.specialist ? '전문 스킬' : undefined}
        >
          <SkillEdgeLabel />
          {onOpenSkill ? (
            <button
              type="button"
              className="quest-skill-chip-btn"
              onClick={() =>
                onOpenSkill({
                  id: item.id,
                  slug: item.slug,
                  name: item.name,
                  specialist: item.specialist,
                })
              }
            >
              {item.name}
            </button>
          ) : (
            <span>{item.name}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * 「스킬」 모듈 — 다른 모듈 페이지에 붙는 연결 스킬.
 * 스킬 본문(기본 정보·습득 등)은 SkillDetailView 가 담당한다.
 * 전문 스킬(`*` 표기)은 일반 스킬과 별도 라인으로 표시한다.
 */
export function SkillModule({
  skills,
  canEdit = false,
  onOpenSkill,
}: SkillModuleProps) {
  const title = getModuleDef('skill')?.title ?? '스킬'
  const list: SkillChip[] = (skills || [])
    .map((item) => {
      const marked = parseSkillMark(item.name)
      return {
        ...item,
        name: marked.name,
        specialist: item.specialist ?? marked.specialist,
      }
    })
    .filter((item) => item.name.trim())

  const normal = list.filter((item) => !item.specialist)
  const specialist = list.filter((item) => item.specialist)

  if (!canEdit && list.length === 0) return null

  return (
    <section className="quest-detail-section" data-module="skill">
      <h3>{title}</h3>
      {list.length > 0 ? (
        <div className="skill-module-rows">
          {specialist.length > 0 ? (
            <div className="skill-module-row">
              <span className="skill-module-row-label is-specialist">
                전문
              </span>
              <SkillChipList items={specialist} onOpenSkill={onOpenSkill} />
            </div>
          ) : null}
          {normal.length > 0 ? (
            <div className="skill-module-row">
              <span className="skill-module-row-label">우대</span>
              <SkillChipList items={normal} onOpenSkill={onOpenSkill} />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="quest-muted">없음</p>
      )}
    </section>
  )
}
