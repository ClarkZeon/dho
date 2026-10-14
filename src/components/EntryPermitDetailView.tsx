import { useEffect, useMemo, useState } from 'react'
import { updateEntryPermit } from '../lib/api'
import type {
  EntryPermitCityQuests,
  EntryPermitDetail,
  EntryPermitFame,
  EntryPermitQuest,
} from '../types'
import { DiscoveryRankMark } from './DiscoveryRankMark'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'

type EntryPermitDetailViewProps = {
  permit: EntryPermitDetail
  edit?: {
    token: string
    onSaved: (permit: EntryPermitDetail) => void
    onToast?: (text: string) => void
  }
}

type EditSection = 'basic' | 'quests' | 'fame'

function clonePermit(permit: EntryPermitDetail): EntryPermitDetail {
  return {
    ...permit,
    fame: (permit.fame || []).map((f) => ({ ...f })),
    cityQuests: (permit.cityQuests || []).map((c) => ({
      city: c.city,
      quests: c.quests.map((q) => ({ ...q })),
    })),
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

export function EntryPermitDetailView({
  permit,
  edit,
}: EntryPermitDetailViewProps) {
  const canEdit = Boolean(edit)
  const [editing, setEditing] = useState<EditSection | null>(null)
  const [draft, setDraft] = useState(() => clonePermit(permit))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [cityTab, setCityTab] = useState(
    () => permit.cityQuests?.[0]?.city || '',
  )

  useEffect(() => {
    setDraft(clonePermit(permit))
    setEditing(null)
    setError('')
    setCityTab(permit.cityQuests?.[0]?.city || '')
  }, [permit])

  const cityTabs = useMemo(
    () => (permit.cityQuests || []).map((c) => c.city).filter(Boolean),
    [permit.cityQuests],
  )

  useEffect(() => {
    if (cityTabs.length && !cityTabs.includes(cityTab)) {
      setCityTab(cityTabs[0])
    }
  }, [cityTabs, cityTab])

  const activeQuests =
    (permit.cityQuests || []).find((c) => c.city === cityTab)?.quests ||
    permit.cityQuests?.[0]?.quests ||
    []

  function startEdit(section: EditSection) {
    setDraft(clonePermit(permit))
    setError('')
    setEditing(section)
  }

  function cancelEdit() {
    setDraft(clonePermit(permit))
    setError('')
    setEditing(null)
  }

  async function saveSection() {
    if (!edit || !editing) return
    setSaving(true)
    setError('')
    try {
      let patch: Partial<EntryPermitDetail> = {}
      if (editing === 'basic') {
        if (!draft.name.trim()) throw new Error('입항허가 이름이 필요합니다.')
        patch = {
          name: draft.name,
          altName: draft.altName,
          description: draft.description,
          requirement: draft.requirement,
        }
      } else if (editing === 'quests') {
        patch = {
          cityQuests: draft.cityQuests
            .map((c) => ({
              city: c.city,
              quests: c.quests.filter((q) => q.name.trim() || q.kind.trim()),
            }))
            .filter((c) => c.city.trim() || c.quests.length > 0),
        }
      } else if (editing === 'fame') {
        patch = {
          fame: draft.fame.filter(
            (f) => f.nationality || f.general || f.countryEvent,
          ),
        }
      }
      const res = await updateEntryPermit(edit.token, permit.id, patch)
      edit.onSaved(res.entryPermit)
      edit.onToast?.(`저장 완료 · ${res.entryPermit.name}`)
      setEditing(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '입항허가 저장에 실패했습니다.'
      setError(message)
      edit.onToast?.(message)
    } finally {
      setSaving(false)
    }
  }

  const showQuests = canEdit || (permit.cityQuests || []).length > 0
  const showFame = canEdit || (permit.fame || []).length > 0
  const showRequirement = canEdit || Boolean(permit.requirement)

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">입항허가</span>
        </div>
        <h2>
          {permit.name}
          {permit.altName ? (
            <span className="port-alt-name"> ({permit.altName})</span>
          ) : null}
        </h2>
        {permit.description ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{permit.description}</p>
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
                <span>입항허가</span>
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
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>필요</span>
                <textarea
                  rows={3}
                  value={draft.requirement || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      requirement: e.target.value || null,
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
            <div>
              <span>입항허가</span>
              <strong>{permit.name}</strong>
            </div>
            {permit.altName ? (
              <div>
                <span>추가 이름</span>
                <strong>{permit.altName}</strong>
              </div>
            ) : null}
            {showRequirement ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <span>필요</span>
                <strong style={{ whiteSpace: 'pre-wrap' }}>
                  {permit.requirement || '-'}
                </strong>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {showQuests && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="퀘스트 (택일)"
            canEdit={canEdit}
            editing={editing === 'quests'}
            onEdit={() => startEdit('quests')}
          />
          {editing === 'quests' ? (
            <>
              <EditCityQuests
                cityQuests={draft.cityQuests}
                disabled={saving}
                onChange={(cityQuests) =>
                  setDraft((prev) => ({ ...prev, cityQuests }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (permit.cityQuests || []).length > 0 ? (
            <>
              {cityTabs.length > 0 ? (
                <div className="port-subtabs" role="tablist">
                  {cityTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      className={tab === cityTab ? 'active' : ''}
                      aria-selected={tab === cityTab}
                      onClick={() => setCityTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              ) : null}
              {activeQuests.length > 0 ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>종류</th>
                        <th>난이도</th>
                        <th>퀘스트</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeQuests.map((row, idx) => (
                        <tr key={`${row.name}-${idx}`}>
                          <td>{row.kind || '-'}</td>
                          <td>
                            {row.difficulty != null ? (
                              <DiscoveryRankMark rank={row.difficulty} />
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>{row.name || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="form-note">이 도시에 등록된 퀘스트가 없습니다.</p>
              )}
            </>
          ) : (
            <p className="form-note">등록된 퀘스트가 없습니다.</p>
          )}
        </section>
      )}

      {showFame && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="명성"
            canEdit={canEdit}
            editing={editing === 'fame'}
            onEdit={() => startEdit('fame')}
          />
          {editing === 'fame' ? (
            <>
              <EditFame
                fame={draft.fame}
                disabled={saving}
                onChange={(fame) => setDraft((prev) => ({ ...prev, fame }))}
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (permit.fame || []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>국적</th>
                    <th>일반</th>
                    <th>국가 이벤트</th>
                  </tr>
                </thead>
                <tbody>
                  {(permit.fame || []).map((row, idx) => (
                    <tr key={`fame-${idx}`}>
                      <td>{row.nationality || '-'}</td>
                      <td>{row.general || '-'}</td>
                      <td>{row.countryEvent || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 명성이 없습니다.</p>
          )}
        </section>
      )}
    </div>
  )
}

function EditFame({
  fame,
  onChange,
  disabled,
}: {
  fame: EntryPermitFame[]
  onChange: (fame: EntryPermitFame[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>국적</th>
              <th>일반</th>
              <th>국가 이벤트</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {fame.map((row, idx) => (
              <tr key={`fame-edit-${idx}`}>
                <td>
                  <input
                    value={row.nationality || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        fame.map((f, i) =>
                          i === idx
                            ? { ...f, nationality: e.target.value || null }
                            : f,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.general || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        fame.map((f, i) =>
                          i === idx
                            ? { ...f, general: e.target.value || null }
                            : f,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.countryEvent || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        fame.map((f, i) =>
                          i === idx
                            ? { ...f, countryEvent: e.target.value || null }
                            : f,
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
                    onClick={() => onChange(fame.filter((_, i) => i !== idx))}
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
            ...fame,
            { nationality: null, general: null, countryEvent: null },
          ])
        }
      >
        추가
      </button>
    </>
  )
}

function EditCityQuests({
  cityQuests,
  onChange,
  disabled,
}: {
  cityQuests: EntryPermitCityQuests[]
  onChange: (cityQuests: EntryPermitCityQuests[]) => void
  disabled?: boolean
}) {
  function updateCity(idx: number, next: EntryPermitCityQuests) {
    onChange(cityQuests.map((c, i) => (i === idx ? next : c)))
  }

  function updateQuest(
    cityIdx: number,
    questIdx: number,
    patch: Partial<EntryPermitQuest>,
  ) {
    const city = cityQuests[cityIdx]
    updateCity(cityIdx, {
      ...city,
      quests: city.quests.map((q, i) =>
        i === questIdx ? { ...q, ...patch } : q,
      ),
    })
  }

  return (
    <div className="sea-area-edit" style={{ display: 'grid', gap: '1rem' }}>
      {cityQuests.map((city, cityIdx) => (
        <div key={`city-${cityIdx}`} className="quest-detail-section">
          <div className="port-clearable" style={{ marginBottom: '0.55rem' }}>
            <label className="field" style={{ flex: 1, margin: 0 }}>
              <span>도시</span>
              <input
                value={city.city}
                disabled={disabled}
                onChange={(e) =>
                  updateCity(cityIdx, { ...city, city: e.target.value })
                }
              />
            </label>
            <button
              type="button"
              className="admin-danger-btn"
              disabled={disabled}
              onClick={() =>
                onChange(cityQuests.filter((_, i) => i !== cityIdx))
              }
            >
              도시 삭제
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>종류</th>
                  <th>난이도</th>
                  <th>퀘스트</th>
                  <th className="col-action">삭제</th>
                </tr>
              </thead>
              <tbody>
                {city.quests.map((quest, questIdx) => (
                  <tr key={`q-${cityIdx}-${questIdx}`}>
                    <td>
                      <input
                        value={quest.kind}
                        disabled={disabled}
                        onChange={(e) =>
                          updateQuest(cityIdx, questIdx, {
                            kind: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        inputMode="numeric"
                        value={numOrEmpty(quest.difficulty)}
                        disabled={disabled}
                        onChange={(e) =>
                          updateQuest(cityIdx, questIdx, {
                            difficulty: parseOptionalInt(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={quest.name}
                        disabled={disabled}
                        onChange={(e) =>
                          updateQuest(cityIdx, questIdx, {
                            name: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="col-action">
                      <button
                        type="button"
                        className="admin-danger-btn"
                        disabled={disabled}
                        onClick={() =>
                          updateCity(cityIdx, {
                            ...city,
                            quests: city.quests.filter((_, i) => i !== questIdx),
                          })
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
              updateCity(cityIdx, {
                ...city,
                quests: [
                  ...city.quests,
                  { kind: '모험', difficulty: null, name: '' },
                ],
              })
            }
          >
            퀘스트 추가
          </button>
        </div>
      ))}
      <button
        type="button"
        className="admin-btn"
        disabled={disabled}
        onClick={() =>
          onChange([...cityQuests, { city: '', quests: [] }])
        }
      >
        도시 추가
      </button>
    </div>
  )
}
