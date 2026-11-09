import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { fetchFieldByKey, fetchSkill, updatePort } from '../lib/api'
import type {
  FieldDetail,
  PortCharacter,
  PortCollectItem,
  PortDestination,
  PortDetail,
  PortLinkedPlace,
  PortProduction,
  PortReward,
  PortSaleItem,
  SkillDetail,
} from '../types'
import { ConfirmLayer } from './ConfirmLayer'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'
import { DetailModal } from './DetailModal'
import {
  countryNameFromCategory,
  countryTitleGradient,
  resolvePortFlagSrc,
} from '../lib/countryFlags'
import {
  PORT_CATEGORIES,
  isNationPortCategory,
} from '../lib/portCategories'
import { cleanQuestSkill, skillDisplayLevel } from '../lib/questSkills'
import { DucatAmount, DucatMark } from './DucatAmount'
import { FieldDetailView } from './FieldDetailView'
import { LandEdgeLabel } from './LandEdgeLabel'
import { LoadingOverlay } from './LoadingOverlay'
import { DiscoveryChips } from './modules/DiscoveryChips'
import { PortCategoryBadge } from './PortCategoryBadge'
import { SkillDetailView } from './SkillDetailView'
import { SkillEdgeLabel } from './SkillEdgeLabel'

function isCityOutskirtsKind(kind: string | null | undefined) {
  return String(kind || '').trim() === '도시 외곽'
}

function formatRewardAmount(amount: string | null | undefined) {
  const text = String(amount || '').trim()
  if (!text) return null
  // 금액 칸은 숫자만 있어도 두캇으로 표기
  if (/^[\d,]+(?:\.\d+)?$/.test(text)) {
    return <DucatAmount value={`${text}두캇`} />
  }
  return <DucatAmount value={text} />
}

type PortDetailViewProps = {
  port: PortDetail
  /** 카탈로그 점프용 (없으면 edit.token) */
  token?: string
  isAdmin?: boolean
  /** 관리자 수정 모드 (토글). false면 사용자 화면처럼 표시 */
  editMode?: boolean
  edit?: {
    token: string
    onSaved: (port: PortDetail) => void
    onToast?: (text: string) => void
  }
}

type EditSection =
  | 'basic'
  | 'rewards'
  | 'places'
  | 'characters'
  | 'production'
  | 'destinations'
  | 'sales'
  | 'collect'
  | 'description'

const PORT_FACILITIES = [
  '서고',
  '학교',
  '의뢰 중개인',
  '조합 사무소',
  '길드 사무소',
  '조선소',
  '생산공장',
  '부관',
  '집정관',
]

const PRODUCTION_TABS = [
  '장식품 제작',
  '고정 레시피 책',
  '일반 건조',
  '특수 건조',
]

const SHIPBUILD_PRODUCTION_TABS = ['일반 건조', '특수 건조']

function isShipbuildProductionTab(tab: string) {
  return SHIPBUILD_PRODUCTION_TABS.includes(tab)
}

function productionItemsLabel(tab: string) {
  if (isShipbuildProductionTab(tab)) return '선박'
  if (tab === '장식품 제작') return '장식품'
  if (tab === '고정 레시피 책') return '레시피'
  return '항목'
}

const DEST_TABS = ['보물지도', '퀘스트']

const SALE_VENDORS = [
  '거래상인',
  '교역소주인',
  '대상인',
  '대장장이',
  '도구점 주인',
  '돛제작자',
  '무기장인',
  '번역가',
  '제재소장인',
  '조각가',
  '조선소주인',
  '판매원',
  '행상인',
]

const COLLECT_SOURCES = ['탐색', '낚시']

/** 쉼표 구분 텍스트 → 칩 목록 */
function csvChips(content: string | null | undefined): string[] {
  return String(content || '')
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

const SALE_CATEGORY_ROOTS = [
  '소비품',
  '교역품',
  '장비품',
  '레시피책',
  '레시피',
  '발견물',
  '선박재료',
  '선박',
]

/** `소비품 » 항해` / `소비품항해` → [소비품, 항해] */
function saleCategoryParts(category: string | null | undefined): string[] {
  const raw = String(category || '').trim()
  if (!raw) return []
  if (/[»›>]/.test(raw)) {
    return raw
      .split(/\s*[»›>]\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  for (const root of SALE_CATEGORY_ROOTS) {
    if (raw === root) return [root]
    if (raw.startsWith(root) && raw.length > root.length) {
      const rest = raw.slice(root.length).replace(/^[\s·\-_/／]+/, '').trim()
      if (rest) return [root, rest]
    }
  }
  return [raw]
}

function SaleCategoryCell({ category }: { category: string | null | undefined }) {
  const parts = saleCategoryParts(category)
  if (parts.length === 0) return <>-</>
  if (parts.length === 1) return <>{parts[0]}</>
  return (
    <span className="port-sale-category">
      <strong>{parts[0]}</strong>
      <span>{parts.slice(1).join(' ')}</span>
    </span>
  )
}

/** 연결 장소 내용에서 `(도시명)` 접미사를 빼고 칩 목록으로 나눔 */
function placeContentChips(content: string, cityName: string): string[] {
  const city = cityName.trim()
  const esc = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = esc ? new RegExp(`\\s*\\(${esc}\\)`, 'g') : null
  return csvChips(content).map((part) => {
    if (!re) return part
    return part.replace(re, '').trim()
  }).filter(Boolean)
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value?.trim() ? value : '-'}</strong>
    </div>
  )
}

function clonePort(port: PortDetail): PortDetail {
  return {
    ...port,
    flagImage: port.flagImage ?? null,
    rewards: (port.rewards || []).map((r) => ({ ...r })),
    collectItems: (port.collectItems || []).map((c) => ({ ...c })),
    linkedPlaces: (port.linkedPlaces || []).map((p) => ({ ...p })),
    characters: (port.characters || []).map((c) => ({ ...c })),
    productions: (port.productions || []).map((p) => ({ ...p })),
    destinations: (port.destinations || []).map((d) => ({ ...d })),
    saleItems: (port.saleItems || []).map((s) => ({ ...s })),
  }
}

function PortFlag({
  src,
  alt,
  className,
}: {
  src: string | null | undefined
  alt?: string | null
  className?: string
}) {
  if (!src) return null
  return (
    <img
      className={className || 'port-flag'}
      src={src}
      alt={alt || '도시 깃발'}
      loading="lazy"
      decoding="async"
    />
  )
}

function numOrEmpty(value: number | null | undefined) {
  return value == null ? '' : String(value)
}

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseFacilities(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,\uFF0C]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function joinFacilities(list: string[]): string | null {
  const cleaned = list.map((s) => s.trim()).filter(Boolean)
  return cleaned.length ? cleaned.join(', ') : null
}

type CollectViewLine = {
  source: string
  line: '교환' | '방생' | '아이템'
  names: string[]
  rank: number | null
  type: string | null
  recommendSpot: string | null
}

/** 이름 뒤 (교환)/(방생)을 풀어 교환 줄·방생 줄로 묶음 */
function collectViewLines(items: PortCollectItem[]): CollectViewLine[] {
  type Flat = {
    source: string
    name: string
    rank: number | null
    type: string | null
    recommendSpot: string | null
    kind: '교환' | '방생' | '아이템'
  }
  const flat: Flat[] = []

  for (const item of items) {
    const parts = String(item.name || '')
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const chunks = parts.length > 0 ? parts : ['']
    for (const part of chunks) {
      let name = part
      const fishing = item.source === '낚시'
      // 낚시: 방생만 방생 줄, 나머지(교환·무표기)는 교환 줄
      let kind: Flat['kind'] = fishing ? '교환' : '아이템'
      if (item.canRelease === true) kind = '방생'
      else if (item.canExchange === true) kind = '교환'
      while (true) {
        const m = name.match(/^(.*)\((교환|방생)\)\s*$/)
        if (!m) break
        name = m[1].trim()
        kind = m[2] === '방생' ? '방생' : '교환'
      }
      if (!name) continue
      if (fishing && kind === '아이템') kind = '교환'
      flat.push({
        source: item.source,
        name,
        rank: item.rank,
        type: item.type,
        recommendSpot: item.recommendSpot,
        kind,
      })
    }
  }

  const groupOrder: string[] = []
  const groups = new Map<
    string,
    {
      source: string
      rank: number | null
      type: string | null
      recommendSpot: string | null
      exchange: string[]
      release: string[]
      other: string[]
    }
  >()

  for (const row of flat) {
    const key = `${row.source}\t${row.rank ?? ''}\t${row.type ?? ''}`
    let g = groups.get(key)
    if (!g) {
      g = {
        source: row.source,
        rank: row.rank,
        type: row.type,
        recommendSpot: row.recommendSpot,
        exchange: [],
        release: [],
        other: [],
      }
      groups.set(key, g)
      groupOrder.push(key)
    }
    if (row.kind === '교환') g.exchange.push(row.name)
    else if (row.kind === '방생') g.release.push(row.name)
    else g.other.push(row.name)
  }

  const lines: CollectViewLine[] = []
  for (const key of groupOrder) {
    const g = groups.get(key)!
    const base = {
      source: g.source,
      rank: g.rank,
      type: g.type,
      recommendSpot: g.recommendSpot,
    }
    if (g.source === '낚시') {
      const exchange = [...g.exchange, ...g.other]
      if (exchange.length > 0) {
        lines.push({ ...base, line: '교환', names: exchange })
      }
      if (g.release.length > 0) {
        lines.push({ ...base, line: '방생', names: g.release })
      }
      continue
    }
    const hasTagged = g.exchange.length > 0 || g.release.length > 0
    if (hasTagged) {
      if (g.exchange.length > 0) {
        lines.push({ ...base, line: '교환', names: g.exchange })
      }
      if (g.release.length > 0) {
        lines.push({ ...base, line: '방생', names: g.release })
      }
      if (g.other.length > 0) {
        lines.push({ ...base, line: '아이템', names: g.other })
      }
    } else if (g.other.length > 0) {
      lines.push({ ...base, line: '아이템', names: g.other })
    }
  }
  return lines
}

function rewardOf(rewards: PortReward[], kind: string): PortReward {
  return (
    rewards.find((r) => r.kind === kind) || {
      kind,
      amount: '',
      reward: '',
    }
  )
}

function setRewardKind(
  rewards: PortReward[],
  kind: string,
  patch: Partial<PortReward>,
): PortReward[] {
  const idx = rewards.findIndex((r) => r.kind === kind)
  if (idx < 0) {
    return [...rewards, { kind, amount: '', reward: '', ...patch }]
  }
  return rewards.map((r, i) => (i === idx ? { ...r, ...patch } : r))
}

export function PortDetailView({
  port,
  token,
  isAdmin = false,
  edit,
  editMode = false,
}: PortDetailViewProps) {
  const authToken = token || edit?.token || ''
  const canEdit = Boolean(edit) && editMode
  const [editing, setEditing] = useState<EditSection | null>(null)
  const [draft, setDraft] = useState(() => clonePort(port))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [prodTab, setProdTab] = useState(PRODUCTION_TABS[0])
  const [destTab, setDestTab] = useState(DEST_TABS[0])
  const [saleTab, setSaleTab] = useState(SALE_VENDORS[0])
  const [skillDetail, setSkillDetail] = useState<SkillDetail | null>(null)
  const [skillLoading, setSkillLoading] = useState(false)
  const [skillMissName, setSkillMissName] = useState('')
  const [skillError, setSkillError] = useState('')
  const [fieldDetail, setFieldDetail] = useState<FieldDetail | null>(null)
  const [fieldLoading, setFieldLoading] = useState(false)
  const [fieldMissName, setFieldMissName] = useState('')
  const [fieldError, setFieldError] = useState('')

  useEffect(() => {
    setDraft(clonePort(port))
    setEditing(null)
    setError('')
    setSkillDetail(null)
    setSkillMissName('')
    setSkillError('')
    setFieldDetail(null)
    setFieldMissName('')
    setFieldError('')
  }, [port])

  useEffect(() => {
    if (!canEdit) {
      setDraft(clonePort(port))
      setEditing(null)
      setError('')
    }
  }, [canEdit, port])

  const coords =
    port.coordX != null && port.coordY != null
      ? `${port.coordX}, ${port.coordY}`
      : null

  const productionTabs = useMemo(() => {
    const fromData = (port.productions || [])
      .map((p) => p.tab)
      .filter(Boolean)
    return [...new Set(fromData)]
  }, [port.productions])

  const destTabs = useMemo(() => {
    const fromData = (port.destinations || [])
      .map((d) => d.source)
      .filter(Boolean)
    return [...new Set(fromData)]
  }, [port.destinations])

  const saleTabs = useMemo(() => {
    const fromData = (port.saleItems || [])
      .map((s) => s.vendor)
      .filter(Boolean)
    return [...new Set(fromData)]
  }, [port.saleItems])

  useEffect(() => {
    if (productionTabs.length === 0) return
    if (!productionTabs.includes(prodTab)) setProdTab(productionTabs[0])
  }, [productionTabs, prodTab])

  useEffect(() => {
    if (destTabs.length === 0) return
    if (!destTabs.includes(destTab)) setDestTab(destTabs[0])
  }, [destTabs, destTab])

  useEffect(() => {
    if (saleTabs.length === 0) return
    if (!saleTabs.includes(saleTab)) setSaleTab(saleTabs[0])
  }, [saleTabs, saleTab])

  function startEdit(section: EditSection) {
    setDraft(clonePort(port))
    setError('')
    setEditing(section)
  }

  function cancelEdit() {
    setDraft(clonePort(port))
    setError('')
    setEditing(null)
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

  async function saveSection() {
    if (!edit || !editing) return
    setSaving(true)
    setError('')
    try {
      let patch: Partial<PortDetail> = {}
      if (editing === 'basic') {
        if (!draft.name.trim()) throw new Error('항구(도시) 이름이 필요합니다.')
        patch = {
          name: draft.name,
          altName: draft.altName,
          category: draft.category,
          region: draft.region,
          seaArea: draft.seaArea,
          coordX: draft.coordX,
          coordY: draft.coordY,
          entryPermit: draft.entryPermit,
          culture: draft.culture,
          language: draft.language,
          facilities: draft.facilities,
          flagQuest: draft.flagQuest,
          flagImage: draft.flagImage,
        }
      } else if (editing === 'description') {
        patch = { description: draft.description }
      } else if (editing === 'rewards') {
        patch = {
          rewards: draft.rewards.filter(
            (r) => r.kind.trim() || r.amount.trim() || r.reward.trim(),
          ),
        }
      } else if (editing === 'places') {
        patch = {
          linkedPlaces: draft.linkedPlaces.filter(
            (p) => p.kind.trim() || p.content.trim(),
          ),
        }
      } else if (editing === 'characters') {
        patch = {
          characters: draft.characters.filter(
            (c) =>
              c.name.trim() ||
              c.preferredReport ||
              c.skills ||
              c.tarot,
          ),
        }
      } else if (editing === 'production') {
        patch = {
          productions: draft.productions.filter(
            (p) =>
              p.maker.trim() ||
              p.items.trim() ||
              p.rank != null,
          ),
        }
      } else if (editing === 'destinations') {
        patch = {
          destinations: draft.destinations.filter(
            (d) => d.discovery.trim() || d.content.trim(),
          ),
        }
      } else if (editing === 'sales') {
        patch = {
          saleItems: draft.saleItems.filter(
            (s) => s.item.trim() || s.category.trim() || s.price,
          ),
        }
      } else if (editing === 'collect') {
        patch = {
          collectItems: draft.collectItems.filter(
            (c) => c.name.trim() || c.rank != null || c.recommendSpot,
          ),
        }
      }
      const res = await updatePort(edit.token, port.id, patch)
      edit.onSaved(res.port)
      edit.onToast?.(`저장 완료 · ${res.port.name}`)
      setEditing(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '항구 저장에 실패했습니다.'
      setError(message)
      edit.onToast?.(message)
    } finally {
      setSaving(false)
    }
  }

  const showRewards = canEdit || (port.rewards || []).length > 0
  const showPlaces = canEdit || (port.linkedPlaces || []).length > 0
  const showCharacters = canEdit || (port.characters || []).length > 0
  const showProduction = canEdit || (port.productions || []).length > 0
  const showDest = canEdit || (port.destinations || []).length > 0
  const showSales = canEdit || (port.saleItems || []).length > 0
  const showCollect = canEdit || (port.collectItems || []).length > 0
  const showDescription = canEdit || Boolean(port.description)

  const prodRows = (port.productions || []).filter((p) => p.tab === prodTab)
  const destRows = (port.destinations || []).filter((d) => d.source === destTab)
  const saleRows = (port.saleItems || []).filter((s) => s.vendor === saleTab)

  const facilitySet = new Set(parseFacilities(draft.facilities))
  const categoryOptions =
    port.category &&
    !(PORT_CATEGORIES as readonly string[]).includes(port.category)
      ? [port.category, ...PORT_CATEGORIES]
      : [...PORT_CATEGORIES]
  const isNation = isNationPortCategory(port.category)
  const flagCountry = isNation ? countryNameFromCategory(port.category) : null
  // 깃발 모티브(블러 배경·타이틀 그라데이션·국가 깃발)는 본거지/영지만
  const heroFlagSrc = isNation
    ? resolvePortFlagSrc(port.flagImage, port.category)
    : port.flagImage?.trim() || null
  const titleGrad = isNation ? countryTitleGradient(flagCountry) : null
  const heroStyle = titleGrad
    ? ({ '--port-title-grad': titleGrad } as CSSProperties)
    : undefined
  const showFlagMotif = Boolean(isNation && heroFlagSrc)
  const languageChips = csvChips(port.language)

  return (
    <div className="quest-detail">
      <header
        className={`quest-detail-hero port-detail-hero${showFlagMotif ? ' has-flag-motif' : ''}${titleGrad ? ' has-title-grad' : ''}`}
        style={heroStyle}
      >
        {showFlagMotif && heroFlagSrc ? (
          <img
            className="port-detail-hero-flag-bg"
            src={heroFlagSrc}
            alt=""
            aria-hidden="true"
            decoding="async"
          />
        ) : null}
        <div className="port-detail-hero-main">
          <div className="quest-detail-hero-top">
            <PortCategoryBadge category={port.category} />
          </div>
          <h2 className="port-detail-title">
            <span className="port-detail-title-text">
              {port.name}
              {port.altName ? (
                <span className="port-alt-name"> ({port.altName})</span>
              ) : null}
            </span>
          </h2>
        </div>
        <PortFlag
          src={heroFlagSrc}
          alt={flagCountry ? `${flagCountry}의 깃발` : `${port.name} 깃발`}
          className="port-flag port-flag-hero"
        />
        {!canEdit && port.description ? <p>{port.description}</p> : null}
      </header>

      {error ? (
        <p className="form-note error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="quest-detail-section">
        <DetailSectionHead
          title="기본 정보"
          canEdit={canEdit}
          editing={editing === 'basic'}
          onEdit={() => startEdit('basic')}
        />
        {editing === 'basic' ? (
          <>
            <div className="quest-kv-grid sea-area-edit-grid port-basic-edit">
              <label className="field">
                <span>분류</span>
                <select
                  value={draft.category || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      category: e.target.value || null,
                    }))
                  }
                >
                  <option value="">선택</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>도시</span>
                <input
                  value={draft.name}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>깃발 이미지</span>
                <div className="port-flag-edit">
                  <PortFlag
                    src={
                      isNationPortCategory(draft.category)
                        ? resolvePortFlagSrc(draft.flagImage, draft.category)
                        : draft.flagImage
                    }
                    alt="미리보기"
                  />
                  <input
                    value={draft.flagImage || ''}
                    disabled={saving}
                    placeholder="/cities/….png 또는 /countries/….png"
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        flagImage: e.target.value || null,
                      }))
                    }
                  />
                </div>
              </label>
              <label className="field">
                <span>추가 이름</span>
                <input
                  value={draft.altName || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      altName: e.target.value || null,
                    }))
                  }
                />
              </label>
              <ClearableField
                label="지역"
                value={draft.region || ''}
                disabled={saving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, region: v || null }))
                }
              />
              <ClearableField
                label="해역"
                value={draft.seaArea || ''}
                disabled={saving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, seaArea: v || null }))
                }
              />
              <label className="field">
                <span>좌표</span>
                <div className="port-coord-pair">
                  <span>X</span>
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(draft.coordX)}
                    disabled={saving}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        coordX: parseOptionalInt(e.target.value),
                      }))
                    }
                  />
                  <span>Y</span>
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(draft.coordY)}
                    disabled={saving}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        coordY: parseOptionalInt(e.target.value),
                      }))
                    }
                  />
                </div>
              </label>
              <ClearableField
                label="입항허가"
                value={draft.entryPermit || ''}
                disabled={saving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, entryPermit: v || null }))
                }
              />
              <ClearableField
                label="문화"
                value={draft.culture || ''}
                disabled={saving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, culture: v || null }))
                }
              />
              <ClearableField
                label="언어"
                value={draft.language || ''}
                disabled={saving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, language: v || null }))
                }
              />
              <ClearableField
                label="플래그 퀘스트"
                value={draft.flagQuest || ''}
                disabled={saving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, flagQuest: v || null }))
                }
              />
              <div className="field port-facility-field">
                <span>시설</span>
                <div className="port-facility-grid">
                  {PORT_FACILITIES.map((f) => (
                    <label key={f} className="port-facility-check">
                      <input
                        type="checkbox"
                        checked={facilitySet.has(f)}
                        disabled={saving}
                        onChange={(e) => {
                          const next = new Set(facilitySet)
                          if (e.target.checked) next.add(f)
                          else next.delete(f)
                          setDraft((prev) => ({
                            ...prev,
                            facilities: joinFacilities([...next]),
                          }))
                        }}
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DetailSectionActions
              busy={saving}
              onCancel={cancelEdit}
              onSave={() => void saveSection()}
            />
          </>
        ) : (
          <div className="quest-kv-grid">
            <Row label="분류" value={port.category} />
            <Row label="지역" value={port.region} />
            <Row label="해역" value={port.seaArea} />
            <Row label="좌표" value={coords} />
            <Row label="입항허가" value={port.entryPermit} />
            <Row label="문화" value={port.culture} />
            <div>
              <span>언어</span>
              {languageChips.length > 0 ? (
                <ul className="quest-skill-chips">
                  {languageChips.map((lang) => {
                    const canOpen = Boolean(authToken && lang)
                    return (
                      <li key={lang} className="is-skill-chip">
                        <SkillEdgeLabel />
                        {canOpen ? (
                          <button
                            type="button"
                            className="quest-skill-chip-btn"
                            disabled={skillLoading}
                            onClick={() => void openMatchedSkill(lang)}
                          >
                            <span>{lang}</span>
                          </button>
                        ) : (
                          <span>{lang}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <strong>-</strong>
              )}
            </div>
            <Row label="시설" value={port.facilities} />
            {port.flagQuest ? (
              <Row label="플래그 퀘스트" value={port.flagQuest} />
            ) : null}
          </div>
        )}
      </section>

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
              <EditRewardsForm
                rewards={draft.rewards}
                disabled={saving}
                onChange={(rewards) =>
                  setDraft((prev) => ({ ...prev, rewards }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (port.rewards || []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>종류</th>
                    <th>금액</th>
                    <th>보상</th>
                  </tr>
                </thead>
                <tbody>
                  {(port.rewards || []).map((row, idx) => (
                    <tr key={`${row.kind}-${idx}`}>
                      <td>{row.kind}</td>
                      <td>{formatRewardAmount(row.amount) ?? '-'}</td>
                      <td>{row.reward || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 보상이 없습니다.</p>
          )}
        </section>
      )}

      {showPlaces && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="연결된 장소"
            canEdit={canEdit}
            editing={editing === 'places'}
            onEdit={() => startEdit('places')}
          />
          {editing === 'places' ? (
            <>
              <EditLinkedPlaces
                places={draft.linkedPlaces}
                disabled={saving}
                hideAdd
                onChange={(linkedPlaces) =>
                  setDraft((prev) => ({ ...prev, linkedPlaces }))
                }
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
                      setDraft((prev) => ({
                        ...prev,
                        linkedPlaces: [
                          ...prev.linkedPlaces,
                          { kind: '도시 외곽', content: '' },
                        ],
                      }))
                    }
                  >
                    추가
                  </button>
                }
              />
            </>
          ) : (port.linkedPlaces || []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table port-linked-places-table">
                <thead>
                  <tr>
                    <th className="port-place-kind">종류</th>
                    <th>내용</th>
                  </tr>
                </thead>
                <tbody>
                  {(port.linkedPlaces || []).map((row, idx) => {
                    const chips = placeContentChips(row.content, port.name)
                    const isOutskirts = isCityOutskirtsKind(row.kind)
                    return (
                      <tr key={`${row.kind}-${idx}`}>
                        <td className="port-place-kind">{row.kind}</td>
                        <td>
                          {chips.length > 0 ? (
                            <ul className="quest-skill-chips">
                              {chips.map((item) =>
                                isOutskirts ? (
                                  <li key={item} className="is-land-chip">
                                    {authToken ? (
                                      <button
                                        type="button"
                                        className="quest-skill-chip-btn"
                                        disabled={fieldLoading}
                                        onClick={() =>
                                          void openMatchedField(item)
                                        }
                                      >
                                        <span className="chip-edge-inner">
                                          <LandEdgeLabel />
                                          <span>{item}</span>
                                        </span>
                                      </button>
                                    ) : (
                                      <span className="chip-edge-inner">
                                        <LandEdgeLabel />
                                        <span>{item}</span>
                                      </span>
                                    )}
                                  </li>
                                ) : (
                                  <li key={item}>
                                    <span>{item}</span>
                                  </li>
                                ),
                              )}
                            </ul>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 연결 장소가 없습니다.</p>
          )}
        </section>
      )}

      {showCharacters && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="도시 인물"
            canEdit={canEdit}
            editing={editing === 'characters'}
            onEdit={() => startEdit('characters')}
          />
          {editing === 'characters' ? (
            <>
              <EditCharacters
                characters={draft.characters}
                disabled={saving}
                hideAdd
                onChange={(characters) =>
                  setDraft((prev) => ({ ...prev, characters }))
                }
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
                      setDraft((prev) => ({
                        ...prev,
                        characters: [
                          ...prev.characters,
                          {
                            name: '',
                            preferredReport: null,
                            skills: null,
                            tarot: null,
                          },
                        ],
                      }))
                    }
                  >
                    추가
                  </button>
                }
              />
            </>
          ) : (port.characters || []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>도시 인물</th>
                    <th>우대 보고</th>
                    <th>스킬</th>
                    <th>타로 카드</th>
                  </tr>
                </thead>
                <tbody>
                  {(port.characters || []).map((row, idx) => {
                    const skillChips = csvChips(row.skills)
                    return (
                      <tr key={`${row.name}-${idx}`}>
                        <td>{row.name}</td>
                        <td>{row.preferredReport || '-'}</td>
                        <td>
                          {skillChips.length > 0 ? (
                            <ul className="quest-skill-chips">
                              {skillChips.map((raw) => {
                                const skill = cleanQuestSkill({
                                  name: raw,
                                  level: null,
                                })
                                const level = skillDisplayLevel(skill)
                                const canOpen = Boolean(
                                  authToken && skill.name,
                                )
                                return (
                                  <li
                                    key={raw}
                                    className="is-skill-chip"
                                  >
                                    <SkillEdgeLabel />
                                    {canOpen ? (
                                      <button
                                        type="button"
                                        className="quest-skill-chip-btn"
                                        disabled={skillLoading}
                                        onClick={() =>
                                          void openMatchedSkill(skill.name)
                                        }
                                      >
                                        <span>{skill.name}</span>
                                        {level != null ? (
                                          <em>Lv.{level}</em>
                                        ) : null}
                                      </button>
                                    ) : (
                                      <>
                                        <span>{skill.name || raw}</span>
                                        {level != null ? (
                                          <em>Lv.{level}</em>
                                        ) : null}
                                      </>
                                    )}
                                  </li>
                                )
                              })}
                            </ul>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{row.tarot || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 도시 인물이 없습니다.</p>
          )}
        </section>
      )}

      {showProduction && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="생산"
            canEdit={canEdit}
            editing={editing === 'production'}
            onEdit={() => startEdit('production')}
          />
          {editing === 'production' ? (
            <>
              <EditProductions
                productions={draft.productions}
                disabled={saving}
                hideAdd
                onChange={(productions) =>
                  setDraft((prev) => ({ ...prev, productions }))
                }
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
                      setDraft((prev) => ({
                        ...prev,
                        productions: [
                          ...prev.productions,
                          {
                            tab: PRODUCTION_TABS[0],
                            maker: '',
                            rank: null,
                            items: '',
                          },
                        ],
                      }))
                    }
                  >
                    추가
                  </button>
                }
              />
            </>
          ) : (port.productions || []).length > 0 ? (
            <>
              {productionTabs.length > 0 ? (
                <div className="port-subtabs" role="tablist">
                  {productionTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      className={tab === prodTab ? 'active' : ''}
                      aria-selected={tab === prodTab}
                      onClick={() => setProdTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              ) : null}
              {prodRows.length > 0 ? (
                <div className="admin-table-wrap">
                  <table className="admin-table port-production-table">
                    <thead>
                      <tr>
                        {isShipbuildProductionTab(prodTab) ? (
                          <th className="port-prod-rank">랭크</th>
                        ) : (
                          <th className="port-prod-maker">제작자</th>
                        )}
                        <th>{productionItemsLabel(prodTab)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prodRows.map((row, idx) => {
                        const itemChips = csvChips(row.items)
                        return (
                          <tr
                            key={`${row.tab}-${row.maker}-${row.rank}-${idx}`}
                          >
                            {isShipbuildProductionTab(prodTab) ? (
                              <td className="port-prod-rank">
                                {row.rank ?? '-'}
                              </td>
                            ) : (
                              <td className="port-prod-maker">
                                {row.maker || '-'}
                              </td>
                            )}
                            <td>
                              {itemChips.length > 0 ? (
                                <ul className="quest-skill-chips">
                                  {itemChips.map((item) => (
                                    <li key={item}>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="form-note">이 탭에 등록된 생산이 없습니다.</p>
              )}
            </>
          ) : (
            <p className="form-note">등록된 생산이 없습니다.</p>
          )}
        </section>
      )}

      {showDest && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="목적지"
            canEdit={canEdit}
            editing={editing === 'destinations'}
            onEdit={() => startEdit('destinations')}
          />
          {editing === 'destinations' ? (
            <>
              <EditDestinations
                destinations={draft.destinations}
                disabled={saving}
                hideAdd
                onChange={(destinations) =>
                  setDraft((prev) => ({ ...prev, destinations }))
                }
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
                      setDraft((prev) => ({
                        ...prev,
                        destinations: [
                          ...prev.destinations,
                          {
                            source: DEST_TABS[0],
                            discovery: '',
                            content: '',
                          },
                        ],
                      }))
                    }
                  >
                    추가
                  </button>
                }
              />
            </>
          ) : (port.destinations || []).length > 0 ? (
            <>
              <div className="port-subtabs" role="tablist">
                {destTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    className={tab === destTab ? 'active' : ''}
                    aria-selected={tab === destTab}
                    onClick={() => setDestTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {destRows.length > 0 ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>발견물</th>
                        <th>내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {destRows.map((row, idx) => (
                        <tr key={`${row.discovery}-${idx}`}>
                          <td>
                            {row.discovery?.trim() ? (
                              <DiscoveryChips items={[row.discovery]} />
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>{row.content || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="form-note">이 탭에 등록된 목적지가 없습니다.</p>
              )}
            </>
          ) : (
            <p className="form-note">등록된 목적지가 없습니다.</p>
          )}
        </section>
      )}

      {showSales && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="판매 아이템"
            canEdit={canEdit}
            editing={editing === 'sales'}
            onEdit={() => startEdit('sales')}
          />
          {editing === 'sales' ? (
            <>
              <EditSaleItems
                items={draft.saleItems}
                disabled={saving}
                hideAdd
                onChange={(saleItems) =>
                  setDraft((prev) => ({ ...prev, saleItems }))
                }
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
                      setDraft((prev) => ({
                        ...prev,
                        saleItems: [
                          ...prev.saleItems,
                          {
                            vendor: SALE_VENDORS[0],
                            category: '',
                            item: '',
                            development: null,
                            investment: null,
                            contribution: null,
                            capital: null,
                            era: null,
                            price: null,
                          },
                        ],
                      }))
                    }
                  >
                    추가
                  </button>
                }
              />
            </>
          ) : (port.saleItems || []).length > 0 ? (
            <>
              <div className="port-subtabs" role="tablist">
                {saleTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    className={tab === saleTab ? 'active' : ''}
                    aria-selected={tab === saleTab}
                    onClick={() => setSaleTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {saleRows.length > 0 ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>분류</th>
                        <th>아이템</th>
                        <th>발전도</th>
                        <th>투자</th>
                        <th>공헌도</th>
                        <th>중심 도시</th>
                        <th>시대</th>
                        <th>가격</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saleRows.map((row, idx) => (
                        <tr key={`${row.item}-${idx}`}>
                          <td>
                            <SaleCategoryCell category={row.category} />
                          </td>
                          <td>{row.item || '-'}</td>
                          <td>{row.development || '-'}</td>
                          <td>{row.investment || '-'}</td>
                          <td>{row.contribution || '-'}</td>
                          <td>{row.capital || '-'}</td>
                          <td>{row.era || '-'}</td>
                          <td>{row.price || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="form-note">이 상점에 등록된 아이템이 없습니다.</p>
              )}
            </>
          ) : (
            <p className="form-note">등록된 판매 아이템이 없습니다.</p>
          )}
        </section>
      )}

      {showCollect && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="탐색 · 낚시"
            canEdit={canEdit}
            editing={editing === 'collect'}
            onEdit={() => startEdit('collect')}
          />
          {editing === 'collect' ? (
            <>
              <EditCollect
                items={draft.collectItems}
                disabled={saving}
                hideAdd
                onChange={(collectItems) =>
                  setDraft((prev) => ({ ...prev, collectItems }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
                leading={
                  <>
                    {COLLECT_SOURCES.map((source) => (
                      <button
                        key={source}
                        type="button"
                        className="btn-admin"
                        disabled={saving}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            collectItems: [
                              ...prev.collectItems,
                              {
                                source,
                                name: '',
                                rank: null,
                                type: null,
                                recommendSpot: null,
                                canExchange: source === '낚시' ? false : null,
                                canRelease: source === '낚시' ? false : null,
                              },
                            ],
                          }))
                        }
                      >
                        {source} 추가
                      </button>
                    ))}
                  </>
                }
              />
            </>
          ) : (port.collectItems || []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table port-collect-view-table">
                <thead>
                  <tr>
                    <th className="port-collect-source">구분</th>
                    <th>아이템</th>
                    <th className="col-desk">랭크</th>
                    <th className="col-desk">종류</th>
                  </tr>
                </thead>
                <tbody>
                  {collectViewLines(port.collectItems || []).map(
                    (row, idx) => (
                      <tr key={`${row.source}-${row.line}-${idx}`}>
                        <td className="port-collect-source">
                          {row.line === '아이템' ? (
                            row.source
                          ) : (
                            <span className="port-sale-category">
                              <strong>{row.source}</strong>
                              <span>{row.line}</span>
                            </span>
                          )}
                        </td>
                        <td>
                          {row.names.length > 0 ? (
                            <ul className="quest-skill-chips">
                              {row.names.map((name) => (
                                <li key={name}>
                                  <span>{name}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="col-desk">{row.rank ?? '-'}</td>
                        <td className="col-desk">{row.type || '-'}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 탐색·낚시가 없습니다.</p>
          )}
        </section>
      )}

      {showDescription && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="설명"
            canEdit={canEdit}
            editing={editing === 'description'}
            onEdit={() => startEdit('description')}
          />
          {editing === 'description' ? (
            <>
              <label className="field">
                <textarea
                  rows={4}
                  value={draft.description || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      description: e.target.value || null,
                    }))
                  }
                />
              </label>
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (
            <p>{port.description || '설명이 없습니다.'}</p>
          )}
        </section>
      )}

      {skillLoading ? <LoadingOverlay label="스킬 불러오는 중…" /> : null}
      {fieldLoading ? <LoadingOverlay label="육지 불러오는 중…" /> : null}

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

      {skillError ? (
        <ConfirmLayer
          title="확인"
          message={skillError}
          stack={1}
          onCancel={() => setSkillError('')}
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
            token={authToken}
            isAdmin={isAdmin}
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
    </div>
  )
}

function ClearableField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="port-clearable">
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="admin-danger-btn"
          disabled={disabled || !value}
          onClick={() => onChange('')}
        >
          삭제
        </button>
      </div>
    </label>
  )
}

function EditRewardsForm({
  rewards,
  onChange,
  disabled,
}: {
  rewards: PortReward[]
  onChange: (rewards: PortReward[]) => void
  disabled?: boolean
}) {
  const invest = rewardOf(rewards, '투자')
  const trade = rewardOf(rewards, '거래')
  return (
    <div className="quest-kv-grid sea-area-edit-grid">
      <ClearableField
        label="투자 보상"
        value={invest.reward}
        disabled={disabled}
        onChange={(v) => onChange(setRewardKind(rewards, '투자', { reward: v }))}
      />
      <label className="field">
        <span>투자</span>
        <div className="port-clearable">
          <input
            value={invest.amount}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                setRewardKind(rewards, '투자', { amount: e.target.value }),
              )
            }
          />
          <span className="port-unit">
            <DucatMark />
          </span>
        </div>
      </label>
      <ClearableField
        label="거래 보상"
        value={trade.reward}
        disabled={disabled}
        onChange={(v) => onChange(setRewardKind(rewards, '거래', { reward: v }))}
      />
      <label className="field">
        <span>거래</span>
        <div className="port-clearable">
          <input
            value={trade.amount}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                setRewardKind(rewards, '거래', { amount: e.target.value }),
              )
            }
          />
          <span className="port-unit">
            <DucatMark />
          </span>
        </div>
      </label>
    </div>
  )
}

function EditLinkedPlaces({
  places,
  onChange,
  disabled,
  hideAdd = false,
}: {
  places: PortLinkedPlace[]
  onChange: (places: PortLinkedPlace[]) => void
  disabled?: boolean
  hideAdd?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table port-linked-places-table">
          <thead>
            <tr>
              <th className="port-place-kind">종류</th>
              <th>내용</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {places.map((row, idx) => (
              <tr key={`place-${idx}`}>
                <td className="port-place-kind">
                  <input
                    value={row.kind}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        places.map((p, i) =>
                          i === idx ? { ...p, kind: e.target.value } : p,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.content}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        places.map((p, i) =>
                          i === idx ? { ...p, content: e.target.value } : p,
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
                    onClick={() => onChange(places.filter((_, i) => i !== idx))}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!hideAdd ? (
        <button
          type="button"
          className="admin-btn"
          disabled={disabled}
          onClick={() =>
            onChange([...places, { kind: '도시 외곽', content: '' }])
          }
        >
          추가
        </button>
      ) : null}
    </>
  )
}

function EditCharacters({
  characters,
  onChange,
  disabled,
  hideAdd = false,
}: {
  characters: PortCharacter[]
  onChange: (characters: PortCharacter[]) => void
  disabled?: boolean
  hideAdd?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>도시 인물</th>
              <th>우대 보고</th>
              <th>스킬</th>
              <th>타로 카드</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {characters.map((row, idx) => (
              <tr key={`char-${idx}`}>
                <td>
                  <input
                    value={row.name}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        characters.map((c, i) =>
                          i === idx ? { ...c, name: e.target.value } : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.preferredReport || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        characters.map((c, i) =>
                          i === idx
                            ? { ...c, preferredReport: e.target.value || null }
                            : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.skills || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        characters.map((c, i) =>
                          i === idx
                            ? { ...c, skills: e.target.value || null }
                            : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.tarot || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        characters.map((c, i) =>
                          i === idx
                            ? { ...c, tarot: e.target.value || null }
                            : c,
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
                    onClick={() =>
                      onChange(characters.filter((_, i) => i !== idx))
                    }
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!hideAdd ? (
        <button
          type="button"
          className="admin-btn"
          disabled={disabled}
          onClick={() =>
            onChange([
              ...characters,
              {
                name: '',
                preferredReport: null,
                skills: null,
                tarot: null,
              },
            ])
          }
        >
          추가
        </button>
      ) : null}
    </>
  )
}

function EditProductions({
  productions,
  onChange,
  disabled,
  hideAdd = false,
}: {
  productions: PortProduction[]
  onChange: (productions: PortProduction[]) => void
  disabled?: boolean
  hideAdd?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table port-production-table">
          <thead>
            <tr>
              <th>탭</th>
              <th className="port-prod-maker">제작자 / 랭크</th>
              <th>항목 · 선박</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {productions.map((row, idx) => {
              const shipbuild = isShipbuildProductionTab(row.tab)
              return (
                <tr key={`prod-${idx}`}>
                  <td>
                    <select
                      value={row.tab}
                      disabled={disabled}
                      onChange={(e) => {
                        const tab = e.target.value
                        const nextShip = isShipbuildProductionTab(tab)
                        onChange(
                          productions.map((p, i) =>
                            i === idx
                              ? {
                                  ...p,
                                  tab,
                                  maker: nextShip ? '' : p.maker,
                                  rank: nextShip ? p.rank : null,
                                }
                              : p,
                          ),
                        )
                      }}
                    >
                      {PRODUCTION_TABS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      {row.tab && !PRODUCTION_TABS.includes(row.tab) ? (
                        <option value={row.tab}>{row.tab}</option>
                      ) : null}
                    </select>
                  </td>
                  <td className="port-prod-maker">
                    {shipbuild ? (
                      <input
                        inputMode="numeric"
                        value={numOrEmpty(row.rank)}
                        disabled={disabled}
                        placeholder="랭크"
                        onChange={(e) =>
                          onChange(
                            productions.map((p, i) =>
                              i === idx
                                ? {
                                    ...p,
                                    rank: parseOptionalInt(e.target.value),
                                  }
                                : p,
                            ),
                          )
                        }
                      />
                    ) : (
                      <input
                        value={row.maker}
                        disabled={disabled}
                        placeholder="제작자"
                        onChange={(e) =>
                          onChange(
                            productions.map((p, i) =>
                              i === idx
                                ? { ...p, maker: e.target.value }
                                : p,
                            ),
                          )
                        }
                      />
                    )}
                  </td>
                  <td>
                    <input
                      value={row.items}
                      disabled={disabled}
                      placeholder={
                        shipbuild
                          ? '선박 (쉼표 구분)'
                          : productionItemsLabel(row.tab)
                      }
                      onChange={(e) =>
                        onChange(
                          productions.map((p, i) =>
                            i === idx ? { ...p, items: e.target.value } : p,
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
                      onClick={() =>
                        onChange(productions.filter((_, i) => i !== idx))
                      }
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!hideAdd ? (
        <button
          type="button"
          className="admin-btn"
          disabled={disabled}
          onClick={() =>
            onChange([
              ...productions,
              {
                tab: PRODUCTION_TABS[0],
                maker: '',
                rank: null,
                items: '',
              },
            ])
          }
        >
          추가
        </button>
      ) : null}
    </>
  )
}

function EditDestinations({
  destinations,
  onChange,
  disabled,
  hideAdd = false,
}: {
  destinations: PortDestination[]
  onChange: (destinations: PortDestination[]) => void
  disabled?: boolean
  hideAdd?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>구분</th>
              <th>발견물</th>
              <th>내용</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {destinations.map((row, idx) => (
              <tr key={`dest-${idx}`}>
                <td>
                  <select
                    value={row.source}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        destinations.map((d, i) =>
                          i === idx ? { ...d, source: e.target.value } : d,
                        ),
                      )
                    }
                  >
                    {DEST_TABS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    {row.source && !DEST_TABS.includes(row.source) ? (
                      <option value={row.source}>{row.source}</option>
                    ) : null}
                  </select>
                </td>
                <td>
                  <input
                    value={row.discovery}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        destinations.map((d, i) =>
                          i === idx ? { ...d, discovery: e.target.value } : d,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.content}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        destinations.map((d, i) =>
                          i === idx ? { ...d, content: e.target.value } : d,
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
                    onClick={() =>
                      onChange(destinations.filter((_, i) => i !== idx))
                    }
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!hideAdd ? (
        <button
          type="button"
          className="admin-btn"
          disabled={disabled}
          onClick={() =>
            onChange([
              ...destinations,
              { source: DEST_TABS[0], discovery: '', content: '' },
            ])
          }
        >
          추가
        </button>
      ) : null}
    </>
  )
}

function EditSaleItems({
  items,
  onChange,
  disabled,
  hideAdd = false,
}: {
  items: PortSaleItem[]
  onChange: (items: PortSaleItem[]) => void
  disabled?: boolean
  hideAdd?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>상점</th>
              <th>분류</th>
              <th>아이템</th>
              <th>발전도</th>
              <th>투자</th>
              <th>공헌도</th>
              <th>중심 도시</th>
              <th>시대</th>
              <th>가격</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, idx) => (
              <tr key={`sale-${idx}`}>
                <td>
                  <select
                    value={row.vendor}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((s, i) =>
                          i === idx ? { ...s, vendor: e.target.value } : s,
                        ),
                      )
                    }
                  >
                    {SALE_VENDORS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                    {row.vendor && !SALE_VENDORS.includes(row.vendor) ? (
                      <option value={row.vendor}>{row.vendor}</option>
                    ) : null}
                  </select>
                </td>
                <td>
                  <input
                    value={row.category}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((s, i) =>
                          i === idx ? { ...s, category: e.target.value } : s,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.item}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((s, i) =>
                          i === idx ? { ...s, item: e.target.value } : s,
                        ),
                      )
                    }
                  />
                </td>
                {(
                  [
                    'development',
                    'investment',
                    'contribution',
                    'capital',
                    'era',
                    'price',
                  ] as const
                ).map((key) => (
                  <td key={key}>
                    <input
                      value={row[key] || ''}
                      disabled={disabled}
                      onChange={(e) =>
                        onChange(
                          items.map((s, i) =>
                            i === idx
                              ? { ...s, [key]: e.target.value || null }
                              : s,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
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
      {!hideAdd ? (
        <button
          type="button"
          className="admin-btn"
          disabled={disabled}
          onClick={() =>
            onChange([
              ...items,
              {
                vendor: SALE_VENDORS[0],
                category: '',
                item: '',
                development: null,
                investment: null,
                contribution: null,
                capital: null,
                era: null,
                price: null,
              },
            ])
          }
        >
          추가
        </button>
      ) : null}
    </>
  )
}

function EditCollect({
  items,
  onChange,
  disabled,
  hideAdd = false,
}: {
  items: PortCollectItem[]
  onChange: (items: PortCollectItem[]) => void
  disabled?: boolean
  hideAdd?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>구분</th>
              <th>이름</th>
              <th>랭크</th>
              <th>추천 지점</th>
              <th>교환</th>
              <th>방생</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={`collect-${idx}`}>
                <td>
                  <select
                    value={item.source}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx ? { ...c, source: e.target.value } : c,
                        ),
                      )
                    }
                  >
                    {COLLECT_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    {item.source && !COLLECT_SOURCES.includes(item.source) ? (
                      <option value={item.source}>{item.source}</option>
                    ) : null}
                  </select>
                </td>
                <td>
                  <input
                    value={item.name}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx ? { ...c, name: e.target.value } : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(item.rank)}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx
                            ? { ...c, rank: parseOptionalInt(e.target.value) }
                            : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={item.recommendSpot || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx
                            ? {
                                ...c,
                                recommendSpot: e.target.value || null,
                              }
                            : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={item.canExchange === true}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx
                            ? { ...c, canExchange: e.target.checked }
                            : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={item.canRelease === true}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx
                            ? { ...c, canRelease: e.target.checked }
                            : c,
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
      {!hideAdd ? (
        <div className="port-collect-add">
          {COLLECT_SOURCES.map((source) => (
            <button
              key={source}
              type="button"
              className="admin-btn"
              disabled={disabled}
              onClick={() =>
                onChange([
                  ...items,
                  {
                    source,
                    name: '',
                    rank: null,
                    type: null,
                    recommendSpot: null,
                    canExchange: source === '낚시' ? false : null,
                    canRelease: source === '낚시' ? false : null,
                  },
                ])
              }
            >
              {source} 추가
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
}
