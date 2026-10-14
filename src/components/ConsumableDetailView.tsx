import { useEffect, useMemo, useState } from 'react'
import { updateConsumable } from '../lib/api'
import type {
  ConsumableDetail,
  ConsumableInfoRow,
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

const ACQUIRE_TABS: Array<{
  key: AcquireTabKey
  label: string
  nameHeader: string
  detailHeader: string
}> = [
  {
    key: 'purchases',
    label: '구입',
    nameHeader: '판매 NPC',
    detailHeader: '지역 / 장소',
  },
  {
    key: 'productions',
    label: '생산',
    nameHeader: '내용',
    detailHeader: '상세',
  },
  {
    key: 'quests',
    label: '퀘스트',
    nameHeader: '퀘스트',
    detailHeader: '상세',
  },
  {
    key: 'itemUses',
    label: '아이템 사용',
    nameHeader: '아이템',
    detailHeader: '상세',
  },
  {
    key: 'treasureBoxes',
    label: '트레져박스',
    nameHeader: '내용',
    detailHeader: '상세',
  },
  {
    key: 'events',
    label: '이벤트',
    nameHeader: '이벤트',
    detailHeader: '상세',
  },
  {
    key: 'landResurveys',
    label: '육지 재조사',
    nameHeader: '장소',
    detailHeader: '상세',
  },
  {
    key: 'pets',
    label: '애완동물',
    nameHeader: '애완동물',
    detailHeader: '상세',
  },
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

function emptyArrays(consumable: ConsumableDetail): ConsumableDetail {
  return {
    ...consumable,
    purchases: consumable.purchases || [],
    productions: consumable.productions || [],
    quests: consumable.quests || [],
    itemUses: consumable.itemUses || [],
    treasureBoxes: consumable.treasureBoxes || [],
    events: consumable.events || [],
    landResurveys: consumable.landResurveys || [],
    pets: consumable.pets || [],
  }
}

function cloneConsumable(consumable: ConsumableDetail): ConsumableDetail {
  const base = emptyArrays(consumable)
  return {
    ...base,
    acquireMethods: [...(base.acquireMethods || [])],
    purchases: base.purchases.map((p) => ({ ...p })),
    productions: base.productions.map((r) => ({ ...r })),
    quests: base.quests.map((r) => ({ ...r })),
    itemUses: base.itemUses.map((r) => ({ ...r })),
    treasureBoxes: base.treasureBoxes.map((r) => ({ ...r })),
    events: base.events.map((r) => ({ ...r })),
    landResurveys: base.landResurveys.map((r) => ({ ...r })),
    pets: base.pets.map((r) => ({ ...r })),
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
  const [acquireTab, setAcquireTab] = useState<AcquireTabKey>(() => {
    const hit = ACQUIRE_TABS.find((t) => tabHasData(consumable, t.key))
    return hit?.key || 'purchases'
  })

  useEffect(() => {
    setDraft(cloneConsumable(consumable))
    setMethodsDraft(methodsToText(consumable.acquireMethods))
    setEditing(null)
    setError('')
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

  const activeMeta =
    ACQUIRE_TABS.find((t) => t.key === acquireTab) || ACQUIRE_TABS[0]

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

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">소비품</span>
        </div>
        <h2>{consumable.name}</h2>
        {consumable.description ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{consumable.description}</p>
        ) : null}
      </header>

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
                aria-label="분류"
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
                aria-label="사용효과"
              />
            </label>
            <label className="field quest-kv-wide">
              <span>획득 방법</span>
              <input
                type="text"
                value={methodsDraft}
                onChange={(e) => setMethodsDraft(e.target.value)}
                disabled={saving}
                aria-label="획득 방법"
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
            <div className="port-subtabs" role="tablist" aria-label="획득 상세 탭">
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
              {acquireTab === 'purchases' ? (
                <EditPurchases
                  rows={draft.purchases}
                  disabled={saving}
                  onChange={(purchases) =>
                    setDraft((prev) => ({ ...prev, purchases }))
                  }
                />
              ) : (
                <EditInfoRows
                  rows={draft[acquireTab] as ConsumableInfoRow[]}
                  nameHeader={activeMeta.nameHeader}
                  detailHeader={activeMeta.detailHeader}
                  disabled={saving}
                  onChange={(rows) =>
                    setDraft((prev) => ({ ...prev, [acquireTab]: rows }))
                  }
                />
              )}
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
          ) : acquireTab === 'purchases' ? (
            <PurchaseTable rows={consumable.purchases || []} />
          ) : (
            <InfoTable
              rows={(consumable[acquireTab] as ConsumableInfoRow[]) || []}
              nameHeader={activeMeta.nameHeader}
              detailHeader={activeMeta.detailHeader}
            />
          )}
        </section>
      ) : null}
    </div>
  )
}

function PurchaseTable({ rows }: { rows: ConsumablePurchase[] }) {
  if (!rows.length) {
    return <p className="form-note">등록된 구입 정보가 없습니다.</p>
  }
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>판매 NPC</th>
            <th>지역</th>
            <th>장소</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={`${row.npc}-${row.region}-${idx}`}
              className={idx % 2 === 0 ? 'is-even' : 'is-odd'}
            >
              <td>{row.npc || '-'}</td>
              <td>{row.region || '-'}</td>
              <td>{row.place || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InfoTable({
  rows,
  nameHeader,
  detailHeader,
}: {
  rows: ConsumableInfoRow[]
  nameHeader: string
  detailHeader: string
}) {
  if (!rows.length) {
    return <p className="form-note">등록된 정보가 없습니다.</p>
  }
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{nameHeader}</th>
            <th>{detailHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={`${row.name}-${idx}`}
              className={idx % 2 === 0 ? 'is-even' : 'is-odd'}
            >
              <td>{row.name || '-'}</td>
              <td>{row.detail || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EditPurchases({
  rows,
  onChange,
  disabled,
}: {
  rows: ConsumablePurchase[]
  onChange: (rows: ConsumablePurchase[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>판매 NPC</th>
              <th>지역</th>
              <th>장소</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`purchase-edit-${idx}`}>
                <td>
                  <input
                    value={row.npc}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx ? { ...r, npc: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.region}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx ? { ...r, region: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.place}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx ? { ...r, place: e.target.value } : r,
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
        onClick={() =>
          onChange([...rows, { npc: '', region: '', place: '' }])
        }
      >
        추가
      </button>
    </>
  )
}

function EditInfoRows({
  rows,
  nameHeader,
  detailHeader,
  onChange,
  disabled,
}: {
  rows: ConsumableInfoRow[]
  nameHeader: string
  detailHeader: string
  onChange: (rows: ConsumableInfoRow[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{nameHeader}</th>
              <th>{detailHeader}</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`info-edit-${idx}`}>
                <td>
                  <input
                    value={row.name}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx ? { ...r, name: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.detail || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx
                            ? { ...r, detail: e.target.value || null }
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
        onClick={() => onChange([...rows, { name: '', detail: null }])}
      >
        추가
      </button>
    </>
  )
}
