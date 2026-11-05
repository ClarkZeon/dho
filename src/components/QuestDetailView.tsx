import { Fragment, useEffect, useState } from 'react'
import {
  fetchDiscovery,
  setDiscoveryCompletion,
  updateQuest,
} from '../lib/api'
import { splitChainAndLinked } from '../lib/questChain'
import type {
  DiscoveryDetail,
  DiscoveryQuestRef,
  QuestChainItem,
  QuestDetail,
  QuestPrerequisite,
  QuestRewardItem,
  QuestSkillReq,
} from '../types'
import { DetailModal } from './DetailModal'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'
import { getModuleDef } from '../lib/detailModules'
import { DiscoveryDetailView } from './DiscoveryDetailView'
import {
  DiscoveryChips,
  parseDiscoveryLabel,
} from './modules/DiscoveryChips'
import { DiscoveryModule } from './modules/DiscoveryModule'

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
    difficulty: quest.difficulty,
    requestPlaces: quest.requestPlaces || '',
    destination: quest.destination || '',
    discoveryName: quest.discoveryName || '',
    discoveryCategory: quest.discoveryCategory || '',
    discoveryRank: quest.discoveryRank,
    skills: (quest.skills || []).map((s) => ({ ...s })),
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
      /** 대상/행동. `생선 파는 남자x2` → 생선 파는 남자 */
      action: string
      /** `(대장장이와 조선소 사이)` — 반복 첫 칸만 */
      hint: string | null
    }
  | { type: 'note'; body: string }

/**
 * `마르세이유, 생선 파는 남자x2 (대장장이와 조선소 사이)`
 * → 장소 유지 + 대상만 x2 반복, 괄호 힌트는 첫 칸만.
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
  // 괄호 제거 후 끝의 xN — `남자x2` / `남자 x2` (숫자만 있는 끝은 무시)
  const multX = body.match(/^(.*?)[x×Ｘｘ]\s*(\d+)\s*$/i)
  if (multX) {
    times = Math.min(20, Math.max(1, Number(multX[2]) || 1))
    body = multX[1].trim()
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

function isWalkthroughMapCaption(
  line: string,
  destination: string,
  placePrefixes: string[],
) {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (/^\d+\./.test(t) || /^[-–—]/.test(t) || /^[（(]/.test(t)) return false
  if (/지도\s*출처/.test(t)) return true
  if (destination && t === destination) return true
  return placePrefixes.some((p) => p && t === p)
}

function dropMapSource(text: string, destination?: string | null) {
  const dest = (destination || '').replace(/\s+/g, ' ').trim()
  const lines = text.split('\n')
  const placePrefixes = lines.map(placePrefixFromStep).filter(Boolean)
  const kept = lines
    .map((line) => line.replace(/지도\s*출처\s*[:：]?\s*.*$/, '').trimEnd())
    .filter((line, idx, arr) => {
      const t = line.trim()
      if (!t || /지도\s*출처/.test(t)) return false
      const next = arr.slice(idx + 1).find((l) => l.trim())
      if (next && /지도\s*출처/.test(next) && !/^\d+\./.test(t)) return false
      if (isWalkthroughMapCaption(t, dest, placePrefixes)) return false
      return true
    })
  while (kept.length) {
    const last = kept[kept.length - 1].trim()
    if (!last || isWalkthroughMapCaption(last, dest, placePrefixes)) {
      kept.pop()
      continue
    }
    break
  }
  return kept.join('\n').trim()
}

function DifficultyStars({ value }: { value: number | null }) {
  if (value == null) return <span className="quest-muted">-</span>
  const filled = Math.max(0, Math.min(10, value))
  return (
    <span className="quest-stars" aria-label={`난이도 ${filled}`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={i < filled ? 'is-on' : 'is-off'}>
          ★
        </span>
      ))}
      <em>{filled}</em>
    </span>
  )
}

type QuestDetailViewProps = {
  quest: QuestDetail
  /** 발견물 상세 조회용 (있으면 이름 매칭 시 링크) */
  token?: string
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
}: {
  items: QuestChainItem[]
  currentName: string
  numbered: boolean
}) {
  const Tag = numbered ? 'ol' : 'ul'
  return (
    <Tag className={`quest-chain${numbered ? '' : ' is-linked'}`}>
      {items.map((item, idx) => {
        const isCurrent =
          item.name &&
          item.name.replace(/\s+/g, ' ') === currentName.replace(/\s+/g, ' ')
        return (
          <li
            key={`${item.name || item.raw || idx}-${idx}`}
            className={isCurrent ? 'is-current' : undefined}
          >
            {numbered ? (
              <span className="quest-chain-idx">{idx + 1}</span>
            ) : null}
            <div>
              <strong>
                {item.name || item.raw || '퀘스트'}
                {isCurrent ? ' (현재)' : ''}
              </strong>
              <p>
                {[
                  item.category,
                  item.difficulty != null ? `난이도 ${item.difficulty}` : null,
                  item.places,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {item.skills && item.skills.length > 0 && (
                <p className="quest-chain-skills">
                  {item.skills
                    .map((s) =>
                      s.level != null ? `${s.name} ${s.level}` : s.name,
                    )
                    .join(', ')}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </Tag>
  )
}

function PrerequisiteLabel({ item }: { item: QuestPrerequisite }) {
  if (item.kind === 'discovery') {
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
      <span className="quest-prereq-discovery">
        {chip ? <DiscoveryChips items={[chip]} /> : item.raw}
        {item.nested ? (
          <em className="quest-prereq-nested">&lt;{item.nested}&gt;</em>
        ) : null}
      </span>
    )
  }
  if (item.kind === 'quest' && item.name) {
    const skillPart = (item.skills || [])
      .map((s) => (s.level != null ? `${s.name} ${s.level}` : s.name))
      .join(', ')
    const paren = [
      item.difficulty != null ? String(item.difficulty) : null,
      skillPart || null,
    ]
      .filter(Boolean)
      .join(' ')
    const bits = [
      item.category ? `${item.category} |` : null,
      item.name,
      paren ? `(${paren})` : null,
      item.places ? `- ${item.places}` : null,
    ].filter(Boolean)
    return <span>{bits.join(' ') || item.raw}</span>
  }
  return <span>{item.raw}</span>
}

function PrerequisiteBlock({ item }: { item: QuestPrerequisite }) {
  const children = item.children || []
  return (
    <div className="quest-prereq-item">
      <div className="quest-prereq-main">
        <PrerequisiteLabel item={item} />
      </div>
      {children.length > 0 ? (
        <ol className="quest-prereq-children">
          {children.map((child, idx) => (
            <li key={`${child.raw}-${idx}`}>
              <PrerequisiteLabel item={child} />
            </li>
          ))}
        </ol>
      ) : null}
    </div>
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
      <button
        type="button"
        className="admin-btn"
        disabled={disabled}
        onClick={() => onChange([...skills, { name: '', level: null }])}
      >
        추가
      </button>
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
  const [discoveryError, setDiscoveryError] = useState('')
  const [discoveryCompletionBusy, setDiscoveryCompletionBusy] = useState(false)

  useEffect(() => {
    setDraft(makeDraft(quest))
    setEditing(null)
    setError('')
  }, [quest])

  useEffect(() => {
    if (!canEdit) {
      setDraft(makeDraft(quest))
      setEditing(null)
      setError('')
    }
  }, [canEdit, quest])

  useEffect(() => {
    setDiscoveryDetail(null)
    setDiscoveryError('')
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

  async function openMatchedDiscovery(ref: DiscoveryQuestRef) {
    if (!authToken) return
    setDiscoveryLoading(true)
    setDiscoveryError('')
    try {
      const res = await fetchDiscovery(authToken, ref.slug)
      setDiscoveryDetail(res.discovery)
    } catch (err) {
      setDiscoveryError(
        err instanceof Error
          ? err.message
          : '발견물 상세를 불러오지 못했습니다.',
      )
    } finally {
      setDiscoveryLoading(false)
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
  const description = dropMapSource(quest.description || '', quest.destination)
  const walkthroughSteps = dropMapSource(
    quest.walkthrough || '',
    quest.destination,
  )
    .split('\n')
    .filter((line) => line.trim().length > 0)
  const walkthroughFlow = expandWalkthroughFlow(walkthroughSteps)
  const walkthroughLastStepIdx = walkthroughFlow.reduce(
    (acc, cur, i) => (cur.type === 'step' ? i : acc),
    -1,
  )

  // 1. / 1-1. / 2-1. 등 모두 동일 레벨 진행 단계로 분리
  const progressBlocks = dropMapSource(quest.progress || '', quest.destination)
    .split(/\n(?=\d+(?:-\d+)*\.\s+|결론\s*[-–—])/)
    .map((block) => block.trim())
    .filter(Boolean)

  const showSkills = canEdit || quest.skills.length > 0
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
          <DifficultyStars value={quest.difficulty} />
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
                <DifficultyStars value={quest.difficulty} />
              </strong>
            </div>
            <div>
              <span>의뢰 장소</span>
              {requestPlaceChips.length > 0 ? (
                <ul className="quest-skill-chips">
                  {requestPlaceChips.map((place) => (
                    <li key={place}>
                      <span>{place}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <strong>-</strong>
              )}
            </div>
            <div>
              <span>목적지</span>
              <strong>{quest.destination || '-'}</strong>
            </div>
          </div>
        )}
      </section>

      <DiscoveryModule
        quest={quest}
        canEdit={canEdit}
        discoveryLoading={discoveryLoading}
        discoveryError={discoveryError}
        onOpenDiscovery={
          authToken
            ? (ref) => void openMatchedDiscovery(ref)
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
              {sectionActions}
            </>
          ) : quest.skills.length ? (
            <ul className="quest-skill-chips">
              {quest.skills.map((skill, idx) => (
                <li key={`${skill.name}-${skill.level}-${idx}`}>
                  <span>{skill.name}</span>
                  {skill.level != null && <em>Lv.{skill.level}</em>}
                </li>
              ))}
            </ul>
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
            <ul className="quest-prereq-list">
              {(quest.prerequisites || []).map((item, idx) => (
                <li key={`${item.raw}-${idx}`}>
                  <PrerequisiteBlock item={item} />
                </li>
              ))}
            </ul>
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
                        <li key={`${item.name}-${item.qty}-${idx}`}>
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
                    ? extractWalkthroughSkills(item.action, quest.skills)
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
                            {lastSkills.skills.map((skill, skillIdx) => (
                              <li
                                key={`${skill.name}-${skill.level}-${skillIdx}`}
                              >
                                <span>{skill.name}</span>
                                {skill.level != null && (
                                  <em>Lv.{skill.level}</em>
                                )}
                              </li>
                            ))}
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

      {discoveryDetail ? (
        <DetailModal
          title="발견물 상세"
          label={`${discoveryDetail.name} 상세`}
          onClose={() => {
            setDiscoveryDetail(null)
            setDiscoveryError('')
          }}
          stack={1}
        >
          <DiscoveryDetailView
            discovery={discoveryDetail}
            completionBusy={discoveryCompletionBusy}
            onToggleCompleted={(completed) =>
              void toggleDiscoveryCompleted(completed)
            }
          />
        </DetailModal>
      ) : null}
    </div>
  )
}
