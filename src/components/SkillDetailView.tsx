import { useEffect, useState } from 'react'
import { updateSkill } from '../lib/api'
import type { SkillDetail, SkillOfficer } from '../types'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'

type SkillDetailViewProps = {
  skill: SkillDetail
  edit?: {
    token: string
    onSaved: (skill: SkillDetail) => void
    onToast?: (text: string) => void
  }
}

type EditSection =
  | 'basic'
  | 'jobs'
  | 'conditions'
  | 'learn'
  | 'useCities'
  | 'officers'
  | 'effects'

const SKILL_CATEGORIES = ['언어', '모험', '교역', '전투', '기타']
const RANGE_SCOPES = ['함대', '자신', '적', '아군', '기타']

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

function formatCost(n: number | null, unit = '두캇') {
  if (n == null) return null
  return `${n.toLocaleString('ko-KR')}${unit}`
}

function formatAutoEffect(value: string | null) {
  if (value == null) return null
  if (value === 'Y' || value === '1') return '예'
  return value
}

function cloneSkill(skill: SkillDetail): SkillDetail {
  return {
    ...skill,
    preferredJobs: [...(skill.preferredJobs || [])],
    acquireConditions: (skill.acquireConditions || []).map((c) => ({ ...c })),
    learnPlaces: (skill.learnPlaces || []).map((p) => ({ ...p })),
    useCities: (skill.useCities || []).map((c) => ({ ...c })),
    officers: (skill.officers || []).map((o) => ({ ...o })),
    effectItems: (skill.effectItems || []).map((e) => ({ ...e })),
  }
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

export function SkillDetailView({ skill, edit }: SkillDetailViewProps) {
  const canEdit = Boolean(edit)
  const [editing, setEditing] = useState<EditSection | null>(null)
  const [draft, setDraft] = useState(() => cloneSkill(skill))
  const [jobsDraft, setJobsDraft] = useState(
    (skill.preferredJobs || []).join(', '),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(cloneSkill(skill))
    setJobsDraft((skill.preferredJobs || []).join(', '))
    setEditing(null)
    setError('')
  }, [skill])

  const learnPlaces = skill.learnPlaces || []
  const useCities = skill.useCities || []
  const preferredJobs = skill.preferredJobs || []
  const acquireConditions = skill.acquireConditions || []
  const officers = skill.officers || []
  const effectItems = skill.effectItems || []
  const autoEffectOn = draft.autoEffect != null

  function startEdit(section: EditSection) {
    setDraft(cloneSkill(skill))
    setJobsDraft((skill.preferredJobs || []).join(', '))
    setError('')
    setEditing(section)
  }

  function cancelEdit() {
    setDraft(cloneSkill(skill))
    setJobsDraft((skill.preferredJobs || []).join(', '))
    setError('')
    setEditing(null)
  }

  async function saveSection() {
    if (!edit || !editing) return
    setSaving(true)
    setError('')
    try {
      let patch: Partial<SkillDetail> = {}
      if (editing === 'basic') {
        if (!draft.name.trim()) throw new Error('스킬 이름이 필요합니다.')
        patch = {
          name: draft.name,
          altName: draft.altName,
          description: draft.description,
          category: draft.category,
          officerDuty: draft.officerDuty,
          actionPower: draft.actionPower,
          rangeScope: draft.rangeScope,
          learnCost: draft.learnCost,
          equipCost: draft.equipCost,
          refineEffect: draft.refineEffect,
          autoEffect: draft.autoEffect,
          prerequisite: draft.prerequisite,
        }
      } else if (editing === 'jobs') {
        patch = {
          preferredJobs: jobsDraft
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean),
        }
      } else if (editing === 'conditions') {
        patch = {
          acquireConditions: draft.acquireConditions.filter(
            (c) => c.kind.trim() || c.content.trim(),
          ),
        }
      } else if (editing === 'learn') {
        patch = {
          learnPlaces: draft.learnPlaces.filter(
            (p) => p.region.trim() || p.city.trim() || p.npc,
          ),
        }
      } else if (editing === 'useCities') {
        patch = {
          useCities: draft.useCities.filter(
            (c) => c.region.trim() || c.city.trim(),
          ),
        }
      } else if (editing === 'officers') {
        patch = {
          officers: draft.officers.filter(
            (o) => o.name.trim() || o.job || o.adventure || o.trade || o.battle,
          ),
        }
      } else if (editing === 'effects') {
        patch = {
          effectItems: draft.effectItems.filter(
            (e) => e.kind.trim() || e.item.trim(),
          ),
        }
      }
      const res = await updateSkill(edit.token, skill.id, patch)
      edit.onSaved(res.skill)
      edit.onToast?.(`저장 완료 · ${res.skill.name}`)
      setEditing(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '스킬 저장에 실패했습니다.'
      setError(message)
      edit.onToast?.(message)
    } finally {
      setSaving(false)
    }
  }

  const showJobs = canEdit || preferredJobs.length > 0
  const showConditions = canEdit || acquireConditions.length > 0
  const showLearn = canEdit || learnPlaces.length > 0
  const showUse = canEdit || useCities.length > 0
  const showOfficers = canEdit || officers.length > 0
  const showEffects = canEdit || effectItems.length > 0

  const categoryOptions =
    skill.category && !SKILL_CATEGORIES.includes(skill.category)
      ? [skill.category, ...SKILL_CATEGORIES]
      : SKILL_CATEGORIES
  const rangeOptions =
    skill.rangeScope && !RANGE_SCOPES.includes(skill.rangeScope)
      ? [skill.rangeScope, ...RANGE_SCOPES]
      : RANGE_SCOPES

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">스킬</span>
          {skill.category ? (
            <span className="quest-badge">{skill.category}</span>
          ) : null}
        </div>
        <h2>
          {skill.name}
          {skill.altName ? (
            <span className="port-alt-name"> ({skill.altName})</span>
          ) : null}
        </h2>
        {skill.description ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{skill.description}</p>
        ) : null}
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
            <div className="quest-kv-grid sea-area-edit-grid">
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
                <span>스킬</span>
                <input
                  value={draft.name}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, name: e.target.value }))
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
                <span>부관담당</span>
                <input
                  value={draft.officerDuty || ''}
                  disabled={saving}
                  placeholder="- 없음 -"
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      officerDuty: e.target.value || null,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>행동력</span>
                <div className="port-clearable">
                  <input
                    value={draft.actionPower || ''}
                    disabled={saving}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        actionPower: e.target.value || null,
                      }))
                    }
                  />
                  <label className="port-facility-check">
                    <input
                      type="checkbox"
                      checked={autoEffectOn}
                      disabled={saving}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          autoEffect: e.target.checked
                            ? prev.autoEffect && prev.autoEffect !== 'Y'
                              ? prev.autoEffect
                              : 'Y'
                            : null,
                        }))
                      }
                    />
                    자동효과
                  </label>
                </div>
              </label>
              <label className="field">
                <span>범위</span>
                <select
                  value={draft.rangeScope || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      rangeScope: e.target.value || null,
                    }))
                  }
                >
                  <option value="">선택</option>
                  {rangeOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>습득 비용</span>
                <div className="port-clearable">
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(draft.learnCost)}
                    disabled={saving}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        learnCost: parseOptionalInt(e.target.value),
                      }))
                    }
                  />
                  <span className="port-unit">두캇</span>
                </div>
              </label>
              <label className="field">
                <span>장착 비용</span>
                <div className="port-clearable">
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(draft.equipCost)}
                    disabled={saving}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        equipCost: parseOptionalInt(e.target.value),
                      }))
                    }
                  />
                  <span className="port-unit">학점</span>
                </div>
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>연성 효과</span>
                <input
                  value={draft.refineEffect || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      refineEffect: e.target.value || null,
                    }))
                  }
                />
              </label>
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>설명</span>
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
            </div>
            <DetailSectionActions
              busy={saving}
              onCancel={cancelEdit}
              onSave={() => void saveSection()}
            />
          </>
        ) : (
          <div className="quest-kv-grid">
            <Row label="분류" value={skill.category || '언어'} />
            <Row
              label="행동력"
              value={skill.actionPower}
              hideEmpty={!canEdit}
            />
            <Row
              label="자동효과"
              value={formatAutoEffect(skill.autoEffect)}
              hideEmpty={!canEdit}
            />
            <Row
              label="범위"
              value={skill.rangeScope}
              hideEmpty={!canEdit}
            />
            <Row
              label="습득 비용"
              value={formatCost(skill.learnCost)}
              hideEmpty={!canEdit}
            />
            <Row
              label="장착 비용"
              value={formatCost(skill.equipCost, '학점')}
              hideEmpty={!canEdit}
            />
            <Row
              label="부관담당"
              value={skill.officerDuty}
              hideEmpty={!canEdit}
            />
            <Row
              label="연성 효과"
              value={skill.refineEffect}
              hideEmpty={!canEdit}
            />
            {skill.prerequisite && acquireConditions.length === 0 ? (
              <Row label="선행 스킬" value={skill.prerequisite} />
            ) : null}
          </div>
        )}
      </section>

      {showJobs && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="우대 직업"
            canEdit={canEdit}
            editing={editing === 'jobs'}
            onEdit={() => startEdit('jobs')}
          />
          {editing === 'jobs' ? (
            <>
              <label className="field">
                <span>쉼표로 구분</span>
                <input
                  value={jobsDraft}
                  disabled={saving}
                  onChange={(e) => setJobsDraft(e.target.value)}
                />
              </label>
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (
            <p>
              {preferredJobs.length
                ? preferredJobs.join(', ')
                : '등록된 우대 직업이 없습니다.'}
            </p>
          )}
        </section>
      )}

      {showConditions && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="습득 조건"
            canEdit={canEdit}
            editing={editing === 'conditions'}
            onEdit={() => startEdit('conditions')}
          />
          {editing === 'conditions' ? (
            <>
              <EditKvTable
                rows={draft.acquireConditions}
                disabled={saving}
                colA="종류"
                colB="내용"
                onChange={(acquireConditions) =>
                  setDraft((prev) => ({ ...prev, acquireConditions }))
                }
                emptyRow={() => ({ kind: '', content: '' })}
                getA={(r) => r.kind}
                getB={(r) => r.content}
                setA={(r, v) => ({ ...r, kind: v })}
                setB={(r, v) => ({ ...r, content: v })}
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : acquireConditions.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>종류</th>
                    <th>내용</th>
                  </tr>
                </thead>
                <tbody>
                  {acquireConditions.map((row, index) => (
                    <tr key={`${row.kind}-${index}`}>
                      <td>{row.kind || '-'}</td>
                      <td>{row.content || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 습득 조건이 없습니다.</p>
          )}
        </section>
      )}

      {showLearn && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="스킬 습득"
            canEdit={canEdit}
            editing={editing === 'learn'}
            onEdit={() => startEdit('learn')}
          />
          {editing === 'learn' ? (
            <>
              <EditLearnPlaces
                places={draft.learnPlaces}
                disabled={saving}
                onChange={(learnPlaces) =>
                  setDraft((prev) => ({ ...prev, learnPlaces }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : learnPlaces.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>지역</th>
                    <th>도시</th>
                    <th>도시 인물</th>
                  </tr>
                </thead>
                <tbody>
                  {learnPlaces.map((place, index) => (
                    <tr key={`${place.city}-${index}`}>
                      <td>{place.region || '-'}</td>
                      <td>{place.city || '-'}</td>
                      <td>{place.npc || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 습득 장소가 없습니다.</p>
          )}
        </section>
      )}

      {showUse && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="사용 도시"
            canEdit={canEdit}
            editing={editing === 'useCities'}
            onEdit={() => startEdit('useCities')}
          />
          {editing === 'useCities' ? (
            <>
              <EditKvTable
                rows={draft.useCities}
                disabled={saving}
                colA="지역"
                colB="도시"
                onChange={(useCitiesNext) =>
                  setDraft((prev) => ({ ...prev, useCities: useCitiesNext }))
                }
                emptyRow={() => ({ region: '', city: '' })}
                getA={(r) => r.region}
                getB={(r) => r.city}
                setA={(r, v) => ({ ...r, region: v })}
                setB={(r, v) => ({ ...r, city: v })}
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : useCities.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>지역</th>
                    <th>도시</th>
                  </tr>
                </thead>
                <tbody>
                  {useCities.map((city, index) => (
                    <tr key={`${city.city}-${index}`}>
                      <td>{city.region || '-'}</td>
                      <td>{city.city || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 사용 도시가 없습니다.</p>
          )}
        </section>
      )}

      {showOfficers && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="부관"
            canEdit={canEdit}
            editing={editing === 'officers'}
            onEdit={() => startEdit('officers')}
          />
          {editing === 'officers' ? (
            <>
              <EditOfficers
                officers={draft.officers}
                disabled={saving}
                onChange={(next) =>
                  setDraft((prev) => ({ ...prev, officers: next }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : officers.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>부관</th>
                    <th>직업</th>
                    <th>모험</th>
                    <th>교역</th>
                    <th>전투</th>
                    <th>특성</th>
                  </tr>
                </thead>
                <tbody>
                  {officers.map((row, index) => (
                    <tr key={`${row.name}-${index}`}>
                      <td>{row.name}</td>
                      <td>{row.job || '-'}</td>
                      <td>{row.adventure || '-'}</td>
                      <td>{row.trade || '-'}</td>
                      <td>{row.battle || '-'}</td>
                      <td>{row.trait || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 부관이 없습니다.</p>
          )}
        </section>
      )}

      {showEffects && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="효과 아이템"
            canEdit={canEdit}
            editing={editing === 'effects'}
            onEdit={() => startEdit('effects')}
          />
          {editing === 'effects' ? (
            <>
              <EditKvTable
                rows={draft.effectItems}
                disabled={saving}
                colA="종류"
                colB="아이템"
                onChange={(next) =>
                  setDraft((prev) => ({ ...prev, effectItems: next }))
                }
                emptyRow={() => ({ kind: '', item: '' })}
                getA={(r) => r.kind}
                getB={(r) => r.item}
                setA={(r, v) => ({ ...r, kind: v })}
                setB={(r, v) => ({ ...r, item: v })}
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : effectItems.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>종류</th>
                    <th>아이템</th>
                  </tr>
                </thead>
                <tbody>
                  {effectItems.map((row, index) => (
                    <tr key={`${row.item}-${index}`}>
                      <td>{row.kind || '-'}</td>
                      <td>{row.item || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 효과 아이템이 없습니다.</p>
          )}
        </section>
      )}
    </div>
  )
}

function EditOfficers({
  officers,
  onChange,
  disabled,
}: {
  officers: SkillOfficer[]
  onChange: (officers: SkillOfficer[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>부관</th>
              <th>직업</th>
              <th>모험</th>
              <th>교역</th>
              <th>전투</th>
              <th>특성</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {officers.map((row, idx) => (
              <tr key={`off-${idx}`}>
                {(
                  [
                    'name',
                    'job',
                    'adventure',
                    'trade',
                    'battle',
                    'trait',
                  ] as const
                ).map((key) => (
                  <td key={key}>
                    <input
                      value={row[key] || ''}
                      disabled={disabled}
                      onChange={(e) =>
                        onChange(
                          officers.map((o, i) =>
                            i === idx
                              ? {
                                  ...o,
                                  [key]:
                                    key === 'name'
                                      ? e.target.value
                                      : e.target.value || null,
                                }
                              : o,
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
                    onClick={() =>
                      onChange(officers.filter((_, i) => i !== idx))
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
      <button
        type="button"
        className="admin-btn"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...officers,
            {
              name: '',
              job: null,
              adventure: null,
              trade: null,
              battle: null,
              trait: null,
            },
          ])
        }
      >
        추가
      </button>
    </>
  )
}

function EditKvTable<T>({
  rows,
  onChange,
  disabled,
  colA,
  colB,
  emptyRow,
  getA,
  getB,
  setA,
  setB,
}: {
  rows: T[]
  onChange: (rows: T[]) => void
  disabled?: boolean
  colA: string
  colB: string
  emptyRow: () => T
  getA: (row: T) => string
  getB: (row: T) => string
  setA: (row: T, value: string) => T
  setB: (row: T, value: string) => T
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{colA}</th>
              <th>{colB}</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    value={getA(row)}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx ? setA(r, e.target.value) : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={getB(row)}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx ? setB(r, e.target.value) : r,
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
        onClick={() => onChange([...rows, emptyRow()])}
      >
        추가
      </button>
    </>
  )
}

function EditLearnPlaces({
  places,
  onChange,
  disabled,
}: {
  places: SkillDetail['learnPlaces']
  onChange: (places: SkillDetail['learnPlaces']) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>지역</th>
              <th>도시</th>
              <th>도시 인물</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {places.map((place, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    value={place.region}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        places.map((p, i) =>
                          i === idx ? { ...p, region: e.target.value } : p,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={place.city}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        places.map((p, i) =>
                          i === idx ? { ...p, city: e.target.value } : p,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={place.npc || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        places.map((p, i) =>
                          i === idx
                            ? { ...p, npc: e.target.value || null }
                            : p,
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
      <button
        type="button"
        className="admin-btn"
        disabled={disabled}
        onClick={() =>
          onChange([...places, { region: '', city: '', npc: null }])
        }
      >
        추가
      </button>
    </>
  )
}
