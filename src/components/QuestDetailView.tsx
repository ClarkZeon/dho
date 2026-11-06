import { Fragment, useEffect, useState } from 'react'
import {
  fetchDiscovery,
  fetchFieldByKey,
  fetchFields,
  fetchPortByKey,
  fetchPorts,
  fetchQuestByKey,
  fetchSkill,
  fetchTreasureMapByKey,
  setDiscoveryCompletion,
  setQuestCompletion,
  updateQuest,
} from '../lib/api'
import {
  formatQuestSkillLabel,
  normalizeQuestSkills,
  skillDisplayLevel,
} from '../lib/questSkills'
import {
  resolveLinkedKind,
  splitChainAndLinked,
} from '../lib/questChain'
import { splitQuestDestination } from '../lib/questDestination'
import { CityEdgeLabel } from './CityEdgeLabel'
import { LandEdgeLabel } from './LandEdgeLabel'
import { ConsumableEdgeLabel } from './ConsumableEdgeLabel'
import { SkillEdgeLabel } from './SkillEdgeLabel'
import type {
  DiscoveryDetail,
  FieldDetail,
  PortDetail,
  QuestChainItem,
  QuestDetail,
  QuestPrerequisite,
  QuestRewardItem,
  QuestSkillReq,
  SkillDetail,
  TreasureMapDetail,
} from '../types'
import { DetailModal } from './DetailModal'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'
import { getModuleDef } from '../lib/detailModules'
import { DiscoveryDetailView } from './DiscoveryDetailView'
import { ConfirmLayer } from './ConfirmLayer'
import { LoadingOverlay } from './LoadingOverlay'
import { FieldDetailView } from './FieldDetailView'
import { PortDetailView } from './PortDetailView'
import { SkillDetailView } from './SkillDetailView'
import { TreasureMapDetailView } from './TreasureMapDetailView'
import {
  DiscoveryChips,
  parseDiscoveryLabel,
} from './modules/DiscoveryChips'
import { DiscoveryModule } from './modules/DiscoveryModule'
import { QuestDifficultyStars } from './QuestDifficultyStars'

type QuestEditSection =
  | 'basic'
  | 'skills'
  | 'prerequisites'
  | 'rewards'
  | 'chain'
  | 'linked'
  | 'walkthrough'
  | 'progress'
  | 'description'

type QuestDraft = {
  category: string
  name: string
  questType: string
  chronoQuest: string
  feature: string
  difficulty: number | null
  requestPlaces: string
  destination: string
  discoveryName: string
  discoveryCategory: string
  discoveryRank: number | null
  skills: QuestSkillReq[]
  prerequisites: QuestPrerequisite[]
  rewardDucat: number | null
  rewardAdvance: number | null
  expDiscovery: number | null
  expCard: number | null
  expReport: number | null
  fameReport: number | null
  rewardItems: QuestRewardItem[]
  chainQuests: QuestChainItem[]
  linkedQuests: QuestChainItem[]
  walkthrough: string
  progress: string
  description: string
}

const DIFFICULTY_OPTIONS = Array.from({ length: 11 }, (_, i) => i)

function formatNum(n: number | null | undefined) {
  if (n == null) return '-'
  return n.toLocaleString('ko-KR')
}

function numOrEmpty(value: number | null | undefined) {
  return value == null ? '' : String(value)
}

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(/,/g, ''))
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function nullableText(value: string): string | null {
  const t = value.trim()
  return t ? t : null
}

function chainItemLabel(item: QuestChainItem) {
  return item.name ?? item.raw ?? ''
}

function cloneChain(items: QuestChainItem[]): QuestChainItem[] {
  return items.map((item) => ({
    ...item,
    skills: item.skills ? item.skills.map((s) => ({ ...s })) : undefined,
  }))
}

function combinedLinked(quest: QuestDetail): QuestChainItem[] {
  const split = splitChainAndLinked(quest.chainQuests)
  return [...split.linkedQuests, ...(quest.linkedQuests || [])]
}

function makeDraft(quest: QuestDetail): QuestDraft {
  const split = splitChainAndLinked(quest.chainQuests)
  return {
    category: quest.category || '',
    name: quest.name || '',
    questType: quest.questType || '',
    chronoQuest: quest.chronoQuest || '',
    feature: quest.feature || '',
    difficulty: quest.difficulty,
    requestPlaces: quest.requestPlaces || '',
    destination: quest.destination || '',
    discoveryName: quest.discoveryName || '',
    discoveryCategory: quest.discoveryCategory || '',
    discoveryRank: quest.discoveryRank,
    skills: normalizeQuestSkills(quest.skills).map((s) => ({ ...s })),
    prerequisites: (quest.prerequisites || []).map((p) => ({
      ...p,
      children: (p.children || []).map((c) => ({ ...c })),
    })),
    rewardDucat: quest.rewardDucat,
    rewardAdvance: quest.rewardAdvance,
    expDiscovery: quest.expDiscovery,
    expCard: quest.expCard,
    expReport: quest.expReport,
    fameReport: quest.fameReport,
    rewardItems: (quest.rewardItems || []).map((r) => ({ ...r })),
    chainQuests: cloneChain(split.chainQuests),
    linkedQuests: cloneChain(combinedLinked(quest)),
    walkthrough: quest.walkthrough || '',
    progress: quest.progress || '',
    description: quest.description || '',
  }
}

function placePrefixFromStep(line: string) {
  const m = line.trim().match(/^\d+\.\s*(.+)$/)
  if (!m) return ''
  return m[1].split(/[,，]/)[0].replace(/\s+/g, ' ').trim()
}

type WalkthroughFlowItem =
  | {
      type: 'step'
      num: string
      /** 도시/장소 (쉼표 앞) */
      place: string | null
      /** 대상/행동. `생선 파는 남자x2` / `…2회` → 반복 시 본체만 */
      action: string
      /** `(대장장이와 조선소 사이)` — 반복 첫 칸만 */
      hint: string | null
    }
  | { type: 'note'; body: string }

/**
 * `마르세이유, 생선 파는 남자x2 (대장장이와 조선소 사이)`
 * `마르세이유, 생선 파는 남자 2회 (…)` — `2회` = `x2`
 * → 장소 유지 + 대상만 N회 반복, 괄호 힌트는 첫 칸만.
 */
/** `2/3 지점` → `3분의 2지점` (슬래시가 파서를 깨지 않게) */
function normalizeWalkthroughFractions(text: string) {
  return String(text || '')
    .replace(/(\d+)\s*\/\s*(\d+)\s*지점/g, '$2분의 $1지점')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$2분의 $1')
}

function parseWalkthroughStepBody(raw: string): {
  place: string | null
  action: string
  times: number
  hint: string | null
} {
  let body = normalizeWalkthroughFractions(String(raw || ''))
    .replace(/\s+/g, ' ')
    .trim()
  let hint: string | null = null
  const hintMatch = body.match(/\s*[（(]\s*([^）)]+?)\s*[）)]\s*$/)
  if (hintMatch) {
    hint = normalizeWalkthroughFractions(hintMatch[1]).trim() || null
    body = body.slice(0, hintMatch.index).trim()
  }

  let times = 1
  // xN — `남자x2` / `남자 x2`
  const multX = body.match(/^(.*?)[x×Ｘｘ]\s*(\d+)\s*$/i)
  if (multX && multX[1].trim()) {
    times = Math.min(20, Math.max(1, Number(multX[2]) || 1))
    body = multX[1].trim()
  } else {
    // N회 — 끝(`남자 2회`) 또는 중간(`은행장과 2회 대화` → `은행장과 대화`)
    const multHoe = body.match(/^(.*?)(?:\s*)(\d+)\s*회(?:\s+(.*))?$/)
    if (multHoe) {
      const left = (multHoe[1] || '').trim()
      const right = (multHoe[3] || '').trim()
      if (left || right) {
        times = Math.min(20, Math.max(1, Number(multHoe[2]) || 1))
        body = [left, right].filter(Boolean).join(' ')
      }
    }
  }

  const comma = body.match(/^([^,，]+)[,，]\s*(.+)$/)
  if (comma) {
    return {
      place: comma[1].trim() || null,
      action: comma[2].trim(),
      times,
      hint,
    }
  }
  return { place: null, action: body, times, hint }
}

function expandWalkthroughFlow(steps: string[]): WalkthroughFlowItem[] {
  const items: WalkthroughFlowItem[] = []
  let seq = 0
  for (const step of steps) {
    const numbered = step.match(/^(\d+)\.\s*(.*)$/)
    if (numbered) {
      const parsed = parseWalkthroughStepBody(numbered[2])
      for (let i = 0; i < parsed.times; i += 1) {
        seq += 1
        items.push({
          type: 'step',
          num: String(seq),
          place: parsed.place,
          action: parsed.action,
          hint: i === 0 ? parsed.hint : null,
        })
      }
      continue
    }
    items.push({
      type: 'note',
      body: normalizeWalkthroughFractions(
        step.replace(/^[-–—•]\s*/, ''),
      ).trim(),
    })
  }
  return items
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 마지막 공략 문장에서 필요 스킬 이름을 칩으로 뽑고 본문에서는 제거 */
function extractWalkthroughSkills(
  action: string,
  skills: QuestSkillReq[],
): { action: string; skills: QuestSkillReq[] } {
  let rest = String(action || '').trim()
  if (!rest || skills.length === 0) return { action: rest, skills: [] }

  const matched: QuestSkillReq[] = []
  const sorted = [...skills]
    .filter((s) => s.name?.trim())
    .sort((a, b) => b.name.trim().length - a.name.trim().length)

  for (const skill of sorted) {
    const name = skill.name.trim()
    const compact = name.replace(/\s+/g, '')
    const patterns = [name, compact].filter(
      (v, i, arr) => v && arr.indexOf(v) === i,
    )
    let hit = false
    for (const pattern of patterns) {
      const re = new RegExp(escapeRegExp(pattern), 'i')
      if (!re.test(rest)) continue
      rest = rest.replace(re, ' ')
      hit = true
    }
    if (hit) matched.push(skill)
  }

  rest = rest
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*[,，、/|]+\s*/g, ' ')
    .replace(/^[,，、\s]+|[,，、\s]+$/g, '')
    .replace(/\s+(에서|으로|로|에)\s*$/g, '')
    .trim()

  return { action: rest, skills: matched }
}

/** 목적지 전체·단계별 지명 — 위키 지도 위젯 제목으로 쓰인 ※ 노트 제거용 */
function destinationCaptionNames(
  destination: string | null | undefined,
  options?: { cityNames?: readonly string[]; landNames?: readonly string[] },
): string[] {
  const dest = String(destination || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!dest) return []
  const names = new Set<string>([dest])
  for (const part of dest.split(/\s*(?:»|>>|›|→|➜|➔|⟶|⇒|->)\s*/)) {
    const p = part.trim()
    if (p) names.add(p)
  }
  for (const step of splitQuestDestination(dest, options).steps) {
    if (step.name) names.add(step.name)
  }
  return [...names]
}

function isWalkthroughMapCaption(
  line: string,
  destinationNames: string[],
  placePrefixes: string[],
) {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (/^\d+\./.test(t) || /^[-–—]/.test(t) || /^[（(]/.test(t)) return false
  if (/지도\s*출처/.test(t)) return true
  if (destinationNames.some((name) => name && t === name)) return true
  return placePrefixes.some((p) => p && t === p)
}

function dropMapSource(
  text: string,
  destination?: string | null,
  options?: { cityNames?: readonly string[]; landNames?: readonly string[] },
) {
  const destinationNames = destinationCaptionNames(destination, options)
  const lines = text.split('\n')
  const placePrefixes = lines.map(placePrefixFromStep).filter(Boolean)
  const kept = lines
    .map((line) => line.replace(/지도\s*출처\s*[:：]?\s*.*$/, '').trimEnd())
    .filter((line, idx, arr) => {
      const t = line.trim()
      if (!t || /지도\s*출처/.test(t)) return false
      const next = arr.slice(idx + 1).find((l) => l.trim())
      if (next && /지도\s*출처/.test(next) && !/^\d+\./.test(t)) return false
      if (isWalkthroughMapCaption(t, destinationNames, placePrefixes))
        return false
      return true
    })
  while (kept.length) {
    const last = kept[kept.length - 1].trim()
    if (!last || isWalkthroughMapCaption(last, destinationNames, placePrefixes)) {
      kept.pop()
      continue
    }
    break
  }
  return kept.join('\n').trim()
}


type QuestDetailViewProps = {
  quest: QuestDetail
  /** 발견물 상세 조회용 (있으면 이름 매칭 시 링크) */
  token?: string
  /** 카탈로그 점프 없음 컨펌의 「등록하러 이동」 등 — 관리자만 */
  isAdmin?: boolean
  completionBusy?: boolean
  onToggleCompleted?: (completed: boolean) => void
  /** 관리자 수정 모드 (토글). false면 사용자 화면처럼 표시 */
  editMode?: boolean
  /** 어드민만: 섹션별 연필로 퀘스트 수정 (일반 편집 권한으로도 사용) */
  walkthroughEdit?: {
    token: string
    onSaved: (quest: QuestDetail) => void
  }
}

function QuestRelatedList({
  items,
  currentName,
  numbered,
  showLinkKind = false,
  onOpen,
  busy = false,
}: {
  items: QuestChainItem[]
  currentName: string
  numbered: boolean
  /** 연결 지도/퀘스트 — 퀘스트·지도 뱃지 */
  showLinkKind?: boolean
  /** 현재 퀘스트 제외 — 카탈로그 점프 */
  onOpen?: (item: QuestChainItem) => void
  busy?: boolean
}) {
  const Tag = numbered ? 'ol' : 'ul'
  return (
    <Tag className={`quest-chain${numbered ? '' : ' is-linked'}`}>
      {items.map((item, idx) => {
        const name = (item.name || '').replace(/\s+/g, ' ').trim()
        const isCurrent =
          Boolean(name) &&
          name === currentName.replace(/\s+/g, ' ').trim()
        const canJump = Boolean(onOpen && !isCurrent && name)
        const linkKind = showLinkKind ? resolveLinkedKind(item) : null
        const meta = [
          item.category,
          item.difficulty != null ? `난이도 ${item.difficulty}` : null,
          item.places,
        ]
          .filter(Boolean)
          .join(' · ')
        const skillsLine =
          item.skills && item.skills.length > 0
            ? item.skills
                .map((s) => formatQuestSkillLabel(s))
                .filter(Boolean)
                .join(', ')
            : ''
        const body = (
          <>
            <div className="quest-chain-title-row">
              <strong>
                {item.name || item.raw || '퀘스트'}
                {isCurrent ? ' (현재)' : ''}
              </strong>
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
          <li
            key={`${item.name || item.raw || idx}-${idx}`}
            className={[
              isCurrent ? 'is-current' : '',
              canJump ? 'is-jumpable' : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined}
          >
            {numbered ? (
              <span className="quest-chain-idx">{idx + 1}</span>
            ) : null}
            {canJump ? (
              <button
                type="button"
                className="quest-chain-jump"
                disabled={busy}
                onClick={() => onOpen?.(item)}
              >
                {body}
              </button>
            ) : (
              <div>{body}</div>
            )}
          </li>
        )
      })}
    </Tag>
  )
}

type PrerequisiteJumpProps = {
  onOpenDiscovery?: (item: {
    slug?: string
    name: string
    id?: number
  }) => void
  onOpenQuest?: (name: string) => void
  discoveryBusy?: boolean
  questBusy?: boolean
}

function PrerequisiteQuestBody({ item }: { item: QuestPrerequisite }) {
  const meta = [
    item.category,
    item.difficulty != null ? `난이도 ${item.difficulty}` : null,
    item.places,
  ]
    .filter(Boolean)
    .join(' · ')
  const skillsLine =
    item.skills && item.skills.length > 0
      ? item.skills
          .map((s) => formatQuestSkillLabel(s))
          .filter(Boolean)
          .join(', ')
      : ''
  return (
    <>
      <div className="quest-chain-title-row">
        <strong>{item.name || item.raw || '퀘스트'}</strong>
      </div>
      {meta ? <p>{meta}</p> : null}
      {skillsLine ? <p className="quest-chain-skills">{skillsLine}</p> : null}
    </>
  )
}

function PrerequisiteDiscoveryBody({
  item,
  onOpenDiscovery,
}: {
  item: QuestPrerequisite
  onOpenDiscovery?: PrerequisiteJumpProps['onOpenDiscovery']
}) {
  const fromRaw = parseDiscoveryLabel(
    String(item.raw || '')
      .replace(/\s*<[^>]*>\s*$/, '')
      .trim(),
  )
  const name = item.discoveryName?.trim() || fromRaw?.name || ''
  const chip = name
    ? {
        name,
        category: item.discoveryCategory ?? fromRaw?.category ?? null,
        rank: item.discoveryRank ?? fromRaw?.rank ?? null,
      }
    : null

  return (
    <div className="quest-prereq-discovery-row">
      {chip ? (
        <DiscoveryChips items={[chip]} onOpen={onOpenDiscovery} />
      ) : (
        <strong>{item.raw || '발견물'}</strong>
      )}
      {item.nested ? (
        <em className="quest-prereq-nested-note">&lt;{item.nested}&gt;</em>
      ) : null}
    </div>
  )
}

function PrerequisiteCard({
  item,
  onOpenDiscovery,
  onOpenQuest,
  discoveryBusy = false,
  questBusy = false,
}: {
  item: QuestPrerequisite
} & PrerequisiteJumpProps) {
  const children = item.children || []

  if (item.kind === 'discovery') {
    return (
      <li>
        <PrerequisiteDiscoveryBody
          item={item}
          onOpenDiscovery={onOpenDiscovery}
        />
        {children.length > 0 ? (
          <ul className="quest-chain is-linked quest-prereq-nested-chain">
            {children.map((child, idx) => (
              <PrerequisiteCard
                key={`${child.raw}-${idx}`}
                item={child}
                onOpenDiscovery={onOpenDiscovery}
                onOpenQuest={onOpenQuest}
                discoveryBusy={discoveryBusy}
                questBusy={questBusy}
              />
            ))}
          </ul>
        ) : null}
      </li>
    )
  }

  if (item.kind === 'quest' && (item.name || item.raw)) {
    const questName = (item.name || '').trim()
    const canJump = Boolean(onOpenQuest && questName)
    const body = <PrerequisiteQuestBody item={item} />
    return (
      <li className={canJump ? 'is-jumpable' : undefined}>
        {canJump ? (
          <button
            type="button"
            className="quest-chain-jump"
            disabled={questBusy}
            onClick={() => onOpenQuest?.(questName)}
          >
            {body}
          </button>
        ) : (
          <div>{body}</div>
        )}
        {children.length > 0 ? (
          <ul className="quest-chain is-linked quest-prereq-nested-chain">
            {children.map((child, idx) => (
              <PrerequisiteCard
                key={`${child.raw}-${idx}`}
                item={child}
                onOpenDiscovery={onOpenDiscovery}
                onOpenQuest={onOpenQuest}
                discoveryBusy={discoveryBusy}
                questBusy={questBusy}
              />
            ))}
          </ul>
        ) : null}
      </li>
    )
  }

  return (
    <li>
      <div className="quest-chain-title-row">
        <strong>{item.raw || '—'}</strong>
      </div>
    </li>
  )
}

function PrerequisiteList({
  items,
  onOpenDiscovery,
  onOpenQuest,
  discoveryBusy = false,
  questBusy = false,
}: {
  items: QuestPrerequisite[]
} & PrerequisiteJumpProps) {
  return (
    <ul className="quest-chain is-linked quest-prereq-chain">
      {items.map((item, idx) => (
        <PrerequisiteCard
          key={`${item.raw}-${idx}`}
          item={item}
          onOpenDiscovery={onOpenDiscovery}
          onOpenQuest={onOpenQuest}
          discoveryBusy={discoveryBusy}
          questBusy={questBusy}
        />
      ))}
    </ul>
  )
}

/** 편집용: 중첩을 평탄 줄로 (발견 다음 퀘스트는 들여쓰기 표기) */
function flattenPrereqsForEdit(rows: QuestPrerequisite[]): string[] {
  const lines: string[] = []
  for (const row of rows) {
    lines.push(row.raw)
    for (const child of row.children || []) {
      lines.push(child.raw)
    }
  }
  return lines
}

function EditPrerequisites({
  rows,
  onChange,
  disabled,
}: {
  rows: QuestPrerequisite[]
  onChange: (rows: QuestPrerequisite[]) => void
  disabled?: boolean
}) {
  const [text, setText] = useState(() =>
    flattenPrereqsForEdit(rows).join('\n'),
  )

  useEffect(() => {
    setText(flattenPrereqsForEdit(rows).join('\n'))
  }, [rows])

  return (
    <>
      <label className="field">
        <span>
          한 줄에 하나. 발견물 다음 퀘스트 줄은 그 발견물 아래로 묶입니다.
        </span>
        <textarea
          className="quest-import-textarea"
          rows={8}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value)
            const next = e.target.value
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
              .map((raw) => {
                if (/^\[[^\]]+\]/.test(raw)) {
                  return {
                    kind: 'discovery' as const,
                    raw,
                    children: [] as QuestPrerequisite[],
                  }
                }
                if (/\|/.test(raw)) {
                  return { kind: 'quest' as const, raw }
                }
                return { kind: 'other' as const, raw }
              })
            onChange(next)
          }}
        />
      </label>
    </>
  )
}

function EditSkills({
  skills,
  onChange,
  disabled,
}: {
  skills: QuestSkillReq[]
  onChange: (skills: QuestSkillReq[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>스킬</th>
              <th>레벨</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((skill, idx) => (
              <tr key={`skill-${idx}`}>
                <td>
                  <input
                    value={skill.name}
                    disabled={disabled}
                    aria-label="스킬 이름"
                    onChange={(e) =>
                      onChange(
                        skills.map((s, i) =>
                          i === idx ? { ...s, name: e.target.value } : s,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(skill.level)}
                    disabled={disabled}
                    aria-label="스킬 레벨"
                    onChange={(e) =>
                      onChange(
                        skills.map((s, i) =>
                          i === idx
                            ? { ...s, level: parseOptionalInt(e.target.value) }
                            : s,
                        ),
                      )
                    }
                  />
                </td>
                <td className="col-action">
                  <button
                    type="button"
                    className="admin-danger-btn"
                    disabled={disabled}
                    onClick={() => onChange(skills.filter((_, i) => i !== idx))}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function EditRewardItems({
  items,
  onChange,
  disabled,
}: {
  items: QuestRewardItem[]
  onChange: (items: QuestRewardItem[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>아이템</th>
              <th>수량</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={`reward-item-${idx}`}>
                <td>
                  <input
                    value={item.name}
                    disabled={disabled}
                    aria-label="아이템 이름"
                    onChange={(e) =>
                      onChange(
                        items.map((r, i) =>
                          i === idx ? { ...r, name: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(item.qty)}
                    disabled={disabled}
                    aria-label="아이템 수량"
                    onChange={(e) =>
                      onChange(
                        items.map((r, i) =>
                          i === idx
                            ? { ...r, qty: parseOptionalInt(e.target.value) }
                            : r,
                        ),
                      )
                    }
                  />
                </td>
                <td className="col-action">
                  <button
                    type="button"
                    className="admin-danger-btn"
                    disabled={disabled}
                    onClick={() => onChange(items.filter((_, i) => i !== idx))}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="admin-btn"
        disabled={disabled}
        onClick={() => onChange([...items, { name: '', qty: null }])}
      >
        추가
      </button>
    </>
  )
}

function EditRelatedList({
  items,
  onChange,
  disabled,
  placeholder,
}: {
  items: QuestChainItem[]
  onChange: (items: QuestChainItem[]) => void
  disabled?: boolean
  placeholder: string
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="col-action">#</th>
              <th>퀘스트 이름</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={`related-${idx}`}>
                <td className="col-action">{idx + 1}</td>
                <td>
                  <input
                    value={chainItemLabel(item)}
                    disabled={disabled}
                    placeholder={placeholder}
                    aria-label="퀘스트 이름"
                    onChange={(e) =>
                      onChange(
                        items.map((q, i) =>
                          i === idx
                            ? { ...q, name: e.target.value, raw: undefined }
                            : q,
                        ),
                      )
                    }
                  />
                </td>
                <td className="col-action">
                  <button
                    type="button"
                    className="admin-danger-btn"
                    disabled={disabled}
                    onClick={() => onChange(items.filter((_, i) => i !== idx))}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="admin-btn"
        disabled={disabled}
        onClick={() => onChange([...items, { name: '' }])}
      >
        추가
      </button>
    </>
  )
}

export function QuestDetailView({
  quest,
  token,
  isAdmin = false,
  completionBusy = false,
  onToggleCompleted,
  editMode = false,
  walkthroughEdit,
}: QuestDetailViewProps) {
  const authToken = token || walkthroughEdit?.token || ''
  const canEdit = Boolean(walkthroughEdit) && editMode

  const [editing, setEditing] = useState<QuestEditSection | null>(null)
  const [draft, setDraft] = useState<QuestDraft>(() => makeDraft(quest))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [discoveryDetail, setDiscoveryDetail] = useState<DiscoveryDetail | null>(
    null,
  )
  const [discoveryLoading, setDiscoveryLoading] = useState(false)
  const [discoveryMissName, setDiscoveryMissName] = useState('')
  const [discoveryError, setDiscoveryError] = useState('')
  const [discoveryCompletionBusy, setDiscoveryCompletionBusy] = useState(false)
  const [skillDetail, setSkillDetail] = useState<SkillDetail | null>(null)
  const [skillLoading, setSkillLoading] = useState(false)
  /** 없는 스킬 이름 — 컨펌 레이어용 */
  const [skillMissName, setSkillMissName] = useState('')
  const [skillError, setSkillError] = useState('')
  const [jumpQuestDetail, setJumpQuestDetail] = useState<QuestDetail | null>(
    null,
  )
  const [jumpQuestLoading, setJumpQuestLoading] = useState(false)
  const [jumpQuestMissName, setJumpQuestMissName] = useState('')
  const [jumpQuestError, setJumpQuestError] = useState('')
  const [jumpQuestBusy, setJumpQuestBusy] = useState(false)
  const [portDetail, setPortDetail] = useState<PortDetail | null>(null)
  const [portLoading, setPortLoading] = useState(false)
  const [portMissName, setPortMissName] = useState('')
  const [portError, setPortError] = useState('')
  const [fieldDetail, setFieldDetail] = useState<FieldDetail | null>(null)
  const [fieldLoading, setFieldLoading] = useState(false)
  const [fieldMissName, setFieldMissName] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [mapDetail, setMapDetail] = useState<TreasureMapDetail | null>(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapMissName, setMapMissName] = useState('')
  const [mapError, setMapError] = useState('')
  /** 목적지 다단 분할용 — 도시·육지 카탈로그 이름 */
  const [destCityNames, setDestCityNames] = useState<string[]>([])
  const [destLandNames, setDestLandNames] = useState<string[]>([])

  useEffect(() => {
    setDraft(makeDraft(quest))
    setEditing(null)
    setError('')
  }, [quest])

  useEffect(() => {
    if (!authToken) {
      setDestCityNames([])
      setDestLandNames([])
      return
    }
    let cancelled = false
    void Promise.all([fetchPorts(authToken), fetchFields(authToken)])
      .then(([portsRes, fieldsRes]) => {
        if (cancelled) return
        setDestCityNames(
          (portsRes.ports || []).flatMap((p) =>
            [p.name, p.altName].filter(Boolean),
          ) as string[],
        )
        setDestLandNames(
          (fieldsRes.fields || []).flatMap((f) =>
            [f.name, f.altName].filter(Boolean),
          ) as string[],
        )
      })
      .catch(() => {
        if (cancelled) return
        setDestCityNames([])
        setDestLandNames([])
      })
    return () => {
      cancelled = true
    }
  }, [authToken])

  useEffect(() => {
    if (!canEdit) {
      setDraft(makeDraft(quest))
      setEditing(null)
      setError('')
    }
  }, [canEdit, quest])

  useEffect(() => {
    setDiscoveryDetail(null)
    setDiscoveryMissName('')
    setDiscoveryError('')
    setSkillDetail(null)
    setSkillMissName('')
    setSkillError('')
    setJumpQuestDetail(null)
    setJumpQuestMissName('')
    setJumpQuestError('')
    setPortDetail(null)
    setPortMissName('')
    setPortError('')
    setMapDetail(null)
    setMapMissName('')
    setMapError('')
  }, [quest.id])

  function startEdit(section: QuestEditSection) {
    setDraft(makeDraft(quest))
    setError('')
    setEditing(section)
  }

  function cancelEdit() {
    setDraft(makeDraft(quest))
    setError('')
    setEditing(null)
  }

  function patchDraft(partial: Partial<QuestDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  async function openMatchedDiscovery(item: {
    slug?: string
    name: string
    id?: number
  }) {
    if (!authToken) return
    const key = (item.slug || item.name || '').trim()
    if (!key) return
    const missLabel = (item.name || key).trim()
    setDiscoveryLoading(true)
    setDiscoveryMissName('')
    setDiscoveryError('')
    try {
      const res = await fetchDiscovery(authToken, key)
      setDiscoveryDetail(res.discovery)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (/찾을 수 없|없습니다/i.test(message)) {
        setDiscoveryMissName(missLabel)
      } else {
        setDiscoveryError(message || '발견물 상세를 불러오지 못했습니다.')
      }
    } finally {
      setDiscoveryLoading(false)
    }
  }

  function openDiscoveriesAddTab(discoveryName: string) {
    const params = new URLSearchParams()
    params.set('q', discoveryName)
    params.set('add', '1')
    const url = `${window.location.pathname}${window.location.search}#/discoveries?${params.toString()}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function openMatchedSkill(name: string) {
    if (!authToken) return
    const key = name.trim()
    if (!key) return
    setSkillLoading(true)
    setSkillMissName('')
    setSkillError('')
    try {
      const res = await fetchSkill(authToken, key)
      setSkillDetail(res.skill)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (/찾을 수 없|없습니다/i.test(message)) {
        setSkillMissName(key)
      } else {
        setSkillError(message || '스킬 상세를 불러오지 못했습니다.')
      }
    } finally {
      setSkillLoading(false)
    }
  }

  function openSkillsAddTab(skillName: string) {
    const params = new URLSearchParams()
    params.set('q', skillName)
    params.set('add', '1')
    const url = `${window.location.pathname}${window.location.search}#/skills?${params.toString()}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function openMatchedChainQuest(name: string) {
    if (!authToken) return
    const key = name.trim()
    if (!key) return
    setJumpQuestLoading(true)
    setJumpQuestMissName('')
    setJumpQuestError('')
    try {
      const res = await fetchQuestByKey(authToken, key)
      setJumpQuestDetail(res.quest)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (/찾을 수 없|없습니다/i.test(message)) {
        setJumpQuestMissName(key)
      } else {
        setJumpQuestError(message || '퀘스트 상세를 불러오지 못했습니다.')
      }
    } finally {
      setJumpQuestLoading(false)
    }
  }

  async function openMatchedMap(name: string) {
    if (!authToken) return
    const key = name.trim()
    if (!key) return
    setMapLoading(true)
    setMapMissName('')
    setMapError('')
    try {
      const res = await fetchTreasureMapByKey(authToken, key)
      setMapDetail(res.treasureMap)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (/찾을 수 없|없습니다/i.test(message)) {
        setMapMissName(key)
      } else {
        setMapError(message || '지도 상세를 불러오지 못했습니다.')
      }
    } finally {
      setMapLoading(false)
    }
  }

  function openMatchedLinked(item: QuestChainItem) {
    const name = (item.name || item.raw || '').replace(/\s+/g, ' ').trim()
    if (!name) return
    if (resolveLinkedKind(item) === 'map') {
      void openMatchedMap(name)
      return
    }
    void openMatchedChainQuest(name)
  }

  function openMapsAddTab(mapName: string) {
    const params = new URLSearchParams()
    params.set('q', mapName)
    params.set('add', '1')
    const url = `${window.location.pathname}${window.location.search}#/treasure-maps?${params.toString()}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openQuestsAddTab(questName: string) {
    const params = new URLSearchParams()
    params.set('q', questName)
    params.set('add', '1')
    const url = `${window.location.pathname}${window.location.search}#/quests?${params.toString()}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function openMatchedPort(name: string) {
    if (!authToken) return
    const key = name.trim()
    if (!key) return
    setPortLoading(true)
    setPortMissName('')
    setPortError('')
    try {
      const res = await fetchPortByKey(authToken, key)
      setPortDetail(res.port)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (/찾을 수 없|없습니다/i.test(message)) {
        setPortMissName(key)
      } else {
        setPortError(message || '도시 상세를 불러오지 못했습니다.')
      }
    } finally {
      setPortLoading(false)
    }
  }

  function openPortsAddTab(portName: string) {
    const params = new URLSearchParams()
    params.set('q', portName)
    params.set('add', '1')
    const url = `${window.location.pathname}${window.location.search}#/ports?${params.toString()}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function openMatchedField(name: string) {
    if (!authToken) return
    const key = name.trim()
    if (!key) return
    setFieldLoading(true)
    setFieldMissName('')
    setFieldError('')
    try {
      const res = await fetchFieldByKey(authToken, key)
      setFieldDetail(res.field)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (/찾을 수 없|없습니다/i.test(message)) {
        setFieldMissName(key)
      } else {
        setFieldError(message || '육지 상세를 불러오지 못했습니다.')
      }
    } finally {
      setFieldLoading(false)
    }
  }

  function openFieldsAddTab(fieldName: string) {
    const params = new URLSearchParams()
    params.set('q', fieldName)
    params.set('add', '1')
    const url = `${window.location.pathname}${window.location.search}#/fields?${params.toString()}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function toggleJumpQuestCompleted(next: boolean) {
    if (!authToken || !jumpQuestDetail || jumpQuestBusy) return
    setJumpQuestBusy(true)
    setJumpQuestError('')
    try {
      const res = await setQuestCompletion(
        authToken,
        jumpQuestDetail.id,
        next,
      )
      setJumpQuestDetail((prev) =>
        prev
          ? {
              ...prev,
              completed: res.completed,
              completedAt: res.completedAt,
            }
          : prev,
      )
    } catch (err) {
      setJumpQuestError(
        err instanceof Error
          ? err.message
          : '퀘스트 완료 상태 저장에 실패했습니다.',
      )
    } finally {
      setJumpQuestBusy(false)
    }
  }

  async function toggleDiscoveryCompleted(next: boolean) {
    if (!authToken || !discoveryDetail || discoveryCompletionBusy) return
    setDiscoveryCompletionBusy(true)
    setDiscoveryError('')
    try {
      const res = await setDiscoveryCompletion(
        authToken,
        discoveryDetail.id,
        next,
      )
      setDiscoveryDetail((prev) =>
        prev
          ? {
              ...prev,
              completed: res.completed,
              completedAt: res.completedAt,
            }
          : prev,
      )
    } catch (err) {
      setDiscoveryError(
        err instanceof Error
          ? err.message
          : '발견물 완료 상태 저장에 실패했습니다.',
      )
    } finally {
      setDiscoveryCompletionBusy(false)
    }
  }

  async function saveSection() {
    if (!walkthroughEdit || !editing) return
    setSaving(true)
    setError('')
    try {
      let patch: Partial<QuestDetail> = {}
      if (editing === 'basic') {
        if (!draft.name.trim()) throw new Error('퀘스트 이름이 필요합니다.')
        if (
          draft.difficulty != null &&
          (!Number.isInteger(draft.difficulty) ||
            draft.difficulty < 0 ||
            draft.difficulty > 10)
        ) {
          throw new Error('난이도는 0~10 정수여야 합니다.')
        }
        patch = {
          category: nullableText(draft.category),
          name: draft.name.trim(),
          questType: nullableText(draft.questType),
          chronoQuest: nullableText(draft.chronoQuest),
          feature: nullableText(draft.feature),
          difficulty: draft.difficulty,
          requestPlaces: nullableText(draft.requestPlaces),
          destination: nullableText(draft.destination),
          discoveryName: nullableText(draft.discoveryName),
          discoveryCategory: nullableText(draft.discoveryCategory),
          discoveryRank: draft.discoveryRank,
        }
      } else if (editing === 'skills') {
        patch = {
          skills: draft.skills
            .filter((s) => s.name.trim())
            .map((s) => ({ name: s.name.trim(), level: s.level })),
        }
      } else if (editing === 'prerequisites') {
        patch = {
          prerequisites: draft.prerequisites
            .map((p) => ({
              ...p,
              raw: (p.raw || '').trim(),
            }))
            .filter((p) => p.raw),
        }
      } else if (editing === 'rewards') {
        patch = {
          rewardDucat: draft.rewardDucat,
          rewardAdvance: draft.rewardAdvance,
          expDiscovery: draft.expDiscovery,
          expCard: draft.expCard,
          expReport: draft.expReport,
          fameReport: draft.fameReport,
          rewardItems: draft.rewardItems
            .filter((r) => r.name.trim())
            .map((r) => ({ name: r.name.trim(), qty: r.qty })),
        }
      } else if (editing === 'chain') {
        // 서버는 chain/linked를 함께 저장하므로 linked는 현재 값을 유지해 전달
        patch = {
          chainQuests: draft.chainQuests.filter((q) =>
            chainItemLabel(q).trim(),
          ),
          linkedQuests: combinedLinked(quest),
        }
      } else if (editing === 'linked') {
        patch = {
          chainQuests: splitChainAndLinked(quest.chainQuests).chainQuests,
          linkedQuests: draft.linkedQuests.filter((q) =>
            chainItemLabel(q).trim(),
          ),
        }
      } else if (editing === 'walkthrough') {
        patch = { walkthrough: draft.walkthrough }
      } else if (editing === 'progress') {
        patch = { progress: draft.progress }
      } else if (editing === 'description') {
        patch = { description: draft.description }
      }

      const res = await updateQuest(walkthroughEdit.token, quest.id, patch)
      walkthroughEdit.onSaved(res.quest)
      setEditing(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '퀘스트 저장에 실패했습니다.',
      )
    } finally {
      setSaving(false)
    }
  }

  const split = splitChainAndLinked(quest.chainQuests)
  const chainQuests = split.chainQuests
  const linkedQuests = combinedLinked(quest)
  const mapNoiseOpts = {
    cityNames: destCityNames,
    landNames: destLandNames,
  }
  const description = dropMapSource(
    quest.description || '',
    quest.destination,
    mapNoiseOpts,
  )
  const walkthroughSteps = dropMapSource(
    quest.walkthrough || '',
    quest.destination,
    mapNoiseOpts,
  )
    .split('\n')
    .filter((line) => line.trim().length > 0)
  const walkthroughFlow = expandWalkthroughFlow(walkthroughSteps)
  const walkthroughLastStepIdx = walkthroughFlow.reduce(
    (acc, cur, i) => (cur.type === 'step' ? i : acc),
    -1,
  )

  // 1. / 1-1. / 2-1. 등 모두 동일 레벨 진행 단계로 분리
  const progressBlocks = dropMapSource(
    quest.progress || '',
    quest.destination,
    mapNoiseOpts,
  )
    .split(/\n(?=\d+(?:-\d+)*\.\s+|결론\s*[-–—])/)
    .map((block) => block.trim())
    .filter(Boolean)

  const questSkills = normalizeQuestSkills(quest.skills)
  const showSkills = canEdit || questSkills.length > 0
  const showPrerequisites =
    canEdit || (quest.prerequisites || []).length > 0
  const showRewards =
    canEdit ||
    quest.rewardDucat != null ||
    quest.rewardAdvance != null ||
    quest.expDiscovery != null ||
    quest.expCard != null ||
    quest.expReport != null ||
    quest.fameReport != null ||
    quest.rewardItems.length > 0
  const showRewardDucat =
    canEdit || quest.rewardDucat != null || quest.rewardAdvance != null
  const showRewardExp =
    canEdit ||
    quest.expDiscovery != null ||
    quest.expCard != null ||
    quest.expReport != null ||
    quest.fameReport != null
  const showRewardItems = canEdit || quest.rewardItems.length > 0
  const showChain = canEdit || chainQuests.length > 0
  const showLinked = canEdit || linkedQuests.length > 0
  const showWalkthrough = canEdit || walkthroughSteps.length > 0
  const showProgress = canEdit || progressBlocks.length > 0
  const showDescription = canEdit || Boolean(description)
  const requestPlaceChips = (quest.requestPlaces || '')
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const destinationParts = splitQuestDestination(quest.destination, {
    cityNames: destCityNames,
    landNames: destLandNames,
  })

  const sectionActions = (
    <DetailSectionActions
      busy={saving}
      onCancel={cancelEdit}
      onSave={() => void saveSection()}
    />
  )

  return (
    <div className="quest-detail">
      <header
        className={`quest-detail-hero${quest.completed ? ' is-completed' : ''}`}
      >
        <div className="quest-detail-hero-top">
          <div className="quest-detail-hero-chips">
            <span className="quest-badge">
              {quest.category
                ? `[${quest.category}] ${quest.questType || ''}`.trim()
                : (getModuleDef('quest')?.title ?? '퀘스트')}
            </span>
            {quest.completed ? (
              <span className="quest-badge quest-badge-done">완료</span>
            ) : null}
          </div>
          <QuestDifficultyStars value={quest.difficulty} />
        </div>
        <h2>{quest.name}</h2>
      </header>

      {error ? (
        <p className="form-note error" role="alert">
          {error}
        </p>
      ) : null}

      {showDescription && (
        <section className="quest-detail-section quest-detail-blurb-section">
          <DetailSectionHead
            title="설명"
            canEdit={canEdit}
            editing={editing === 'description'}
            onEdit={() => startEdit('description')}
          />
          {editing === 'description' ? (
            <>
              <textarea
                className="quest-walkthrough-textarea"
                value={draft.description}
                onChange={(e) => patchDraft({ description: e.target.value })}
                rows={5}
                disabled={saving}
                aria-label="설명 내용"
              />
              {sectionActions}
            </>
          ) : description ? (
            <p className="quest-detail-blurb">{description}</p>
          ) : (
            <p className="quest-muted">설명이 없습니다.</p>
          )}
        </section>
      )}

      <section className="quest-detail-section">
        <DetailSectionHead
          title="기본 정보"
          canEdit={canEdit}
          editing={editing === 'basic'}
          onEdit={() => startEdit('basic')}
        />
        {editing === 'basic' ? (
          <>
            <div className="quest-kv-grid">
              <label className="field">
                <span>분류</span>
                <input
                  value={draft.category}
                  onChange={(e) => patchDraft({ category: e.target.value })}
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>퀘스트 이름</span>
                <input
                  value={draft.name}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                  required
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>퀘스트 종류</span>
                <input
                  value={draft.questType}
                  onChange={(e) => patchDraft({ questType: e.target.value })}
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>크로노 퀘스트</span>
                <input
                  value={draft.chronoQuest}
                  onChange={(e) => patchDraft({ chronoQuest: e.target.value })}
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>특징</span>
                <input
                  value={draft.feature}
                  onChange={(e) => patchDraft({ feature: e.target.value })}
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>난이도</span>
                <select
                  value={numOrEmpty(draft.difficulty)}
                  onChange={(e) =>
                    patchDraft({ difficulty: parseOptionalInt(e.target.value) })
                  }
                  disabled={saving}
                  aria-label="난이도"
                >
                  <option value="">선택 안 함</option>
                  {DIFFICULTY_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>의뢰 장소</span>
                <input
                  value={draft.requestPlaces}
                  onChange={(e) =>
                    patchDraft({ requestPlaces: e.target.value })
                  }
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>목적지</span>
                <input
                  value={draft.destination}
                  onChange={(e) => patchDraft({ destination: e.target.value })}
                  disabled={saving}
                />
              </label>
              <label className="field quest-kv-wide">
                <span>발견물</span>
                <input
                  value={draft.discoveryName}
                  onChange={(e) =>
                    patchDraft({ discoveryName: e.target.value })
                  }
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>발견물 분류 (선택)</span>
                <input
                  value={draft.discoveryCategory}
                  onChange={(e) =>
                    patchDraft({ discoveryCategory: e.target.value })
                  }
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>발견물 난이도 (선택)</span>
                <input
                  inputMode="numeric"
                  value={numOrEmpty(draft.discoveryRank)}
                  onChange={(e) =>
                    patchDraft({
                      discoveryRank: parseOptionalInt(e.target.value),
                    })
                  }
                  disabled={saving}
                />
              </label>
            </div>
            {sectionActions}
          </>
        ) : (
          <div className="quest-kv-grid">
            <div>
              <span>난이도</span>
              <strong>
                <QuestDifficultyStars value={quest.difficulty} />
              </strong>
            </div>
            {canEdit || quest.chronoQuest?.trim() ? (
              <div>
                <span>크로노 퀘스트</span>
                <strong>
                  {quest.chronoQuest?.trim() ? quest.chronoQuest : '-'}
                </strong>
              </div>
            ) : null}
            {canEdit || quest.feature?.trim() ? (
              <div>
                <span>특징</span>
                <strong>{quest.feature?.trim() ? quest.feature : '-'}</strong>
              </div>
            ) : null}
            <div>
              <span>의뢰 장소</span>
              {requestPlaceChips.length > 0 ? (
                <ul className="quest-skill-chips">
                  {requestPlaceChips.map((place) => {
                    const canOpen = Boolean(authToken && place)
                    const inner = (
                      <span className="chip-edge-inner">
                        <CityEdgeLabel />
                        <span>{place}</span>
                      </span>
                    )
                    return (
                      <li key={place} className="is-city-chip">
                        {canOpen ? (
                          <button
                            type="button"
                            className="quest-skill-chip-btn"
                            disabled={portLoading}
                            onClick={() => void openMatchedPort(place)}
                          >
                            {inner}
                          </button>
                        ) : (
                          inner
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <strong>-</strong>
              )}
            </div>
            <div>
              <span>목적지</span>
              {destinationParts.steps.length > 0 ? (
                <ul className="quest-skill-chips">
                  {destinationParts.steps.map((step, idx) => (
                    <Fragment key={`dest-${step.kind}-${step.name}-${idx}`}>
                      {idx > 0 ? (
                        <li className="quest-dest-sep" aria-hidden="true">
                          »
                        </li>
                      ) : null}
                      {step.kind === 'city' ? (
                        <li className="is-city-chip">
                          {authToken ? (
                            <button
                              type="button"
                              className="quest-skill-chip-btn"
                              disabled={portLoading}
                              onClick={() => void openMatchedPort(step.name)}
                            >
                              <span className="chip-edge-inner">
                                <CityEdgeLabel />
                                <span>{step.name}</span>
                              </span>
                            </button>
                          ) : (
                            <span className="chip-edge-inner">
                              <CityEdgeLabel />
                              <span>{step.name}</span>
                            </span>
                          )}
                        </li>
                      ) : (
                        <li className="is-land-chip">
                          {authToken ? (
                            <button
                              type="button"
                              className="quest-skill-chip-btn"
                              disabled={fieldLoading}
                              onClick={() => void openMatchedField(step.name)}
                            >
                              <span className="chip-edge-inner">
                                <LandEdgeLabel />
                                <span>{step.name}</span>
                              </span>
                            </button>
                          ) : (
                            <span className="chip-edge-inner">
                              <LandEdgeLabel />
                              <span>{step.name}</span>
                            </span>
                          )}
                        </li>
                      )}
                    </Fragment>
                  ))}
                </ul>
              ) : (
                <strong>-</strong>
              )}
            </div>
          </div>
        )}
      </section>

      <DiscoveryModule
        quest={quest}
        canEdit={canEdit}
        discoveryBusy={discoveryLoading}
        onOpenDiscovery={
          authToken
            ? (item) => void openMatchedDiscovery(item)
            : undefined
        }
      />

      {showSkills && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="필요 스킬"
            canEdit={canEdit}
            editing={editing === 'skills'}
            onEdit={() => startEdit('skills')}
          />
          {editing === 'skills' ? (
            <>
              <EditSkills
                skills={draft.skills}
                onChange={(skills) => patchDraft({ skills })}
                disabled={saving}
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
                leading={
                  <button
                    type="button"
                    className="btn-admin"
                    disabled={saving}
                    onClick={() =>
                      patchDraft({
                        skills: [...draft.skills, { name: '', level: null }],
                      })
                    }
                  >
                    추가
                  </button>
                }
              />
            </>
          ) : questSkills.length ? (
            <>
              <ul className="quest-skill-chips">
                {questSkills.map((skill, idx) => {
                  const level = skillDisplayLevel(skill)
                  const canOpen = Boolean(authToken && skill.name.trim())
                  return (
                    <li
                      key={`${skill.name}-${skill.level}-${idx}`}
                      className="is-skill-chip"
                    >
                      <SkillEdgeLabel />
                      {canOpen ? (
                        <button
                          type="button"
                          className="quest-skill-chip-btn"
                          disabled={skillLoading}
                          onClick={() => void openMatchedSkill(skill.name)}
                        >
                          <span>{skill.name}</span>
                          {level != null ? <em>Lv.{level}</em> : null}
                        </button>
                      ) : (
                        <>
                          <span>{skill.name}</span>
                          {level != null ? <em>Lv.{level}</em> : null}
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="quest-muted">없음</p>
          )}
        </section>
      )}

      {showPrerequisites && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="선행 발견/퀘스트"
            canEdit={canEdit}
            editing={editing === 'prerequisites'}
            onEdit={() => startEdit('prerequisites')}
          />
          {editing === 'prerequisites' ? (
            <>
              <EditPrerequisites
                rows={draft.prerequisites}
                onChange={(prerequisites) => patchDraft({ prerequisites })}
                disabled={saving}
              />
              {sectionActions}
            </>
          ) : (quest.prerequisites || []).length ? (
            <PrerequisiteList
              items={quest.prerequisites || []}
              onOpenDiscovery={
                authToken
                  ? (item) => void openMatchedDiscovery(item)
                  : undefined
              }
              onOpenQuest={
                authToken
                  ? (name) => void openMatchedChainQuest(name)
                  : undefined
              }
              discoveryBusy={discoveryLoading}
              questBusy={jumpQuestLoading}
            />
          ) : (
            <p className="quest-muted">없음</p>
          )}
        </section>
      )}

      {showRewards && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="보상"
            canEdit={canEdit}
            editing={editing === 'rewards'}
            onEdit={() => startEdit('rewards')}
          />
          {editing === 'rewards' ? (
            <>
              <div className="quest-kv-grid">
                <label className="field">
                  <span>보상금</span>
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(draft.rewardDucat)}
                    onChange={(e) =>
                      patchDraft({ rewardDucat: parseOptionalInt(e.target.value) })
                    }
                    disabled={saving}
                  />
                </label>
                <label className="field">
                  <span>선금</span>
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(draft.rewardAdvance)}
                    onChange={(e) =>
                      patchDraft({
                        rewardAdvance: parseOptionalInt(e.target.value),
                      })
                    }
                    disabled={saving}
                  />
                </label>
                <label className="field">
                  <span>발견 경험치</span>
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(draft.expDiscovery)}
                    onChange={(e) =>
                      patchDraft({
                        expDiscovery: parseOptionalInt(e.target.value),
                      })
                    }
                    disabled={saving}
                  />
                </label>
                <label className="field">
                  <span>카드 경험치</span>
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(draft.expCard)}
                    onChange={(e) =>
                      patchDraft({ expCard: parseOptionalInt(e.target.value) })
                    }
                    disabled={saving}
                  />
                </label>
                <label className="field">
                  <span>보고 경험치</span>
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(draft.expReport)}
                    onChange={(e) =>
                      patchDraft({ expReport: parseOptionalInt(e.target.value) })
                    }
                    disabled={saving}
                  />
                </label>
                <label className="field">
                  <span>보고 명성</span>
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(draft.fameReport)}
                    onChange={(e) =>
                      patchDraft({ fameReport: parseOptionalInt(e.target.value) })
                    }
                    disabled={saving}
                  />
                </label>
                <div className="quest-kv-wide">
                  <span>보상 아이템</span>
                  <EditRewardItems
                    items={draft.rewardItems}
                    onChange={(rewardItems) => patchDraft({ rewardItems })}
                    disabled={saving}
                  />
                </div>
              </div>
              {sectionActions}
            </>
          ) : (
            <div className="quest-reward-grid">
              {showRewardDucat && (
                <article>
                  <p>두캇</p>
                  <dl>
                    <div>
                      <dt>보상금</dt>
                      <dd>{formatNum(quest.rewardDucat)}</dd>
                    </div>
                    <div>
                      <dt>선금</dt>
                      <dd>{formatNum(quest.rewardAdvance)}</dd>
                    </div>
                  </dl>
                </article>
              )}
              {showRewardExp && (
                <article>
                  <p>경험치 · 명성</p>
                  <dl>
                    <div>
                      <dt>발견</dt>
                      <dd>{formatNum(quest.expDiscovery)}</dd>
                    </div>
                    <div>
                      <dt>카드</dt>
                      <dd>{formatNum(quest.expCard)}</dd>
                    </div>
                    <div>
                      <dt>보고</dt>
                      <dd>{formatNum(quest.expReport)}</dd>
                    </div>
                    <div>
                      <dt>명성</dt>
                      <dd>{formatNum(quest.fameReport)}</dd>
                    </div>
                  </dl>
                </article>
              )}
              {showRewardItems && (
                <article className="quest-reward-items">
                  <p>아이템</p>
                  {quest.rewardItems.length ? (
                    <ul className="quest-skill-chips">
                      {quest.rewardItems.map((item, idx) => (
                        <li
                          key={`${item.name}-${item.qty}-${idx}`}
                          className="is-consumable-chip"
                        >
                          <ConsumableEdgeLabel />
                          <span>{item.name}</span>
                          {item.qty != null && <em>×{item.qty}</em>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="quest-muted">없음</p>
                  )}
                </article>
              )}
            </div>
          )}
        </section>
      )}

      {showChain && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="연속 퀘스트"
            canEdit={canEdit}
            editing={editing === 'chain'}
            onEdit={() => startEdit('chain')}
          />
          {editing === 'chain' ? (
            <>
              <EditRelatedList
                items={draft.chainQuests}
                onChange={(chainQuests) => patchDraft({ chainQuests })}
                disabled={saving}
                placeholder="연속 퀘스트 이름"
              />
              {sectionActions}
            </>
          ) : chainQuests.length > 0 ? (
            <QuestRelatedList
              items={chainQuests}
              currentName={quest.name}
              numbered
              onOpen={
                authToken
                  ? (item) => {
                      const name = (item.name || '')
                        .replace(/\s+/g, ' ')
                        .trim()
                      if (name) void openMatchedChainQuest(name)
                    }
                  : undefined
              }
              busy={jumpQuestLoading}
            />
          ) : (
            <p className="quest-muted">없음</p>
          )}
        </section>
      )}

      {showLinked && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="연결 지도/퀘스트"
            canEdit={canEdit}
            editing={editing === 'linked'}
            onEdit={() => startEdit('linked')}
          />
          {editing === 'linked' ? (
            <>
              <EditRelatedList
                items={draft.linkedQuests}
                onChange={(linkedQuests) => patchDraft({ linkedQuests })}
                disabled={saving}
                placeholder="연결 지도/퀘스트 이름"
              />
              {sectionActions}
            </>
          ) : linkedQuests.length > 0 ? (
            <QuestRelatedList
              items={linkedQuests}
              currentName={quest.name}
              numbered={false}
              showLinkKind
              onOpen={
                authToken
                  ? (item) => openMatchedLinked(item)
                  : undefined
              }
              busy={jumpQuestLoading || mapLoading}
            />
          ) : (
            <p className="quest-muted">없음</p>
          )}
        </section>
      )}

      {showWalkthrough && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="공략"
            canEdit={canEdit}
            editing={editing === 'walkthrough'}
            onEdit={() => startEdit('walkthrough')}
          />
          {editing === 'walkthrough' ? (
            <>
              <textarea
                className="quest-walkthrough-textarea"
                value={draft.walkthrough}
                onChange={(e) => patchDraft({ walkthrough: e.target.value })}
                rows={12}
                disabled={saving}
                aria-label="공략 내용"
              />
              {sectionActions}
            </>
          ) : walkthroughFlow.length > 0 ? (
            <div className="quest-steps-flow" role="list">
              {walkthroughFlow.map((item, idx) => {
                const prev = idx > 0 ? walkthroughFlow[idx - 1] : null
                const showArrow =
                  item.type === 'step' && prev?.type === 'step'
                const isLastStep =
                  item.type === 'step' && idx === walkthroughLastStepIdx
                const lastSkills =
                  isLastStep && item.type === 'step'
                    ? extractWalkthroughSkills(item.action, questSkills)
                    : null
                const tile =
                  item.type === 'step' ? (
                    <div
                      role="listitem"
                      className={`quest-step${isLastStep ? ' is-last' : ''}`}
                    >
                      <span className="quest-step-num" aria-hidden="true">
                        {item.num}
                      </span>
                      <div className="quest-step-body">
                        {item.place ? (
                          <span className="quest-step-place">{item.place}</span>
                        ) : null}
                        {(lastSkills?.action ||
                          (!lastSkills && item.action)) && (
                          <span className="quest-step-action">
                            {lastSkills ? lastSkills.action : item.action}
                          </span>
                        )}
                        {lastSkills && lastSkills.skills.length > 0 ? (
                          <ul className="quest-skill-chips quest-step-skill-chips">
                            {lastSkills.skills.map((skill, skillIdx) => {
                              const level = skillDisplayLevel(skill)
                              return (
                                <li
                                  key={`${skill.name}-${skill.level}-${skillIdx}`}
                                  className="is-skill-chip"
                                >
                                  <SkillEdgeLabel />
                                  <span>{skill.name}</span>
                                  {level != null && <em>Lv.{level}</em>}
                                </li>
                              )
                            })}
                          </ul>
                        ) : null}
                        {item.hint ? (
                          <span className="quest-step-hint">{item.hint}</span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div role="listitem" className="quest-step is-note">
                      <span className="quest-step-note-mark" aria-hidden="true">
                        ※
                      </span>
                      <p className="quest-step-body">{item.body}</p>
                    </div>
                  )
                return (
                  <Fragment key={`${item.type}-${idx}`}>
                    {showArrow ? (
                      <span className="quest-step-arrow" aria-hidden="true" />
                    ) : null}
                    {tile}
                  </Fragment>
                )
              })}
            </div>
          ) : (
            <p className="quest-muted">공략이 없습니다.</p>
          )}
        </section>
      )}

      {showProgress && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="진행"
            canEdit={canEdit}
            editing={editing === 'progress'}
            onEdit={() => startEdit('progress')}
          />
          {editing === 'progress' ? (
            <>
              <textarea
                className="quest-walkthrough-textarea"
                value={draft.progress}
                onChange={(e) => patchDraft({ progress: e.target.value })}
                rows={12}
                disabled={saving}
                aria-label="진행 내용"
              />
              {sectionActions}
            </>
          ) : progressBlocks.length > 0 ? (
            <div className="quest-progress">
              {progressBlocks.map((block, idx) => {
                const lines = block.split('\n')
                const title = lines[0] || ''
                const body = lines.slice(1).join('\n').trim()
                const isConclusion = /^결론/.test(title)
                return (
                  <article
                    key={idx}
                    className={isConclusion ? 'is-conclusion' : undefined}
                  >
                    <h4>{title}</h4>
                    {body && <p>{body}</p>}
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="quest-muted">진행 내용이 없습니다.</p>
          )}
        </section>
      )}

      {onToggleCompleted && (
        <div className="quest-complete-actions">
          {quest.completed ? (
            <button
              type="button"
              className="admin-btn"
              disabled={completionBusy}
              onClick={() => onToggleCompleted(false)}
            >
              {completionBusy ? '저장 중…' : '완료 취소'}
            </button>
          ) : (
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              disabled={completionBusy}
              onClick={() => onToggleCompleted(true)}
            >
              {completionBusy ? '저장 중…' : '완료'}
            </button>
          )}
        </div>
      )}

      {discoveryLoading ? (
        <LoadingOverlay label="발견물 불러오는 중…" />
      ) : null}
      {skillLoading ? <LoadingOverlay label="스킬 불러오는 중…" /> : null}
      {jumpQuestLoading ? (
        <LoadingOverlay label="퀘스트 불러오는 중…" />
      ) : null}
      {portLoading ? <LoadingOverlay label="도시 불러오는 중…" /> : null}
      {fieldLoading ? <LoadingOverlay label="육지 불러오는 중…" /> : null}
      {mapLoading ? <LoadingOverlay label="지도 불러오는 중…" /> : null}

      {discoveryMissName ? (
        <ConfirmLayer
          title="확인"
          message={`「${discoveryMissName}」 발견물이 없습니다.`}
          stack={1}
          onCancel={() => setDiscoveryMissName('')}
          confirmLabel={isAdmin ? '등록하러 이동하기' : undefined}
          onConfirm={
            isAdmin
              ? () => {
                  openDiscoveriesAddTab(discoveryMissName)
                  setDiscoveryMissName('')
                }
              : undefined
          }
        />
      ) : null}

      {discoveryError ? (
        <ConfirmLayer
          title="확인"
          message={discoveryError}
          stack={1}
          onCancel={() => setDiscoveryError('')}
        />
      ) : null}

      {skillMissName ? (
        <ConfirmLayer
          title="확인"
          message={`「${skillMissName}」 스킬이 없습니다.`}
          stack={1}
          onCancel={() => setSkillMissName('')}
          confirmLabel={isAdmin ? '등록하러 이동하기' : undefined}
          onConfirm={
            isAdmin
              ? () => {
                  openSkillsAddTab(skillMissName)
                  setSkillMissName('')
                }
              : undefined
          }
        />
      ) : null}

      {jumpQuestMissName ? (
        <ConfirmLayer
          title="확인"
          message={`「${jumpQuestMissName}」 퀘스트가 없습니다.`}
          stack={1}
          onCancel={() => setJumpQuestMissName('')}
          confirmLabel={isAdmin ? '등록하러 이동하기' : undefined}
          onConfirm={
            isAdmin
              ? () => {
                  openQuestsAddTab(jumpQuestMissName)
                  setJumpQuestMissName('')
                }
              : undefined
          }
        />
      ) : null}

      {skillError ? (
        <ConfirmLayer
          title="확인"
          message={skillError}
          stack={1}
          onCancel={() => setSkillError('')}
        />
      ) : null}

      {jumpQuestError ? (
        <ConfirmLayer
          title="확인"
          message={jumpQuestError}
          stack={1}
          onCancel={() => setJumpQuestError('')}
        />
      ) : null}

      {portMissName ? (
        <ConfirmLayer
          title="확인"
          message={`「${portMissName}」 도시가 없습니다.`}
          stack={1}
          onCancel={() => setPortMissName('')}
          confirmLabel={isAdmin ? '등록하러 이동하기' : undefined}
          onConfirm={
            isAdmin
              ? () => {
                  openPortsAddTab(portMissName)
                  setPortMissName('')
                }
              : undefined
          }
        />
      ) : null}

      {portError ? (
        <ConfirmLayer
          title="확인"
          message={portError}
          stack={1}
          onCancel={() => setPortError('')}
        />
      ) : null}

      {fieldMissName ? (
        <ConfirmLayer
          title="확인"
          message={`「${fieldMissName}」 육지가 없습니다.`}
          stack={1}
          onCancel={() => setFieldMissName('')}
          confirmLabel={isAdmin ? '등록하러 이동하기' : undefined}
          onConfirm={
            isAdmin
              ? () => {
                  openFieldsAddTab(fieldMissName)
                  setFieldMissName('')
                }
              : undefined
          }
        />
      ) : null}

      {fieldError ? (
        <ConfirmLayer
          title="확인"
          message={fieldError}
          stack={1}
          onCancel={() => setFieldError('')}
        />
      ) : null}

      {mapMissName ? (
        <ConfirmLayer
          title="확인"
          message={`「${mapMissName}」 지도가 없습니다.`}
          stack={1}
          onCancel={() => setMapMissName('')}
          confirmLabel={isAdmin ? '등록하러 이동하기' : undefined}
          onConfirm={
            isAdmin
              ? () => {
                  openMapsAddTab(mapMissName)
                  setMapMissName('')
                }
              : undefined
          }
        />
      ) : null}

      {mapError ? (
        <ConfirmLayer
          title="확인"
          message={mapError}
          stack={1}
          onCancel={() => setMapError('')}
        />
      ) : null}

      {discoveryDetail ? (
        <DetailModal
          title="발견물 상세"
          label={`${discoveryDetail.name} 상세`}
          onClose={() => {
            setDiscoveryDetail(null)
            setDiscoveryError('')
          }}
          stack={1}
          headerActions={
            isAdmin ? (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  const params = new URLSearchParams()
                  params.set('q', discoveryDetail.name)
                  params.set(
                    'open',
                    discoveryDetail.slug || discoveryDetail.name,
                  )
                  const url = `${window.location.pathname}${window.location.search}#/discoveries?${params.toString()}`
                  window.open(url, '_blank', 'noopener,noreferrer')
                }}
              >
                발견물 메뉴로 이동
              </button>
            ) : undefined
          }
        >
          <DiscoveryDetailView
            discovery={discoveryDetail}
            token={authToken}
            isAdmin={isAdmin}
            completionBusy={discoveryCompletionBusy}
            onToggleCompleted={(completed) =>
              void toggleDiscoveryCompleted(completed)
            }
          />
        </DetailModal>
      ) : null}

      {skillDetail ? (
        <DetailModal
          title="스킬 상세"
          label={`${skillDetail.name} 상세`}
          onClose={() => {
            setSkillDetail(null)
            setSkillError('')
          }}
          stack={1}
          headerActions={
            isAdmin ? (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  const params = new URLSearchParams()
                  params.set('q', skillDetail.name)
                  params.set('open', skillDetail.slug || skillDetail.name)
                  const url = `${window.location.pathname}${window.location.search}#/skills?${params.toString()}`
                  window.open(url, '_blank', 'noopener,noreferrer')
                }}
              >
                스킬 메뉴로 이동
              </button>
            ) : undefined
          }
        >
          <SkillDetailView
            skill={skillDetail}
            token={authToken}
            isAdmin={isAdmin}
          />
        </DetailModal>
      ) : null}

      {jumpQuestDetail ? (
        <DetailModal
          title="퀘스트 상세"
          label={`${jumpQuestDetail.name} 상세`}
          onClose={() => {
            setJumpQuestDetail(null)
            setJumpQuestError('')
          }}
          stack={1}
          headerActions={
            isAdmin ? (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  const params = new URLSearchParams()
                  params.set('q', jumpQuestDetail.name)
                  params.set(
                    'open',
                    jumpQuestDetail.slug || jumpQuestDetail.name,
                  )
                  const url = `${window.location.pathname}${window.location.search}#/quests?${params.toString()}`
                  window.open(url, '_blank', 'noopener,noreferrer')
                }}
              >
                퀘스트 메뉴로 이동
              </button>
            ) : undefined
          }
        >
          <QuestDetailView
            quest={jumpQuestDetail}
            token={authToken}
            isAdmin={isAdmin}
            completionBusy={jumpQuestBusy}
            onToggleCompleted={(completed) =>
              void toggleJumpQuestCompleted(completed)
            }
          />
        </DetailModal>
      ) : null}

      {portDetail ? (
        <DetailModal
          title="도시 상세"
          label={`${portDetail.name} 상세`}
          onClose={() => {
            setPortDetail(null)
            setPortError('')
          }}
          stack={1}
          headerActions={
            isAdmin ? (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  const params = new URLSearchParams()
                  params.set('q', portDetail.name)
                  params.set('open', portDetail.slug || portDetail.name)
                  const url = `${window.location.pathname}${window.location.search}#/ports?${params.toString()}`
                  window.open(url, '_blank', 'noopener,noreferrer')
                }}
              >
                도시 메뉴로 이동
              </button>
            ) : undefined
          }
        >
          <PortDetailView
            port={portDetail}
            token={authToken}
            isAdmin={isAdmin}
          />
        </DetailModal>
      ) : null}

      {fieldDetail ? (
        <DetailModal
          title="육지 상세"
          label={`${fieldDetail.name} 상세`}
          onClose={() => {
            setFieldDetail(null)
            setFieldError('')
          }}
          stack={1}
          headerActions={
            isAdmin ? (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  const params = new URLSearchParams()
                  params.set('q', fieldDetail.name)
                  params.set('open', fieldDetail.slug || fieldDetail.name)
                  const url = `${window.location.pathname}${window.location.search}#/fields?${params.toString()}`
                  window.open(url, '_blank', 'noopener,noreferrer')
                }}
              >
                육지 메뉴로 이동
              </button>
            ) : undefined
          }
        >
          <FieldDetailView
            field={fieldDetail}
            edit={
              isAdmin && authToken
                ? {
                    token: authToken,
                    onSaved: (field) => setFieldDetail(field),
                  }
                : undefined
            }
          />
        </DetailModal>
      ) : null}

      {mapDetail ? (
        <DetailModal
          title="지도 상세"
          label={`${mapDetail.name} 상세`}
          onClose={() => {
            setMapDetail(null)
            setMapError('')
          }}
          stack={1}
          headerActions={
            isAdmin ? (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  const params = new URLSearchParams()
                  params.set('q', mapDetail.name)
                  params.set('open', mapDetail.slug || mapDetail.name)
                  const url = `${window.location.pathname}${window.location.search}#/treasure-maps?${params.toString()}`
                  window.open(url, '_blank', 'noopener,noreferrer')
                }}
              >
                지도 메뉴로 이동
              </button>
            ) : undefined
          }
        >
          <TreasureMapDetailView map={mapDetail} />
        </DetailModal>
      ) : null}
    </div>
  )
}
