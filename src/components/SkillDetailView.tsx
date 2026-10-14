import { useEffect, useState } from 'react'
import { updateSkill } from '../lib/api'
import type { SkillDetail } from '../types'
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
  | 'description'
  | 'jobs'
  | 'conditions'
  | 'learn'
  | 'useCities'

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value?.trim() ? value : '-'}</strong>
    </div>
  )
}

function formatCost(n: number | null) {
  if (n == null) return null
  return `${n.toLocaleString('ko-KR')}두캇`
}

function cloneSkill(skill: SkillDetail): SkillDetail {
  return {
    ...skill,
    preferredJobs: [...(skill.preferredJobs || [])],
    acquireConditions: (skill.acquireConditions || []).map((c) => ({ ...c })),
    learnPlaces: (skill.learnPlaces || []).map((p) => ({ ...p })),
    useCities: (skill.useCities || []).map((c) => ({ ...c })),
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
          category: draft.category,
          officerDuty: draft.officerDuty,
          actionPower: draft.actionPower,
          rangeScope: draft.rangeScope,
          learnCost: draft.learnCost,
          refineEffect: draft.refineEffect,
          autoEffect: draft.autoEffect,
          prerequisite: draft.prerequisite,
        }
      } else if (editing === 'description') {
        patch = { description: draft.description }
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
  const showDescription = canEdit || Boolean(skill.description)

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">스킬</span>
          {skill.category ? (
            <span className="quest-badge">{skill.category}</span>
          ) : null}
        </div>
        <h2>{skill.name}</h2>
        {!canEdit && skill.description ? (
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
                <span>이름</span>
                <input
                  value={draft.name}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </label>
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
                <span>부관담당</span>
                <input
                  value={draft.officerDuty || ''}
                  disabled={saving}
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
              </label>
              <label className="field">
                <span>범위</span>
                <input
                  value={draft.rangeScope || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      rangeScope: e.target.value || null,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>습득 비용</span>
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
              </label>
              <label className="field">
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
              <label className="field">
                <span>자동효과</span>
                <input
                  value={draft.autoEffect || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      autoEffect: e.target.value || null,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>선행 스킬</span>
                <input
                  value={draft.prerequisite || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      prerequisite: e.target.value || null,
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
            <Row label="부관담당" value={skill.officerDuty} />
            <Row label="행동력" value={skill.actionPower} />
            <Row label="범위" value={skill.rangeScope} />
            <Row label="습득 비용" value={formatCost(skill.learnCost)} />
            <Row label="연성 효과" value={skill.refineEffect} />
            <Row label="자동효과" value={skill.autoEffect} />
            {skill.prerequisite && acquireConditions.length === 0 ? (
              <Row label="선행 스킬" value={skill.prerequisite} />
            ) : null}
          </div>
        )}
      </section>

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
                  rows={5}
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
            <p style={{ whiteSpace: 'pre-wrap' }}>
              {skill.description || '설명이 없습니다.'}
            </p>
          )}
        </section>
      )}

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
    </div>
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
