import { useEffect, useState } from 'react'
import { updateTitle } from '../lib/api'
import type { TitleDetail } from '../types'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'

type TitleDetailViewProps = {
  title: TitleDetail
  edit?: {
    token: string
    onSaved: (title: TitleDetail) => void
    onToast?: (text: string) => void
  }
}

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
      <strong style={{ whiteSpace: 'pre-wrap' }}>
        {value?.trim() ? value : '-'}
      </strong>
    </div>
  )
}

export function TitleDetailView({ title, edit }: TitleDetailViewProps) {
  const canEdit = Boolean(edit)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(title)
    setEditing(false)
    setError('')
  }, [title])

  function startEdit() {
    setDraft(title)
    setError('')
    setEditing(true)
  }

  function cancelEdit() {
    setDraft(title)
    setError('')
    setEditing(false)
  }

  async function saveSection() {
    if (!edit) return
    setSaving(true)
    setError('')
    try {
      const res = await updateTitle(edit.token, title.id, {
        altName: draft.altName,
        description: draft.description,
        effect: draft.effect,
        requirement: draft.requirement,
      })
      edit.onSaved(res.title)
      edit.onToast?.(`저장 완료 · ${res.title.name}`)
      setEditing(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '호칭 저장에 실패했습니다.'
      setError(message)
      edit.onToast?.(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">호칭</span>
        </div>
        <h2>{title.name}</h2>
        {title.description ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{title.description}</p>
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
          editing={editing}
          onEdit={startEdit}
        />
        {editing ? (
          <div className="quest-kv-grid">
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
            <label className="field quest-kv-wide">
              <span>효과</span>
              <textarea
                rows={3}
                value={draft.effect || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    effect: e.target.value || null,
                  }))
                }
              />
            </label>
            <label className="field quest-kv-wide">
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
            <label className="field quest-kv-wide">
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
              label="추가 이름"
              value={title.altName}
              hideEmpty={!canEdit}
            />
            <Row label="효과" value={title.effect} hideEmpty={!canEdit} />
            <Row
              label="필요"
              value={title.requirement}
              hideEmpty={!canEdit}
            />
          </div>
        )}
      </section>
    </div>
  )
}
