import { useEffect, useMemo, useState } from 'react'
import { updateEquipment } from '../lib/api'
import type {
  ConsumablePurchase,
  EquipmentDetail,
  EquipmentInfoRow,
  EquipmentQuestAcquire,
  EquipmentRequirements,
  EquipmentSkillBonus,
  EquipmentTransmutation,
} from '../types'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'

type EquipmentDetailViewProps = {
  equipment: EquipmentDetail
  edit?: {
    token: string
    onSaved: (equipment: EquipmentDetail) => void
    onToast?: (text: string) => void
  }
}

type EditSection = 'basic' | 'transmute' | 'acquire'

type AcquireTabKey =
  | 'purchases'
  | 'quests'
  | 'treasureMaps'
  | 'memorialAlbums'

const ACQUIRE_TABS: Array<{ key: AcquireTabKey; label: string }> = [
  { key: 'purchases', label: '구입' },
  { key: 'quests', label: '퀘스트' },
  { key: 'treasureMaps', label: '보물지도' },
  { key: 'memorialAlbums', label: '메모리얼 앨범' },
]

function Row({
  label,
  value,
  hideEmpty,
}: {
  label: string
  value: string | null
  hideEmpty?: boolean
}) {
  if (hideEmpty && !value?.trim()) return null
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

function formatSkillBonus(row: EquipmentSkillBonus) {
  if (!row.name.trim()) return ''
  return row.rank?.trim() ? `${row.name} +${row.rank}` : row.name
}

function emptyRequirements(): EquipmentRequirements {
  return {
    fame: null,
    infamy: null,
    gender: null,
    jobClass: null,
    title: null,
    alias: null,
  }
}

function cloneEquipment(equipment: EquipmentDetail): EquipmentDetail {
  return {
    ...equipment,
    skills: (equipment.skills || []).map((s) => ({ ...s })),
    equipmentEffects: (equipment.equipmentEffects || []).map((s) => ({
      ...s,
    })),
    requirements: { ...(equipment.requirements || emptyRequirements()) },
    acquireMethods: [...(equipment.acquireMethods || [])],
    purchases: (equipment.purchases || []).map((p) => ({ ...p })),
    transmutations: (equipment.transmutations || []).map((r) => ({ ...r })),
    quests: (equipment.quests || []).map((r) => ({ ...r })),
    treasureMaps: (equipment.treasureMaps || []).map((r) => ({ ...r })),
    memorialAlbums: (equipment.memorialAlbums || []).map((r) => ({ ...r })),
  }
}

function tabHasData(equipment: EquipmentDetail, key: AcquireTabKey) {
  return (equipment[key] || []).length > 0
}

export function EquipmentDetailView({
  equipment,
  edit,
}: EquipmentDetailViewProps) {
  const canEdit = Boolean(edit)
  const [editing, setEditing] = useState<EditSection | null>(null)
  const [draft, setDraft] = useState(() => cloneEquipment(equipment))
  const [methodsDraft, setMethodsDraft] = useState(
    methodsToText(equipment.acquireMethods),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [acquireTab, setAcquireTab] = useState<AcquireTabKey>(() => {
    const hit = ACQUIRE_TABS.find((t) => tabHasData(equipment, t.key))
    return hit?.key || 'quests'
  })

  useEffect(() => {
    setDraft(cloneEquipment(equipment))
    setMethodsDraft(methodsToText(equipment.acquireMethods))
    setEditing(null)
    setError('')
    const hit = ACQUIRE_TABS.find((t) => tabHasData(equipment, t.key))
    setAcquireTab(hit?.key || 'quests')
  }, [equipment])

  const visibleTabs = useMemo(() => {
    if (canEdit) return ACQUIRE_TABS
    return ACQUIRE_TABS.filter((t) => tabHasData(equipment, t.key))
  }, [canEdit, equipment])

  const showAcquire =
    canEdit ||
    equipment.acquireMethods.length > 0 ||
    ACQUIRE_TABS.some((t) => tabHasData(equipment, t.key))

  const showTransmute =
    canEdit || (equipment.transmutations || []).length > 0

  function startEdit(section: EditSection) {
    setDraft(cloneEquipment(equipment))
    setMethodsDraft(methodsToText(equipment.acquireMethods))
    setError('')
    setEditing(section)
  }

  function cancelEdit() {
    setDraft(cloneEquipment(equipment))
    setMethodsDraft(methodsToText(equipment.acquireMethods))
    setError('')
    setEditing(null)
  }

  async function saveSection() {
    if (!edit || !editing) return
    setSaving(true)
    setError('')
    try {
      let patch: Partial<EquipmentDetail> = {}
      if (editing === 'basic') {
        patch = {
          description: draft.description,
          altName: draft.altName,
          category: draft.category,
          useEffect: draft.useEffect,
          equipSlot: draft.equipSlot,
          durability: draft.durability,
          attack: draft.attack,
          defense: draft.defense,
          dressEtiquette: draft.dressEtiquette,
          disguise: draft.disguise,
          skills: draft.skills.filter((s) => s.name.trim()),
          equipmentEffects: draft.equipmentEffects.filter((s) => s.name.trim()),
          memorialAlbum: draft.memorialAlbum,
          requirements: draft.requirements,
          nonTradable: draft.nonTradable,
          acquireMethods: methodsDraft
            .split(/[·,，/|｜\n]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        }
      } else if (editing === 'transmute') {
        patch = {
          transmutations: draft.transmutations.filter(
            (r) =>
              r.policy.trim() ||
              r.skills.trim() ||
              r.materials.trim() ||
              r.product.trim(),
          ),
        }
      } else if (editing === 'acquire') {
        patch = {
          purchases: draft.purchases.filter(
            (r) => r.npc.trim() || r.region.trim() || r.place.trim(),
          ),
          quests: draft.quests.filter(
            (r) => r.quest.trim() || r.destination.trim(),
          ),
          treasureMaps: draft.treasureMaps.filter((r) => r.name.trim()),
          memorialAlbums: draft.memorialAlbums.filter((r) => r.name.trim()),
        }
      }
      const res = await updateEquipment(edit.token, equipment.id, patch)
      edit.onSaved(res.equipment)
      edit.onToast?.(`저장 완료 · ${res.equipment.name}`)
      setEditing(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '장비품 저장에 실패했습니다.'
      setError(message)
      edit.onToast?.(message)
    } finally {
      setSaving(false)
    }
  }

  const skillText = (equipment.skills || [])
    .map(formatSkillBonus)
    .filter(Boolean)
    .join(', ')
  const effectText = (equipment.equipmentEffects || [])
    .map(formatSkillBonus)
    .filter(Boolean)
    .join(', ')

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">장비품</span>
        </div>
        <h2>{equipment.name}</h2>
        {equipment.description ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{equipment.description}</p>
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
                value={draft.category || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    category: e.target.value || null,
                  }))
                }
              />
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
            <label className="field">
              <span>내구도</span>
              <input
                value={draft.durability || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    durability: e.target.value || null,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>장착 부위</span>
              <input
                value={draft.equipSlot || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    equipSlot: e.target.value || null,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>공격력</span>
              <input
                value={draft.attack || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    attack: e.target.value || null,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>방어력</span>
              <input
                value={draft.defense || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    defense: e.target.value || null,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>복장예절</span>
              <input
                value={draft.dressEtiquette || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    dressEtiquette: e.target.value || null,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>변장도</span>
              <input
                value={draft.disguise || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    disguise: e.target.value || null,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>사용효과</span>
              <input
                value={draft.useEffect || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    useEffect: e.target.value || null,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>메모리얼 앨범</span>
              <input
                value={draft.memorialAlbum || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    memorialAlbum: e.target.value || null,
                  }))
                }
              />
            </label>
            <label className="field quest-kv-wide">
              <span>설명</span>
              <textarea
                rows={3}
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
            <div className="quest-kv-wide">
              <span>스킬</span>
              <SkillBonusEditor
                rows={draft.skills}
                disabled={saving}
                onChange={(skills) => setDraft((prev) => ({ ...prev, skills }))}
              />
            </div>
            <div className="quest-kv-wide">
              <span>장비효과</span>
              <SkillBonusEditor
                rows={draft.equipmentEffects}
                disabled={saving}
                onChange={(equipmentEffects) =>
                  setDraft((prev) => ({ ...prev, equipmentEffects }))
                }
              />
            </div>
            <div className="quest-kv-wide">
              <span>필요</span>
              <RequirementsEditor
                value={draft.requirements}
                disabled={saving}
                onChange={(requirements) =>
                  setDraft((prev) => ({ ...prev, requirements }))
                }
              />
            </div>
            <label className="field">
              <span>특징</span>
              <label style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={draft.nonTradable}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      nonTradable: e.target.checked,
                    }))
                  }
                />
                거래 불가
              </label>
            </label>
            <label className="field quest-kv-wide">
              <span>획득 방법</span>
              <input
                value={methodsDraft}
                disabled={saving}
                onChange={(e) => setMethodsDraft(e.target.value)}
                placeholder="퀘스트 · 보물지도 · 메모리얼 앨범"
              />
            </label>
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
            <Row
              label="분류"
              value={equipment.category}
              hideEmpty={!canEdit}
            />
            <Row
              label="추가 이름"
              value={equipment.altName}
              hideEmpty={!canEdit}
            />
            <Row
              label="내구도"
              value={equipment.durability}
              hideEmpty={!canEdit}
            />
            <Row
              label="장착 부위"
              value={equipment.equipSlot}
              hideEmpty={!canEdit}
            />
            <Row
              label="공격력"
              value={equipment.attack}
              hideEmpty={!canEdit}
            />
            <Row
              label="방어력"
              value={equipment.defense}
              hideEmpty={!canEdit}
            />
            <Row
              label="복장예절"
              value={equipment.dressEtiquette}
              hideEmpty={!canEdit}
            />
            <Row
              label="변장도"
              value={equipment.disguise}
              hideEmpty={!canEdit}
            />
            <Row
              label="사용효과"
              value={equipment.useEffect}
              hideEmpty={!canEdit}
            />
            <Row
              label="스킬"
              value={skillText || null}
              hideEmpty={!canEdit}
            />
            <Row
              label="장비효과"
              value={effectText || null}
              hideEmpty={!canEdit}
            />
            <Row
              label="메모리얼 앨범"
              value={equipment.memorialAlbum}
              hideEmpty={!canEdit}
            />
            <Row
              label="특징"
              value={equipment.nonTradable ? '거래 불가' : null}
              hideEmpty={!canEdit}
            />
            <RequirementsViewer
              value={equipment.requirements}
              showEmpty={canEdit}
            />
            {canEdit || equipment.acquireMethods.length > 0 ? (
              <div className="quest-kv-wide">
                <span>획득 방법</span>
                <strong>
                  {equipment.acquireMethods.length
                    ? equipment.acquireMethods.join(' · ')
                    : '-'}
                </strong>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {showTransmute ? (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="변성연금"
            canEdit={canEdit}
            editing={editing === 'transmute'}
            onEdit={() => startEdit('transmute')}
          />
          {editing === 'transmute' ? (
            <>
              <TransmuteEditor
                rows={draft.transmutations}
                disabled={saving}
                onChange={(transmutations) =>
                  setDraft((prev) => ({ ...prev, transmutations }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (equipment.transmutations || []).length > 0 ? (
            <SimpleTable
              headers={['정책', '스킬', '재료', '생산품']}
              rows={equipment.transmutations.map((r) => [
                r.policy,
                r.skills,
                r.materials,
                r.product || '-',
              ])}
            />
          ) : (
            <p className="form-note">등록된 변성연금 정보가 없습니다.</p>
          )}
        </section>
      ) : null}

      {showAcquire ? (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="획득 방법"
            canEdit={canEdit}
            editing={editing === 'acquire'}
            onEdit={() => startEdit('acquire')}
          />
          {visibleTabs.length > 0 ? (
            <div
              className="port-subtabs"
              role="tablist"
              aria-label="장비품 획득 탭"
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
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (
            <AcquireViewer tab={acquireTab} equipment={equipment} />
          )}
        </section>
      ) : null}
    </div>
  )
}

function RequirementsViewer({
  value,
  showEmpty,
}: {
  value: EquipmentRequirements
  showEmpty?: boolean
}) {
  const req = value || emptyRequirements()
  const hasAny = [
    req.fame,
    req.infamy,
    req.gender,
    req.jobClass,
    req.title,
    req.alias,
  ].some((v) => v?.trim())
  if (!showEmpty && !hasAny) return null
  return (
    <>
      <Row label="명성" value={req.fame} hideEmpty={!showEmpty} />
      <Row label="악명" value={req.infamy} hideEmpty={!showEmpty} />
      <Row label="성별" value={req.gender} hideEmpty={!showEmpty} />
      <Row label="직업 계열" value={req.jobClass} hideEmpty={!showEmpty} />
      <Row label="작위" value={req.title} hideEmpty={!showEmpty} />
      <Row label="호칭" value={req.alias} hideEmpty={!showEmpty} />
    </>
  )
}

function RequirementsEditor({
  value,
  onChange,
  disabled,
}: {
  value: EquipmentRequirements
  onChange: (value: EquipmentRequirements) => void
  disabled?: boolean
}) {
  const req = value || emptyRequirements()
  function setField(key: keyof EquipmentRequirements, raw: string) {
    onChange({ ...req, [key]: raw.trim() ? raw : null })
  }
  return (
    <div className="quest-kv-grid">
      <label className="field">
        <span>명성</span>
        <input
          value={req.fame || ''}
          disabled={disabled}
          onChange={(e) => setField('fame', e.target.value)}
        />
      </label>
      <label className="field">
        <span>악명</span>
        <input
          value={req.infamy || ''}
          disabled={disabled}
          onChange={(e) => setField('infamy', e.target.value)}
        />
      </label>
      <label className="field">
        <span>성별</span>
        <input
          value={req.gender || ''}
          disabled={disabled}
          onChange={(e) => setField('gender', e.target.value)}
        />
      </label>
      <label className="field">
        <span>직업 계열</span>
        <input
          value={req.jobClass || ''}
          disabled={disabled}
          onChange={(e) => setField('jobClass', e.target.value)}
        />
      </label>
      <label className="field">
        <span>작위</span>
        <input
          value={req.title || ''}
          disabled={disabled}
          onChange={(e) => setField('title', e.target.value)}
        />
      </label>
      <label className="field">
        <span>호칭</span>
        <input
          value={req.alias || ''}
          disabled={disabled}
          onChange={(e) => setField('alias', e.target.value)}
        />
      </label>
    </div>
  )
}

function SkillBonusEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: EquipmentSkillBonus[]
  onChange: (rows: EquipmentSkillBonus[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>랭크</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`skill-${idx}`}>
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
                    value={row.rank || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx
                            ? { ...r, rank: e.target.value || null }
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
        onClick={() => onChange([...rows, { name: '', rank: null }])}
      >
        추가
      </button>
    </>
  )
}

function TransmuteEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: EquipmentTransmutation[]
  onChange: (rows: EquipmentTransmutation[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>정책</th>
              <th>스킬</th>
              <th>재료</th>
              <th>생산품</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`transmute-${idx}`}>
                <td>
                  <input
                    value={row.policy}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx ? { ...r, policy: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.skills}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx ? { ...r, skills: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.materials}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx ? { ...r, materials: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.product}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx ? { ...r, product: e.target.value } : r,
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
          onChange([
            ...rows,
            { policy: '', skills: '', materials: '', product: '' },
          ])
        }
      >
        추가
      </button>
    </>
  )
}

function AcquireViewer({
  tab,
  equipment,
}: {
  tab: AcquireTabKey
  equipment: EquipmentDetail
}) {
  if (tab === 'purchases') {
    const rows = equipment.purchases || []
    if (!rows.length) {
      return <p className="form-note">등록된 구입 정보가 없습니다.</p>
    }
    return (
      <SimpleTable
        headers={['판매 NPC', '지역', '장소', '가격']}
        rows={rows.map((r) => [r.npc, r.region, r.place, r.price || '-'])}
      />
    )
  }
  if (tab === 'quests') {
    const rows = equipment.quests || []
    if (!rows.length) {
      return <p className="form-note">등록된 퀘스트 정보가 없습니다.</p>
    }
    return (
      <SimpleTable
        headers={['퀘스트', '목적지']}
        rows={rows.map((r) => [r.quest, r.destination || '-'])}
      />
    )
  }
  if (tab === 'treasureMaps') {
    const rows = equipment.treasureMaps || []
    if (!rows.length) {
      return <p className="form-note">등록된 보물지도 정보가 없습니다.</p>
    }
    return (
      <SimpleTable
        headers={['이름', '상세']}
        rows={rows.map((r) => [r.name, r.detail || '-'])}
      />
    )
  }
  const rows = equipment.memorialAlbums || []
  if (!rows.length) {
    return <p className="form-note">등록된 메모리얼 앨범 정보가 없습니다.</p>
  }
  return (
    <SimpleTable
      headers={['이름', '상세']}
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
  draft: EquipmentDetail
  onChange: (draft: EquipmentDetail) => void
  disabled?: boolean
}) {
  if (tab === 'purchases') {
    return (
      <PurchaseEditor
        rows={draft.purchases}
        disabled={disabled}
        onChange={(purchases) => onChange({ ...draft, purchases })}
      />
    )
  }
  if (tab === 'quests') {
    return (
      <QuestAcquireEditor
        rows={draft.quests}
        disabled={disabled}
        onChange={(quests) => onChange({ ...draft, quests })}
      />
    )
  }
  if (tab === 'treasureMaps') {
    return (
      <InfoRowEditor
        rows={draft.treasureMaps}
        disabled={disabled}
        onChange={(treasureMaps) => onChange({ ...draft, treasureMaps })}
      />
    )
  }
  return (
    <InfoRowEditor
      rows={draft.memorialAlbums}
      disabled={disabled}
      onChange={(memorialAlbums) => onChange({ ...draft, memorialAlbums })}
    />
  )
}

function PurchaseEditor({
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
              <th>가격</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`eq-purchase-${idx}`}>
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
                <td>
                  <input
                    value={row.price || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx
                            ? { ...r, price: e.target.value || null }
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
        onClick={() =>
          onChange([...rows, { npc: '', region: '', place: '', price: null }])
        }
      >
        추가
      </button>
    </>
  )
}

function QuestAcquireEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: EquipmentQuestAcquire[]
  onChange: (rows: EquipmentQuestAcquire[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>퀘스트</th>
              <th>목적지</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`eq-quest-${idx}`}>
                <td>
                  <input
                    value={row.quest}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx ? { ...r, quest: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.destination}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx
                            ? { ...r, destination: e.target.value }
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
        onClick={() => onChange([...rows, { quest: '', destination: '' }])}
      >
        추가
      </button>
    </>
  )
}

function InfoRowEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: EquipmentInfoRow[]
  onChange: (rows: EquipmentInfoRow[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>상세</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`eq-info-${idx}`}>
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

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: Array<Array<string | null | undefined>>
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
                <td key={`${idx}-${cIdx}`}>{cell?.trim() ? cell : '-'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
