import { useEffect, useState } from 'react'
import { updateField } from '../lib/api'
import type { FieldDetail, FieldLandSurvey } from '../types'

type FieldDetailViewProps = {
  field: FieldDetail
  /** 관리자만: 육지 조사 필수 여부 편집 */
  requiredEdit?: {
    token: string
    onSaved: (field: FieldDetail) => void
    onToast?: (text: string) => void
  }
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value?.trim() ? value : '-'}</strong>
    </div>
  )
}

function cloneSurveys(surveys: FieldLandSurvey[]): FieldLandSurvey[] {
  return surveys.map((stage) => ({
    ...stage,
    tasks: stage.tasks.map((task) => ({ ...task })),
  }))
}

export function FieldDetailView({ field, requiredEdit }: FieldDetailViewProps) {
  const canEditRequired = Boolean(requiredEdit)
  const [surveys, setSurveys] = useState(() => cloneSurveys(field.landSurveys))
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saveNote, setSaveNote] = useState('')

  useEffect(() => {
    setSurveys(cloneSurveys(field.landSurveys))
    setError('')
    setSaveNote('')
    setBusyKey(null)
  }, [field.id, field.landSurveys])

  const coords =
    field.coordX != null && field.coordY != null
      ? `${field.coordX}, ${field.coordY}`
      : null

  async function toggleRequired(stageIndex: number, taskIndex: number) {
    if (!requiredEdit) return
    const key = `${stageIndex}-${taskIndex}`
    const next = cloneSurveys(surveys)
    const stage = next[stageIndex]
    const task = stage?.tasks[taskIndex]
    if (!task) return
    const nextRequired = !task.required
    task.required = nextRequired
    setSurveys(next)
    setBusyKey(key)
    setError('')
    setSaveNote('')
    try {
      const res = await updateField(requiredEdit.token, field.id, {
        landSurveys: next,
      })
      requiredEdit.onSaved(res.field)
      const label = [
        `${stage.stage}단계`,
        task.kind || task.item || '항목',
        nextRequired ? '필수' : '선택',
      ].join(' · ')
      const note = `저장 완료 · ${label}`
      setSaveNote(note)
      requiredEdit.onToast?.(note)
    } catch (err) {
      setSurveys(cloneSurveys(field.landSurveys))
      const message =
        err instanceof Error ? err.message : '필수 여부 저장에 실패했습니다.'
      setError(message)
      setSaveNote('')
      requiredEdit.onToast?.(message)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">
            {field.fieldKind ? field.fieldKind : '필드'}
          </span>
        </div>
        <h2>{field.name}</h2>
      </header>

      <section className="quest-detail-section">
        <h3>기본 정보</h3>
        <div className="quest-kv-grid">
          <Row label="필드 종류" value={field.fieldKind} />
          <Row label="지역" value={field.region} />
          <Row label="해역" value={field.seaArea} />
          <Row label="좌표" value={coords} />
        </div>
      </section>

      {(field.linkedPlaces || []).length > 0 && (
        <section className="quest-detail-section">
          <h3>연결된 장소</h3>
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
        </section>
      )}

      {surveys.length > 0 && (
        <section className="quest-detail-section">
          <h3>육지 조사</h3>
          {error ? (
            <p className="form-note error" role="alert">
              {error}
            </p>
          ) : null}
          {!error && saveNote ? (
            <p className="form-note" role="status">
              {saveNote}
            </p>
          ) : null}
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
                {surveys.flatMap((stage, stageIndex) =>
                  stage.tasks.map((task, taskIndex) => {
                    const key = `${stageIndex}-${taskIndex}`
                    return (
                      <tr key={`${stage.stage}-${task.kind}-${taskIndex}`}>
                        <td>{taskIndex === 0 ? stage.stage : ''}</td>
                        <td>
                          {canEditRequired ? (
                            <label className="field-required-toggle">
                              <input
                                type="checkbox"
                                checked={task.required}
                                disabled={busyKey === key}
                                onChange={() =>
                                  void toggleRequired(stageIndex, taskIndex)
                                }
                                aria-label={`${stage.stage}단계 ${task.kind || '항목'} 필수`}
                              />
                            </label>
                          ) : task.required ? (
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
                          {taskIndex === 0 ? stage.completionLimit || '-' : ''}
                        </td>
                      </tr>
                    )
                  }),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {field.resurveyRewards.length > 0 && (
        <section className="quest-detail-section">
          <h3>육지 재조사 보상</h3>
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
                    <td>{row.kind}</td>
                    <td>{row.raw || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
