import { useEffect, useMemo, useState } from 'react'
import { updateField } from '../lib/api'
import type {
  FieldCollectItem,
  FieldDestination,
  FieldDetail,
  FieldLandNpc,
  FieldLandSurvey,
  FieldLinkedPlace,
  FieldResurveyReward,
  FieldSurveyTask,
} from '../types'
import { DetailSectionActions, DetailSectionHead } from './DetailSectionHead'

type FieldEditConfig = {
  token: string
  onSaved: (field: FieldDetail) => void
  onToast?: (text: string) => void
}

type FieldDetailViewProps = {
  field: FieldDetail
  /** 관리자: 섹션별 연필로 수정 */
  edit?: FieldEditConfig
  /** edit 의 하위 호환 별칭 */
  requiredEdit?: FieldEditConfig
}

type EditSection =
  | 'basic'
  | 'places'
  | 'surveys'
  | 'resurvey'
  | 'collect'
  | 'destinations'
  | 'npcs'
  | 'description'

const FIELD_KINDS = ['상륙지', '도시', '기타']
const COLLECT_SOURCES = ['탐색', '채집', '조달', '낚시', '애완동물']
const DEST_SOURCES = ['발견물', '보물지도', '퀘스트']

function cloneField(field: FieldDetail): FieldDetail {
  return {
    ...field,
    linkedPlaces: (field.linkedPlaces || []).map((p) => ({ ...p })),
    landSurveys: (field.landSurveys || []).map((stage) => ({
      ...stage,
      tasks: stage.tasks.map((task) => ({ ...task })),
    })),
    resurveyRewards: (field.resurveyRewards || []).map((r) => ({
      ...r,
      items: r.items.map((i) => ({ ...i })),
    })),
    collectItems: (field.collectItems || []).map((c) => ({ ...c })),
    destinations: (field.destinations || []).map((d) => ({ ...d })),
    landNpcs: (field.landNpcs || []).map((n) => ({
      ...n,
      names: [...n.names],
    })),
  }
}

function Row({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  const text =
    value == null || value === '' ? '-' : String(value).trim() || '-'
  return (
    <div>
      <span>{label}</span>
      <strong>{text}</strong>
    </div>
  )
}

function flagLabel(value: boolean | null | undefined) {
  if (value === true) return '예'
  if (value === false) return '아니오'
  return '-'
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

/** "아이템A x2, 아이템B" → items */
function parseRewardRaw(raw: string): FieldResurveyReward['items'] {
  return raw
    .split(/[,，、\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.*?)\s*[x×*]\s*(\d+)$/i)
      if (m && m[1].trim()) {
        return { name: m[1].trim(), qty: Number(m[2]) }
      }
      return { name: part, qty: null }
    })
}

function emptyTask(): FieldSurveyTask {
  return {
    required: false,
    kind: null,
    item: null,
    count: null,
    completionGain: null,
  }
}

function emptyCollect(source: string): FieldCollectItem {
  return {
    source,
    name: '',
    rank: null,
    type: null,
    recommendSpot: null,
    canExchange: null,
    canRelease: null,
  }
}

function ReadCollectTable({
  items,
  source,
}: {
  items: FieldCollectItem[]
  source: string
}) {
  const fish = source === '낚시'
  const pet = source === '애완동물'
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {!pet && <th>랭크</th>}
            {!pet && <th>종류</th>}
            <th>아이템</th>
            {!pet && <th className="col-desk">추천 지점</th>}
            {fish && <th className="col-desk">교환</th>}
            {fish && <th className="col-desk">방생</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={`${item.source}-${item.name}-${idx}`}>
              {!pet && <td>{item.rank ?? '-'}</td>}
              {!pet && <td>{item.type || '-'}</td>}
              <td>{item.name || '-'}</td>
              {!pet && (
                <td className="col-desk">{item.recommendSpot || '-'}</td>
              )}
              {fish && (
                <td className="col-desk">{flagLabel(item.canExchange)}</td>
              )}
              {fish && (
                <td className="col-desk">{flagLabel(item.canRelease)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FieldDetailView({
  field,
  edit,
  requiredEdit,
}: FieldDetailViewProps) {
  const editConfig = edit || requiredEdit
  const canEdit = Boolean(editConfig)
  const [editing, setEditing] = useState<EditSection | null>(null)
  const [draft, setDraft] = useState(() => cloneField(field))
  const [collectTab, setCollectTab] = useState(COLLECT_SOURCES[0])
  const [destTab, setDestTab] = useState(DEST_SOURCES[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(cloneField(field))
    setEditing(null)
    setError('')
    const firstCollect = COLLECT_SOURCES.find((s) =>
      (field.collectItems || []).some((i) => i.source === s),
    )
    setCollectTab(firstCollect || COLLECT_SOURCES[0])
    const firstDest = DEST_SOURCES.find((s) =>
      (field.destinations || []).some((d) => d.source === s),
    )
    setDestTab(firstDest || DEST_SOURCES[0])
  }, [field])

  function startEdit(section: EditSection) {
    setDraft(cloneField(field))
    setError('')
    setEditing(section)
  }

  function cancelEdit() {
    setDraft(cloneField(field))
    setError('')
    setEditing(null)
  }

  function patchDraft(partial: Partial<FieldDetail>) {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  async function saveSection() {
    if (!editConfig || !editing) return
    setSaving(true)
    setError('')
    try {
      let patch: Partial<FieldDetail> = {}
      if (editing === 'basic') {
        if (!draft.name.trim()) throw new Error('필드 이름이 필요합니다.')
        patch = {
          name: draft.name.trim(),
          altName: draft.altName?.trim() || null,
          fieldKind: draft.fieldKind?.trim() || null,
          region: draft.region?.trim() || null,
          seaArea: draft.seaArea?.trim() || null,
          coordX: draft.coordX,
          coordY: draft.coordY,
        }
      } else if (editing === 'description') {
        patch = { description: draft.description?.trim() || null }
      } else if (editing === 'places') {
        patch = {
          linkedPlaces: draft.linkedPlaces.filter(
            (p) => p.kind.trim() || p.name.trim(),
          ),
        }
      } else if (editing === 'surveys') {
        patch = {
          landSurveys: draft.landSurveys.map((stage) => ({
            ...stage,
            tasks: stage.tasks.filter(
              (t) => t.kind?.trim() || t.item?.trim() || t.count != null,
            ),
          })),
        }
      } else if (editing === 'resurvey') {
        patch = {
          resurveyRewards: draft.resurveyRewards
            .filter((r) => r.kind.trim() || r.raw.trim())
            .map((r) => ({
              kind: r.kind.trim(),
              raw: r.raw.trim(),
              items: r.items.length ? r.items : parseRewardRaw(r.raw),
            })),
        }
      } else if (editing === 'collect') {
        patch = {
          collectItems: draft.collectItems.filter((i) => i.name.trim()),
        }
      } else if (editing === 'destinations') {
        patch = {
          destinations: draft.destinations.filter(
            (d) => d.discovery.trim() || d.content.trim(),
          ),
        }
      } else if (editing === 'npcs') {
        patch = {
          landNpcs: draft.landNpcs.filter(
            (n) =>
              n.level != null ||
              (n.trait && n.trait.trim()) ||
              n.names.length > 0,
          ),
        }
      }

      const res = await updateField(editConfig.token, field.id, patch)
      editConfig.onSaved(res.field)
      editConfig.onToast?.(`저장 완료 · ${res.field.name}`)
      setEditing(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '필드 저장에 실패했습니다.'
      setError(message)
      editConfig.onToast?.(message)
    } finally {
      setSaving(false)
    }
  }

  const coords =
    field.coordX != null && field.coordY != null
      ? `${field.coordX}, ${field.coordY}`
      : null

  const collectItems = field.collectItems || []
  const collectTabs = useMemo(() => {
    const extras = Array.from(
      new Set(
        collectItems
          .map((i) => i.source)
          .filter((s): s is string => Boolean(s) && !COLLECT_SOURCES.includes(s)),
      ),
    )
    const all = [...COLLECT_SOURCES, ...extras]
    if (canEdit || editing === 'collect') return all
    return all.filter((s) => collectItems.some((i) => i.source === s))
  }, [canEdit, editing, collectItems])

  const viewCollectRows = collectItems.filter((i) => i.source === collectTab)

  const destinations = field.destinations || []
  const destTabs = useMemo(() => {
    const extras = Array.from(
      new Set(
        destinations
          .map((d) => d.source)
          .filter((s): s is string => Boolean(s) && !DEST_SOURCES.includes(s)),
      ),
    )
    const all = [...DEST_SOURCES, ...extras]
    if (canEdit || editing === 'destinations') return all
    return all.filter((s) => destinations.some((d) => d.source === s))
  }, [canEdit, editing, destinations])

  const viewDestRows = destinations.filter((d) => d.source === destTab)
  const draftDestRows = draft.destinations
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.source === destTab)

  useEffect(() => {
    if (collectTabs.length && !collectTabs.includes(collectTab)) {
      setCollectTab(collectTabs[0])
    }
  }, [collectTabs, collectTab])

  useEffect(() => {
    if (destTabs.length && !destTabs.includes(destTab)) {
      setDestTab(destTabs[0])
    }
  }, [destTabs, destTab])

  const surveys = field.landSurveys || []
  const showPlaces = canEdit || (field.linkedPlaces || []).length > 0
  const showSurveys = canEdit || surveys.length > 0
  const showResurvey = canEdit || (field.resurveyRewards || []).length > 0
  const showCollect = canEdit || collectItems.length > 0
  const showDestinations = canEdit || (field.destinations || []).length > 0
  const showNpcs = canEdit || (field.landNpcs || []).length > 0
  const showDescription = canEdit || Boolean(field.description)

  function actions() {
    return (
      <DetailSectionActions
        busy={saving}
        onCancel={cancelEdit}
        onSave={() => void saveSection()}
      />
    )
  }

  /* ---------- draft 편집 헬퍼 ---------- */
  function setPlace(idx: number, partial: Partial<FieldLinkedPlace>) {
    patchDraft({
      linkedPlaces: draft.linkedPlaces.map((p, i) =>
        i === idx ? { ...p, ...partial } : p,
      ),
    })
  }

  function setStage(idx: number, partial: Partial<FieldLandSurvey>) {
    patchDraft({
      landSurveys: draft.landSurveys.map((s, i) =>
        i === idx ? { ...s, ...partial } : s,
      ),
    })
  }

  function setTask(
    stageIdx: number,
    taskIdx: number,
    partial: Partial<FieldSurveyTask>,
  ) {
    patchDraft({
      landSurveys: draft.landSurveys.map((s, i) =>
        i === stageIdx
          ? {
              ...s,
              tasks: s.tasks.map((t, j) =>
                j === taskIdx ? { ...t, ...partial } : t,
              ),
            }
          : s,
      ),
    })
  }

  function setReward(idx: number, partial: Partial<FieldResurveyReward>) {
    patchDraft({
      resurveyRewards: draft.resurveyRewards.map((r, i) =>
        i === idx ? { ...r, ...partial } : r,
      ),
    })
  }

  function setCollect(idx: number, partial: Partial<FieldCollectItem>) {
    patchDraft({
      collectItems: draft.collectItems.map((c, i) =>
        i === idx ? { ...c, ...partial } : c,
      ),
    })
  }

  function setDestination(idx: number, partial: Partial<FieldDestination>) {
    patchDraft({
      destinations: draft.destinations.map((d, i) =>
        i === idx ? { ...d, ...partial } : d,
      ),
    })
  }

  function setNpc(idx: number, partial: Partial<FieldLandNpc>) {
    patchDraft({
      landNpcs: draft.landNpcs.map((n, i) =>
        i === idx ? { ...n, ...partial } : n,
      ),
    })
  }

  const nextStageNumber =
    draft.landSurveys.reduce((max, s) => Math.max(max, s.stage || 0), 0) + 1

  return (
    <div className="quest-detail sea-area-edit">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">
            {field.fieldKind ? field.fieldKind : '필드'}
          </span>
        </div>
        <h2>{field.name}</h2>
        {field.altName ? <p>{field.altName}</p> : null}
        {!canEdit && field.description ? <p>{field.description}</p> : null}
      </header>

      {error ? (
        <p className="form-note error" role="alert">
          {error}
        </p>
      ) : null}

      {/* 1. 기본 정보 */}
      <section className="quest-detail-section">
        <DetailSectionHead
          title="기본 정보"
          canEdit={canEdit}
          editing={editing === 'basic'}
          onEdit={() => startEdit('basic')}
        />
        {editing === 'basic' ? (
          <>
            <div className="sea-area-edit-grid">
              <label className="field">
                <span>필드</span>
                <input
                  value={draft.name}
                  required
                  disabled={saving}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>추가 이름</span>
                <input
                  value={draft.altName || ''}
                  disabled={saving}
                  onChange={(e) =>
                    patchDraft({ altName: e.target.value || null })
                  }
                />
              </label>
              <label className="field">
                <span>필드 종류</span>
                <select
                  value={draft.fieldKind || ''}
                  disabled={saving}
                  onChange={(e) =>
                    patchDraft({ fieldKind: e.target.value || null })
                  }
                >
                  <option value="">선택</option>
                  {FIELD_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                  {draft.fieldKind && !FIELD_KINDS.includes(draft.fieldKind) && (
                    <option value={draft.fieldKind}>{draft.fieldKind}</option>
                  )}
                </select>
              </label>
              <label className="field">
                <span>지역</span>
                <input
                  value={draft.region || ''}
                  disabled={saving}
                  onChange={(e) =>
                    patchDraft({ region: e.target.value || null })
                  }
                />
              </label>
              <label className="field">
                <span>해역</span>
                <input
                  value={draft.seaArea || ''}
                  disabled={saving}
                  onChange={(e) =>
                    patchDraft({ seaArea: e.target.value || null })
                  }
                />
              </label>
              <label className="field">
                <span>좌표 X</span>
                <input
                  inputMode="numeric"
                  value={numOrEmpty(draft.coordX)}
                  disabled={saving}
                  onChange={(e) =>
                    patchDraft({ coordX: parseOptionalInt(e.target.value) })
                  }
                />
              </label>
              <label className="field">
                <span>좌표 Y</span>
                <input
                  inputMode="numeric"
                  value={numOrEmpty(draft.coordY)}
                  disabled={saving}
                  onChange={(e) =>
                    patchDraft({ coordY: parseOptionalInt(e.target.value) })
                  }
                />
              </label>
            </div>
            {actions()}
          </>
        ) : (
          <div className="quest-kv-grid">
            <Row label="필드 종류" value={field.fieldKind} />
            <Row label="필드" value={field.name} />
            <Row label="추가 이름" value={field.altName} />
            <Row label="지역" value={field.region} />
            <Row label="해역" value={field.seaArea} />
            <Row label="좌표" value={coords} />
          </div>
        )}
      </section>

      {/* 2. 연결된 장소 */}
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
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>종류</th>
                      <th>내용</th>
                      <th className="col-action">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.linkedPlaces.map((place, idx) => (
                      <tr key={`place-${idx}`}>
                        <td>
                          <input
                            value={place.kind}
                            disabled={saving}
                            onChange={(e) =>
                              setPlace(idx, { kind: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={place.name}
                            disabled={saving}
                            onChange={(e) =>
                              setPlace(idx, { name: e.target.value })
                            }
                          />
                        </td>
                        <td className="col-action">
                          <button
                            type="button"
                            className="admin-danger-btn"
                            disabled={saving}
                            onClick={() =>
                              patchDraft({
                                linkedPlaces: draft.linkedPlaces.filter(
                                  (_, i) => i !== idx,
                                ),
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
                disabled={saving}
                onClick={() =>
                  patchDraft({
                    linkedPlaces: [
                      ...draft.linkedPlaces,
                      { kind: '', name: '' },
                    ],
                  })
                }
              >
                추가
              </button>
              {actions()}
            </>
          ) : (field.linkedPlaces || []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>종류</th>
                    <th>내용</th>
                  </tr>
                </thead>
                <tbody>
                  {field.linkedPlaces.map((place, idx) => (
                    <tr key={`${place.kind}-${place.name}-${idx}`}>
                      <td>{place.kind || '-'}</td>
                      <td>{place.name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 장소가 없습니다.</p>
          )}
        </section>
      )}

      {/* 3. 육지 조사 */}
      {showSurveys && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="육지 조사"
            canEdit={canEdit}
            editing={editing === 'surveys'}
            onEdit={() => startEdit('surveys')}
          />
          {editing === 'surveys' ? (
            <>
              {draft.landSurveys.length === 0 ? (
                <p className="form-note">등록된 조사 단계가 없습니다.</p>
              ) : null}
              {draft.landSurveys.map((stage, stageIdx) => (
                <div
                  key={`stage-${stageIdx}`}
                  style={{ marginBottom: '1rem' }}
                >
                  <div className="sea-area-edit-grid">
                    <label className="field">
                      <span>단계</span>
                      <input
                        inputMode="numeric"
                        value={numOrEmpty(stage.stage)}
                        disabled={saving}
                        onChange={(e) =>
                          setStage(stageIdx, {
                            stage: parseOptionalInt(e.target.value) ?? 0,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>완성도 제한</span>
                      <input
                        value={stage.completionLimit || ''}
                        disabled={saving}
                        onChange={(e) =>
                          setStage(stageIdx, {
                            completionLimit: e.target.value || null,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>필수</th>
                          <th>종류</th>
                          <th>조사 항목</th>
                          <th>횟수</th>
                          <th>획득 완성도</th>
                          <th className="col-action">삭제</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stage.tasks.map((task, taskIdx) => (
                          <tr key={`task-${stageIdx}-${taskIdx}`}>
                            <td>
                              <input
                                type="checkbox"
                                checked={task.required}
                                disabled={saving}
                                aria-label={`${stage.stage}단계 ${task.kind || '항목'} 필수`}
                                onChange={(e) =>
                                  setTask(stageIdx, taskIdx, {
                                    required: e.target.checked,
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                value={task.kind || ''}
                                disabled={saving}
                                onChange={(e) =>
                                  setTask(stageIdx, taskIdx, {
                                    kind: e.target.value || null,
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                value={task.item || ''}
                                disabled={saving}
                                onChange={(e) =>
                                  setTask(stageIdx, taskIdx, {
                                    item: e.target.value || null,
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                inputMode="numeric"
                                value={numOrEmpty(task.count)}
                                disabled={saving}
                                onChange={(e) =>
                                  setTask(stageIdx, taskIdx, {
                                    count: parseOptionalInt(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                value={task.completionGain || ''}
                                disabled={saving}
                                onChange={(e) =>
                                  setTask(stageIdx, taskIdx, {
                                    completionGain: e.target.value || null,
                                  })
                                }
                              />
                            </td>
                            <td className="col-action">
                              <button
                                type="button"
                                className="admin-danger-btn"
                                disabled={saving}
                                onClick={() =>
                                  setStage(stageIdx, {
                                    tasks: stage.tasks.filter(
                                      (_, i) => i !== taskIdx,
                                    ),
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
                  <div className="quest-walkthrough-actions">
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={saving}
                      onClick={() =>
                        setStage(stageIdx, {
                          tasks: [...stage.tasks, emptyTask()],
                        })
                      }
                    >
                      과제 추가
                    </button>
                    <button
                      type="button"
                      className="admin-danger-btn"
                      disabled={saving}
                      onClick={() =>
                        patchDraft({
                          landSurveys: draft.landSurveys.filter(
                            (_, i) => i !== stageIdx,
                          ),
                        })
                      }
                    >
                      단계 삭제
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="admin-btn"
                disabled={saving}
                onClick={() =>
                  patchDraft({
                    landSurveys: [
                      ...draft.landSurveys,
                      {
                        stage: nextStageNumber,
                        completionLimit: null,
                        tasks: [emptyTask()],
                      },
                    ],
                  })
                }
              >
                단계 추가
              </button>
              {actions()}
            </>
          ) : surveys.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>단계</th>
                    <th>필수</th>
                    <th>종류</th>
                    <th>조사 항목</th>
                    <th>횟수</th>
                    <th>획득 완성도</th>
                    <th>완성도 제한</th>
                  </tr>
                </thead>
                <tbody>
                  {surveys.flatMap((stage, stageIdx) =>
                    stage.tasks.map((task, taskIdx) => (
                      <tr key={`${stageIdx}-${stage.stage}-${taskIdx}`}>
                        <td>{taskIdx === 0 ? stage.stage : ''}</td>
                        <td>
                          {task.required ? (
                            <span className="field-required-mark">필수</span>
                          ) : (
                            <span className="quest-muted">-</span>
                          )}
                        </td>
                        <td>{task.kind || '-'}</td>
                        <td>{task.item || '-'}</td>
                        <td>{task.count ?? '-'}</td>
                        <td>{task.completionGain || '-'}</td>
                        <td>
                          {taskIdx === 0 ? stage.completionLimit || '-' : ''}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 육지 조사가 없습니다.</p>
          )}
        </section>
      )}

      {/* 4. 육지 재조사 보상 */}
      {showResurvey && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="육지 재조사 보상"
            canEdit={canEdit}
            editing={editing === 'resurvey'}
            onEdit={() => startEdit('resurvey')}
          />
          {editing === 'resurvey' ? (
            <>
              <p className="form-note">
                아이템은 쉼표로 구분하고, 수량은 &quot;이름 x2&quot; 형식으로
                입력하세요.
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>종류</th>
                      <th>아이템</th>
                      <th className="col-action">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.resurveyRewards.map((row, idx) => (
                      <tr key={`reward-${idx}`}>
                        <td>
                          <input
                            value={row.kind}
                            disabled={saving}
                            onChange={(e) =>
                              setReward(idx, { kind: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={row.raw}
                            disabled={saving}
                            onChange={(e) =>
                              setReward(idx, {
                                raw: e.target.value,
                                items: parseRewardRaw(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="col-action">
                          <button
                            type="button"
                            className="admin-danger-btn"
                            disabled={saving}
                            onClick={() =>
                              patchDraft({
                                resurveyRewards: draft.resurveyRewards.filter(
                                  (_, i) => i !== idx,
                                ),
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
                disabled={saving}
                onClick={() =>
                  patchDraft({
                    resurveyRewards: [
                      ...draft.resurveyRewards,
                      { kind: '', items: [], raw: '' },
                    ],
                  })
                }
              >
                추가
              </button>
              {actions()}
            </>
          ) : (field.resurveyRewards || []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>종류</th>
                    <th>아이템</th>
                  </tr>
                </thead>
                <tbody>
                  {field.resurveyRewards.map((row, idx) => (
                    <tr key={`${row.kind}-${idx}`}>
                      <td>{row.kind || '-'}</td>
                      <td>{row.raw || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 재조사 보상이 없습니다.</p>
          )}
        </section>
      )}

      {/* 5. 수집 아이템 */}
      {showCollect && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="수집 아이템"
            canEdit={canEdit}
            editing={editing === 'collect'}
            onEdit={() => startEdit('collect')}
          />
          {collectTabs.length > 0 ? (
            <div className="port-subtabs" role="tablist" aria-label="수집 아이템">
              {collectTabs.map((source) => (
                <button
                  key={source}
                  type="button"
                  role="tab"
                  className={source === collectTab ? 'active' : ''}
                  aria-selected={source === collectTab}
                  onClick={() => setCollectTab(source)}
                >
                  {source}
                </button>
              ))}
            </div>
          ) : null}
          {editing === 'collect' ? (
            <>
              {(() => {
                const fish = collectTab === '낚시'
                const pet = collectTab === '애완동물'
                const rows = draft.collectItems
                  .map((item, index) => ({ item, index }))
                  .filter(({ item }) => item.source === collectTab)
                return (
                  <>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            {!pet && <th>랭크</th>}
                            {!pet && <th>종류</th>}
                            <th>아이템</th>
                            {!pet && <th className="col-desk">추천 지점</th>}
                            {fish && <th className="col-desk">교환</th>}
                            {fish && <th className="col-desk">방생</th>}
                            <th className="col-action">삭제</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(({ item, index }) => (
                            <tr key={`collect-${index}`}>
                              {!pet && (
                                <td>
                                  <input
                                    inputMode="numeric"
                                    value={numOrEmpty(item.rank)}
                                    disabled={saving}
                                    onChange={(e) =>
                                      setCollect(index, {
                                        rank: parseOptionalInt(e.target.value),
                                      })
                                    }
                                  />
                                </td>
                              )}
                              {!pet && (
                                <td>
                                  <input
                                    value={item.type || ''}
                                    disabled={saving}
                                    onChange={(e) =>
                                      setCollect(index, {
                                        type: e.target.value || null,
                                      })
                                    }
                                  />
                                </td>
                              )}
                              <td>
                                <input
                                  value={item.name}
                                  disabled={saving}
                                  onChange={(e) =>
                                    setCollect(index, { name: e.target.value })
                                  }
                                />
                              </td>
                              {!pet && (
                                <td className="col-desk">
                                  <input
                                    value={item.recommendSpot || ''}
                                    disabled={saving}
                                    onChange={(e) =>
                                      setCollect(index, {
                                        recommendSpot: e.target.value || null,
                                      })
                                    }
                                  />
                                </td>
                              )}
                              {fish && (
                                <td className="col-desk">
                                  <input
                                    type="checkbox"
                                    checked={item.canExchange === true}
                                    disabled={saving}
                                    onChange={(e) =>
                                      setCollect(index, {
                                        canExchange: e.target.checked,
                                      })
                                    }
                                  />
                                </td>
                              )}
                              {fish && (
                                <td className="col-desk">
                                  <input
                                    type="checkbox"
                                    checked={item.canRelease === true}
                                    disabled={saving}
                                    onChange={(e) =>
                                      setCollect(index, {
                                        canRelease: e.target.checked,
                                      })
                                    }
                                  />
                                </td>
                              )}
                              <td className="col-action">
                                <button
                                  type="button"
                                  className="admin-danger-btn"
                                  disabled={saving}
                                  onClick={() =>
                                    patchDraft({
                                      collectItems: draft.collectItems.filter(
                                        (_, i) => i !== index,
                                      ),
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
                      disabled={saving}
                      onClick={() =>
                        patchDraft({
                          collectItems: [
                            ...draft.collectItems,
                            emptyCollect(collectTab),
                          ],
                        })
                      }
                    >
                      {collectTab} 추가
                    </button>
                  </>
                )
              })()}
              {actions()}
            </>
          ) : viewCollectRows.length > 0 ? (
            <ReadCollectTable items={viewCollectRows} source={collectTab} />
          ) : (
            <p className="form-note">등록된 수집 아이템이 없습니다.</p>
          )}
        </section>
      )}

      {/* 6. 목적지 */}
      {showDestinations && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="목적지"
            canEdit={canEdit}
            editing={editing === 'destinations'}
            onEdit={() => startEdit('destinations')}
          />
          {destTabs.length > 0 ? (
            <div className="port-subtabs" role="tablist" aria-label="목적지">
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
          ) : null}
          {editing === 'destinations' ? (
            <>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>
                        {destTab === '퀘스트'
                          ? '퀘스트'
                          : destTab === '보물지도'
                            ? '보물지도'
                            : '발견물'}
                      </th>
                      <th>내용</th>
                      <th className="col-action">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftDestRows.map(({ item, index }) => (
                      <tr key={`dest-${index}`}>
                        <td>
                          <input
                            value={item.discovery}
                            disabled={saving}
                            onChange={(e) =>
                              setDestination(index, {
                                discovery: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={item.content}
                            disabled={saving}
                            onChange={(e) =>
                              setDestination(index, {
                                content: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td className="col-action">
                          <button
                            type="button"
                            className="admin-danger-btn"
                            disabled={saving}
                            onClick={() =>
                              patchDraft({
                                destinations: draft.destinations.filter(
                                  (_, i) => i !== index,
                                ),
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
                disabled={saving}
                onClick={() =>
                  patchDraft({
                    destinations: [
                      ...draft.destinations,
                      {
                        source: destTab,
                        discovery: '',
                        content: '',
                      },
                    ],
                  })
                }
              >
                {destTab} 추가
              </button>
              {actions()}
            </>
          ) : viewDestRows.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>
                      {destTab === '퀘스트'
                        ? '퀘스트'
                        : destTab === '보물지도'
                          ? '보물지도'
                          : '발견물'}
                    </th>
                    <th>내용</th>
                  </tr>
                </thead>
                <tbody>
                  {viewDestRows.map((item, idx) => (
                    <tr key={`${destTab}-${item.discovery}-${idx}`}>
                      <td>{item.discovery || '-'}</td>
                      <td>{item.content || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 목적지가 없습니다.</p>
          )}
        </section>
      )}

      {/* 7. 육상 NPC */}
      {showNpcs && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="육상 NPC"
            canEdit={canEdit}
            editing={editing === 'npcs'}
            onEdit={() => startEdit('npcs')}
          />
          {editing === 'npcs' ? (
            <>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>레벨</th>
                      <th>특징</th>
                      <th>육상 NPC</th>
                      <th className="col-action">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.landNpcs.map((npc, idx) => (
                      <tr key={`npc-${idx}`}>
                        <td>
                          <input
                            inputMode="numeric"
                            value={numOrEmpty(npc.level)}
                            disabled={saving}
                            onChange={(e) =>
                              setNpc(idx, {
                                level: parseOptionalInt(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={npc.trait || ''}
                            disabled={saving}
                            onChange={(e) =>
                              setNpc(idx, { trait: e.target.value || null })
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={npc.names.join(', ')}
                            disabled={saving}
                            placeholder="쉼표로 구분"
                            onChange={(e) =>
                              setNpc(idx, {
                                names: e.target.value
                                  .split(/[,，]/)
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </td>
                        <td className="col-action">
                          <button
                            type="button"
                            className="admin-danger-btn"
                            disabled={saving}
                            onClick={() =>
                              patchDraft({
                                landNpcs: draft.landNpcs.filter(
                                  (_, i) => i !== idx,
                                ),
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
                disabled={saving}
                onClick={() =>
                  patchDraft({
                    landNpcs: [
                      ...draft.landNpcs,
                      { level: null, trait: null, names: [] },
                    ],
                  })
                }
              >
                추가
              </button>
              {actions()}
            </>
          ) : (field.landNpcs || []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>레벨</th>
                    <th>특징</th>
                    <th>육상 NPC</th>
                  </tr>
                </thead>
                <tbody>
                  {field.landNpcs.map((npc, idx) => (
                    <tr key={`${npc.level}-${idx}`}>
                      <td>{npc.level ?? '-'}</td>
                      <td>{npc.trait || '-'}</td>
                      <td>{npc.names.length ? npc.names.join(', ') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 육상 NPC가 없습니다.</p>
          )}
        </section>
      )}

      {/* 8. 설명 */}
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
                  placeholder="필드 설명"
                  disabled={saving}
                  onChange={(e) =>
                    patchDraft({ description: e.target.value || null })
                  }
                />
              </label>
              {actions()}
            </>
          ) : (
            <p>{field.description || '설명이 없습니다.'}</p>
          )}
        </section>
      )}
    </div>
  )
}
