import { useEffect, useState } from 'react'
import { updateRegion } from '../lib/api'
import type { RegionDetail, RegionSeaGroup } from '../types'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'

type RegionDetailViewProps = {
  region: RegionDetail
  edit?: {
    token: string
    onSaved: (region: RegionDetail) => void
    onToast?: (text: string) => void
  }
}

type EditSection = 'seaGroups'

function cloneRegion(region: RegionDetail): RegionDetail {
  return {
    ...region,
    seaGroups: (region.seaGroups || []).map((g) => ({
      group: g.group,
      seaAreas: [...g.seaAreas],
    })),
  }
}

export function RegionDetailView({ region, edit }: RegionDetailViewProps) {
  const canEdit = Boolean(edit)
  const [editing, setEditing] = useState<EditSection | null>(null)
  const [draft, setDraft] = useState(() => cloneRegion(region))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(cloneRegion(region))
    setEditing(null)
    setError('')
  }, [region])

  function startEdit(section: EditSection) {
    setDraft(cloneRegion(region))
    setError('')
    setEditing(section)
  }

  function cancelEdit() {
    setDraft(cloneRegion(region))
    setError('')
    setEditing(null)
  }

  async function saveSection() {
    if (!edit || !editing) return
    setSaving(true)
    setError('')
    try {
      const patch: Partial<RegionDetail> = {
        seaGroups: draft.seaGroups.filter(
          (g) => g.group.trim() || g.seaAreas.length > 0,
        ),
      }
      const res = await updateRegion(edit.token, region.id, patch)
      edit.onSaved(res.region)
      edit.onToast?.(`저장 완료 · ${res.region.name}`)
      setEditing(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '지역 저장에 실패했습니다.'
      setError(message)
      edit.onToast?.(message)
    } finally {
      setSaving(false)
    }
  }

  const showSea = canEdit || (region.seaGroups || []).length > 0

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">지역</span>
        </div>
        <h2>{region.name}</h2>
      </header>

      {error ? (
        <p className="form-note error" role="alert">
          {error}
        </p>
      ) : null}

      {showSea && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="해역"
            canEdit={canEdit}
            editing={editing === 'seaGroups'}
            onEdit={() => startEdit('seaGroups')}
          />
          {editing === 'seaGroups' ? (
            <>
              <EditSeaGroups
                groups={draft.seaGroups}
                disabled={saving}
                onChange={(seaGroups) =>
                  setDraft((prev) => ({ ...prev, seaGroups }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (region.seaGroups || []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>해역 그룹</th>
                    <th>해역</th>
                  </tr>
                </thead>
                <tbody>
                  {(region.seaGroups || []).map((row, idx) => (
                    <tr key={`${row.group}-${idx}`}>
                      <td>{row.group || '-'}</td>
                      <td>{row.seaAreas.join(', ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 해역이 없습니다.</p>
          )}
        </section>
      )}
    </div>
  )
}

function EditSeaGroups({
  groups,
  onChange,
  disabled,
}: {
  groups: RegionSeaGroup[]
  onChange: (groups: RegionSeaGroup[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>해역 그룹</th>
              <th>해역 (쉼표 구분)</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((row, idx) => (
              <tr key={`sg-${idx}`}>
                <td>
                  <input
                    value={row.group}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        groups.map((g, i) =>
                          i === idx ? { ...g, group: e.target.value } : g,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.seaAreas.join(', ')}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        groups.map((g, i) =>
                          i === idx
                            ? {
                                ...g,
                                seaAreas: e.target.value
                                  .split(/[,\uFF0C]/)
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              }
                            : g,
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
                    onClick={() => onChange(groups.filter((_, i) => i !== idx))}
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
        onClick={() => onChange([...groups, { group: '', seaAreas: [] }])}
      >
        추가
      </button>
    </>
  )
}
