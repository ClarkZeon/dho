import { useEffect, useState } from 'react'
import { fetchSeaAreaByKey, updateRegion } from '../lib/api'
import type { RegionDetail, RegionSeaGroup, SeaAreaDetail } from '../types'
import { ConfirmLayer } from './ConfirmLayer'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'
import { DetailModal } from './DetailModal'
import { LoadingOverlay } from './LoadingOverlay'
import { SeaAreaDetailView } from './SeaAreaDetailView'
import { SeaAreaEdgeLabel } from './SeaAreaEdgeLabel'

type RegionDetailViewProps = {
  region: RegionDetail
  token?: string
  isAdmin?: boolean
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

export function RegionDetailView({
  region,
  token,
  isAdmin = false,
  edit,
}: RegionDetailViewProps) {
  const authToken = edit?.token || token || ''
  const canEdit = Boolean(edit)
  const [editing, setEditing] = useState<EditSection | null>(null)
  const [draft, setDraft] = useState(() => cloneRegion(region))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [seaLoading, setSeaLoading] = useState(false)
  const [seaDetail, setSeaDetail] = useState<SeaAreaDetail | null>(null)
  const [seaMissName, setSeaMissName] = useState('')
  const [seaError, setSeaError] = useState('')

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

  async function openMatchedSeaArea(name: string) {
    if (!authToken) return
    const key = name.trim()
    if (!key) return
    setSeaLoading(true)
    setSeaMissName('')
    setSeaError('')
    try {
      const res = await fetchSeaAreaByKey(authToken, key)
      setSeaDetail(res.seaArea)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (/찾을 수 없|없습니다/i.test(message)) {
        setSeaMissName(key)
      } else {
        setSeaError(message || '해역 상세를 불러오지 못했습니다.')
      }
    } finally {
      setSeaLoading(false)
    }
  }

  function openSeaAreasAddTab(seaName: string) {
    const params = new URLSearchParams()
    params.set('q', seaName)
    params.set('add', '1')
    const url = `${window.location.pathname}${window.location.search}#/sea-areas?${params.toString()}`
    window.open(url, '_blank', 'noopener,noreferrer')
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
                      <td>
                        {row.seaAreas.length > 0 ? (
                          <ul className="quest-skill-chips">
                            {row.seaAreas.map((name) => (
                              <li key={name} className="is-sea-chip">
                                {authToken ? (
                                  <button
                                    type="button"
                                    className="quest-skill-chip-btn"
                                    disabled={seaLoading}
                                    onClick={() =>
                                      void openMatchedSeaArea(name)
                                    }
                                  >
                                    <span className="chip-edge-inner">
                                      <SeaAreaEdgeLabel />
                                      <span>{name}</span>
                                    </span>
                                  </button>
                                ) : (
                                  <span className="chip-edge-inner">
                                    <SeaAreaEdgeLabel />
                                    <span>{name}</span>
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          '-'
                        )}
                      </td>
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

      {seaLoading ? <LoadingOverlay label="해역 불러오는 중…" /> : null}

      {seaError ? (
        <ConfirmLayer
          message={seaError}
          onCancel={() => setSeaError('')}
          stack={1}
        />
      ) : null}

      {seaMissName ? (
        <ConfirmLayer
          message={`「${seaMissName}」 해역이(가) 없습니다.`}
          onCancel={() => setSeaMissName('')}
          confirmLabel={isAdmin ? '등록하러 이동하기' : undefined}
          onConfirm={
            isAdmin
              ? () => {
                  openSeaAreasAddTab(seaMissName)
                  setSeaMissName('')
                }
              : undefined
          }
          stack={1}
        />
      ) : null}

      {seaDetail ? (
        <DetailModal
          title="해역 상세"
          label={`${seaDetail.name} 상세`}
          onClose={() => {
            setSeaDetail(null)
            setSeaError('')
          }}
          stack={1}
          headerActions={
            isAdmin ? (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  const params = new URLSearchParams()
                  params.set('q', seaDetail.name)
                  params.set('open', seaDetail.slug || seaDetail.name)
                  const url = `${window.location.pathname}${window.location.search}#/sea-areas?${params.toString()}`
                  window.open(url, '_blank', 'noopener,noreferrer')
                }}
              >
                해역 메뉴로 이동
              </button>
            ) : undefined
          }
        >
          <SeaAreaDetailView
            seaArea={seaDetail}
            edit={
              isAdmin && authToken
                ? {
                    token: authToken,
                    onSaved: (seaArea) => setSeaDetail(seaArea),
                  }
                : undefined
            }
          />
        </DetailModal>
      ) : null}
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
