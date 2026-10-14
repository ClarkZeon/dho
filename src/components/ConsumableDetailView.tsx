import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { importConsumableReadBody, updateConsumable } from '../lib/api'
import type {
  ConsumableDetail,
  ConsumableInfoRow,
  ConsumableLandResurvey,
  ConsumablePet,
  ConsumableProduction,
  ConsumablePurchase,
} from '../types'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'

type ConsumableDetailViewProps = {
  consumable: ConsumableDetail
  edit?: {
    token: string
    onSaved: (consumable: ConsumableDetail) => void
    onToast?: (text: string) => void
  }
  /** @deprecated use edit */
  basicInfoEdit?: {
    token: string
    onSaved: (consumable: ConsumableDetail) => void
    onToast?: (text: string) => void
  }
}

type EditSection = 'basic' | 'acquire'

type AcquireTabKey =
  | 'purchases'
  | 'productions'
  | 'quests'
  | 'itemUses'
  | 'treasureBoxes'
  | 'events'
  | 'landResurveys'
  | 'pets'

const ACQUIRE_TABS: Array<{ key: AcquireTabKey; label: string }> = [
  { key: 'purchases', label: '구입' },
  { key: 'productions', label: '생산' },
  { key: 'quests', label: '퀘스트' },
  { key: 'itemUses', label: '아이템 사용' },
  { key: 'treasureBoxes', label: '트레져박스' },
  { key: 'events', label: '이벤트' },
  { key: 'landResurveys', label: '육지 재조사' },
  { key: 'pets', label: '애완동물' },
]

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value?.trim() ? value : '-'}</strong>
    </div>
  )
}

function methodsToText(methods: string[]) {
  return methods.length ? methods.join(' · ') : ''
}

function cloneConsumable(consumable: ConsumableDetail): ConsumableDetail {
  return {
    ...consumable,
    acquireMethods: [...(consumable.acquireMethods || [])],
    purchases: (consumable.purchases || []).map((p) => ({ ...p })),
    productions: (consumable.productions || []).map((r) => ({ ...r })),
    quests: (consumable.quests || []).map((r) => ({ ...r })),
    itemUses: (consumable.itemUses || []).map((r) => ({ ...r })),
    treasureBoxes: (consumable.treasureBoxes || []).map((r) => ({ ...r })),
    events: (consumable.events || []).map((r) => ({ ...r })),
    landResurveys: (consumable.landResurveys || []).map((r) => ({ ...r })),
    pets: (consumable.pets || []).map((r) => ({ ...r })),
  }
}

function tabHasData(consumable: ConsumableDetail, key: AcquireTabKey) {
  return (consumable[key] || []).length > 0
}

export function ConsumableDetailView({
  consumable,
  edit,
  basicInfoEdit,
}: ConsumableDetailViewProps) {
  const editApi = edit || basicInfoEdit
  const canEdit = Boolean(editApi)
  const [editing, setEditing] = useState<EditSection | null>(null)
  const [draft, setDraft] = useState(() => cloneConsumable(consumable))
  const [methodsDraft, setMethodsDraft] = useState(
    methodsToText(consumable.acquireMethods),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showReadBody, setShowReadBody] = useState(false)
  const [readBodyHtml, setReadBodyHtml] = useState('')
  const [readBodyBusy, setReadBodyBusy] = useState(false)
  const [readBodyNote, setReadBodyNote] = useState('')
  const [acquireTab, setAcquireTab] = useState<AcquireTabKey>(() => {
    const hit = ACQUIRE_TABS.find((t) => tabHasData(consumable, t.key))
    return hit?.key || 'purchases'
  })

  useEffect(() => {
    setDraft(cloneConsumable(consumable))
    setMethodsDraft(methodsToText(consumable.acquireMethods))
    setEditing(null)
    setError('')
    setShowReadBody(false)
    setReadBodyHtml('')
    setReadBodyNote('')
    const hit = ACQUIRE_TABS.find((t) => tabHasData(consumable, t.key))
    setAcquireTab(hit?.key || 'purchases')
  }, [consumable])

  const visibleTabs = useMemo(() => {
    if (canEdit) return ACQUIRE_TABS
    const withData = ACQUIRE_TABS.filter((t) => tabHasData(consumable, t.key))
    if (withData.length) return withData
    return ACQUIRE_TABS.filter((t) =>
      (consumable.acquireMethods || []).includes(t.label),
    )
  }, [canEdit, consumable])

  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === acquireTab) && visibleTabs[0]) {
      setAcquireTab(visibleTabs[0].key)
    }
  }, [visibleTabs, acquireTab])

  function startEdit(section: EditSection) {
    setDraft(cloneConsumable(consumable))
    setMethodsDraft(methodsToText(consumable.acquireMethods))
    setError('')
    setEditing(section)
  }

  function cancelEdit() {
    setDraft(cloneConsumable(consumable))
    setMethodsDraft(methodsToText(consumable.acquireMethods))
    setError('')
    setEditing(null)
  }

  async function saveSection() {
    if (!editApi || !editing) return
    setSaving(true)
    setError('')
    try {
      let patch: Partial<ConsumableDetail> = {}
      if (editing === 'basic') {
        patch = {
          category: draft.category,
          useEffect: draft.useEffect,
          acquireMethods: methodsDraft
            .split(/[·,，/|｜\n]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        }
      } else if (editing === 'acquire') {
        if (acquireTab === 'purchases') {
          patch = {
            purchases: draft.purchases.filter(
              (r) => r.npc.trim() || r.region.trim() || r.place.trim(),
            ),
          }
        } else if (acquireTab === 'productions') {
          patch = {
            productions: draft.productions.filter(
              (r) =>
                r.recipeBook.trim() ||
                r.recipe.trim() ||
                r.skill.trim() ||
                r.materials.trim(),
            ),
          }
        } else if (acquireTab === 'landResurveys') {
          patch = {
            landResurveys: draft.landResurveys.filter(
              (r) => r.region.trim() || r.fields.trim(),
            ),
          }
        } else if (acquireTab === 'pets') {
          patch = {
            pets: draft.pets.filter(
              (r) => r.category.trim() || r.region.trim() || r.place.trim(),
            ),
          }
        } else {
          const rows = (draft[acquireTab] as ConsumableInfoRow[]).filter(
            (r) => r.name.trim() || (r.detail || '').trim(),
          )
          patch = { [acquireTab]: rows }
        }
      }
      const res = await updateConsumable(editApi.token, consumable.id, patch)
      editApi.onSaved(res.consumable)
      editApi.onToast?.(`저장 완료 · ${res.consumable.name}`)
      setEditing(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '소비품 저장에 실패했습니다.'
      setError(message)
      editApi.onToast?.(message)
    } finally {
      setSaving(false)
    }
  }

  const showAcquire = canEdit || visibleTabs.length > 0

  async function submitReadBody(e: FormEvent) {
    e.preventDefault()
    if (!editApi) return
    if (!readBodyHtml.trim()) {
      setReadBodyNote('readBody HTML을 붙여넣어 주세요.')
      return
    }
    setReadBodyBusy(true)
    setReadBodyNote('')
    try {
      const res = await importConsumableReadBody(
        editApi.token,
        consumable.name,
        readBodyHtml,
      )
      editApi.onSaved(res.consumable)
      editApi.onToast?.(
        `readBody 갱신 완료 · ${res.consumable.name} (구입 ${res.consumable.purchases.length})`,
      )
      setReadBodyHtml('')
      setShowReadBody(false)
      setReadBodyNote('')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'readBody 갱신에 실패했습니다.'
      setReadBodyNote(message)
      editApi.onToast?.(message)
    } finally {
      setReadBodyBusy(false)
    }
  }

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">소비품</span>
          {canEdit ? (
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                setShowReadBody((v) => !v)
                setReadBodyNote('')
              }}
            >
              {showReadBody ? '닫기' : 'update readBody'}
            </button>
          ) : null}
        </div>
        <h2>{consumable.name}</h2>
        {consumable.description ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{consumable.description}</p>
        ) : null}
      </header>

      {showReadBody && canEdit ? (
        <form className="admin-import-form" onSubmit={submitReadBody}>
          <label className="field">
            <span>readBody HTML</span>
            <textarea
              className="quest-import-textarea"
              rows={14}
              value={readBodyHtml}
              onChange={(e) => setReadBodyHtml(e.target.value)}
              placeholder={`<div class="readBody">…</div>`}
              disabled={readBodyBusy}
            />
          </label>
          {readBodyNote ? (
            <p
              className={`form-note${
                /실패|못|오류|에러|없습니다/.test(readBodyNote) ? ' error' : ''
              }`}
              role="alert"
            >
              {readBodyNote}
            </p>
          ) : null}
          <div className="form-actions">
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={readBodyBusy}
            >
              {readBodyBusy ? '갱신 중…' : 'update readBody'}
            </button>
          </div>
        </form>
      ) : null}

      {error && editing === null ? (
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
          <div className="quest-kv-grid">
            <label className="field">
              <span>분류</span>
              <input
                type="text"
                value={draft.category || ''}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    category: e.target.value || null,
                  }))
                }
                disabled={saving}
              />
            </label>
            <label className="field">
              <span>사용효과</span>
              <input
                type="text"
                value={draft.useEffect || ''}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    useEffect: e.target.value || null,
                  }))
                }
                disabled={saving}
              />
            </label>
            <label className="field quest-kv-wide">
              <span>획득 방법</span>
              <input
                type="text"
                value={methodsDraft}
                onChange={(e) => setMethodsDraft(e.target.value)}
                disabled={saving}
                placeholder="구입 · 생산 · 퀘스트"
              />
            </label>
            {error ? (
              <p className="form-note error quest-kv-wide" role="alert">
                {error}
              </p>
            ) : null}
            <div className="quest-kv-wide">
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </div>
          </div>
        ) : (
          <div className="quest-kv-grid">
            <Row label="분류" value={consumable.category} />
            <Row label="사용효과" value={consumable.useEffect} />
            <div className="quest-kv-wide">
              <span>획득 방법</span>
              <strong>
                {consumable.acquireMethods.length
                  ? consumable.acquireMethods.join(' · ')
                  : '-'}
              </strong>
            </div>
          </div>
        )}
      </section>

      {showAcquire ? (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="획득 상세"
            canEdit={canEdit}
            editing={editing === 'acquire'}
            onEdit={() => startEdit('acquire')}
          />
          {visibleTabs.length > 0 ? (
            <div
              className="port-subtabs"
              role="tablist"
              aria-label="획득 상세 탭"
            >
              {visibleTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  className={tab.key === acquireTab ? 'active' : ''}
                  aria-selected={tab.key === acquireTab}
                  disabled={editing === 'acquire' && tab.key !== acquireTab}
                  onClick={() => {
                    if (editing === 'acquire') return
                    setAcquireTab(tab.key)
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}

          {editing === 'acquire' ? (
            <>
              <AcquireEditor
                tab={acquireTab}
                draft={draft}
                disabled={saving}
                onChange={setDraft}
              />
              {error ? (
                <p className="form-note error" role="alert">
                  {error}
                </p>
              ) : null}
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (
            <AcquireViewer tab={acquireTab} consumable={consumable} />
          )}
        </section>
      ) : null}
    </div>
  )
}

function AcquireViewer({
  tab,
  consumable,
}: {
  tab: AcquireTabKey
  consumable: ConsumableDetail
}) {
  if (tab === 'purchases') {
    const rows = consumable.purchases || []
    if (!rows.length) return <p className="form-note">등록된 구입 정보가 없습니다.</p>
    return (
      <SimpleTable
        headers={['판매 NPC', '지역', '장소', '가격']}
        rows={rows.map((r) => [r.npc, r.region, r.place, r.price || '-'])}
      />
    )
  }
  if (tab === 'productions') {
    const rows = consumable.productions || []
    if (!rows.length) return <p className="form-note">등록된 생산 정보가 없습니다.</p>
    return (
      <SimpleTable
        headers={['레시피 책', '레시피', '스킬', '재료']}
        rows={rows.map((r) => [
          r.recipeBook,
          r.recipe,
          r.skill,
          r.materials,
        ])}
      />
    )
  }
  if (tab === 'landResurveys') {
    const rows = consumable.landResurveys || []
    if (!rows.length) {
      return <p className="form-note">등록된 육지 재조사 정보가 없습니다.</p>
    }
    return (
      <SimpleTable
        headers={['지역', '필드']}
        rows={rows.map((r) => [r.region, r.fields])}
      />
    )
  }
  if (tab === 'pets') {
    const rows = consumable.pets || []
    if (!rows.length) {
      return <p className="form-note">등록된 애완동물 정보가 없습니다.</p>
    }
    return (
      <SimpleTable
        headers={['분류', '지역', '장소']}
        rows={rows.map((r) => [r.category, r.region, r.place])}
      />
    )
  }
  const rows = (consumable[tab] as ConsumableInfoRow[]) || []
  if (!rows.length) return <p className="form-note">등록된 정보가 없습니다.</p>
  const nameHeader =
    tab === 'quests'
      ? '퀘스트'
      : tab === 'events'
        ? '이벤트'
        : '아이템'
  return (
    <SimpleTable
      headers={[nameHeader, '비고']}
      rows={rows.map((r) => [r.name, r.detail || '-'])}
    />
  )
}

function AcquireEditor({
  tab,
  draft,
  onChange,
  disabled,
}: {
  tab: AcquireTabKey
  draft: ConsumableDetail
  onChange: (next: ConsumableDetail) => void
  disabled?: boolean
}) {
  if (tab === 'purchases') {
    return (
      <EditGrid
        disabled={disabled}
        headers={['판매 NPC', '지역', '장소', '가격']}
        rows={draft.purchases}
        keys={['npc', 'region', 'place', 'price'] as const}
        emptyRow={(): ConsumablePurchase => ({
          npc: '',
          region: '',
          place: '',
          price: null,
        })}
        onChange={(purchases) => onChange({ ...draft, purchases })}
      />
    )
  }
  if (tab === 'productions') {
    return (
      <EditGrid
        disabled={disabled}
        headers={['레시피 책', '레시피', '스킬', '재료']}
        rows={draft.productions}
        keys={['recipeBook', 'recipe', 'skill', 'materials'] as const}
        emptyRow={(): ConsumableProduction => ({
          recipeBook: '',
          recipe: '',
          skill: '',
          materials: '',
        })}
        onChange={(productions) => onChange({ ...draft, productions })}
      />
    )
  }
  if (tab === 'landResurveys') {
    return (
      <EditGrid
        disabled={disabled}
        headers={['지역', '필드']}
        rows={draft.landResurveys}
        keys={['region', 'fields'] as const}
        emptyRow={(): ConsumableLandResurvey => ({ region: '', fields: '' })}
        onChange={(landResurveys) => onChange({ ...draft, landResurveys })}
      />
    )
  }
  if (tab === 'pets') {
    return (
      <EditGrid
        disabled={disabled}
        headers={['분류', '지역', '장소']}
        rows={draft.pets}
        keys={['category', 'region', 'place'] as const}
        emptyRow={(): ConsumablePet => ({
          category: '',
          region: '',
          place: '',
        })}
        onChange={(pets) => onChange({ ...draft, pets })}
      />
    )
  }
  const key = tab
  const rows = draft[key] as ConsumableInfoRow[]
  return (
    <EditGrid
      disabled={disabled}
      headers={['이름', '비고']}
      rows={rows}
      keys={['name', 'detail'] as const}
      emptyRow={(): ConsumableInfoRow => ({ name: '', detail: null })}
      onChange={(next) => onChange({ ...draft, [key]: next })}
    />
  )
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: string[][]
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={`row-${idx}`}
              className={idx % 2 === 0 ? 'is-even' : 'is-odd'}
            >
              {row.map((cell, cIdx) => (
                <td key={cIdx}>{cell || '-'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EditGrid<T extends Record<string, string | null | undefined>>({
  headers,
  rows,
  keys,
  emptyRow,
  onChange,
  disabled,
}: {
  headers: string[]
  rows: T[]
  keys: ReadonlyArray<keyof T>
  emptyRow: () => T
  onChange: (rows: T[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`edit-${idx}`}>
                {keys.map((key) => (
                  <td key={String(key)}>
                    <input
                      value={row[key] == null ? '' : String(row[key])}
                      disabled={disabled}
                      onChange={(e) => {
                        const value = e.target.value
                        onChange(
                          rows.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  [key]:
                                    value === '' && key === 'detail'
                                      ? null
                                      : value === '' && key === 'price'
                                        ? null
                                        : value,
                                }
                              : r,
                          ),
                        )
                      }}
                    />
                  </td>
                ))}
                <td className="col-action">
                  <button
                    type="button"
                    className="admin-danger-btn"
                    disabled={disabled}
                    onClick={() => onChange(rows.filter((_, i) => i !== idx))}
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
        onClick={() => onChange([...rows, emptyRow()])}
      >
        추가
      </button>
    </>
  )
}
