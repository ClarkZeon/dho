import { useEffect, useMemo, useState } from 'react'
import { updateMemorialAlbum } from '../lib/api'
import type { MemorialAlbumDetail, MemorialAlbumItem } from '../types'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'

type MemorialAlbumDetailViewProps = {
  album: MemorialAlbumDetail
  edit?: {
    token: string
    onSaved: (album: MemorialAlbumDetail) => void
    onToast?: (text: string) => void
  }
  /** 유저 도감: 로컬 완료 체크 표시 */
  trackCompletion?: boolean
}

type EditSection = 'basic' | 'items'

const COMPLETION_KEY = 'dho.memorialAlbum.done'

function loadDoneSet(albumId: number): Set<string> {
  try {
    const raw = localStorage.getItem(`${COMPLETION_KEY}.${albumId}`)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch {
    return new Set()
  }
}

function saveDoneSet(albumId: number, done: Set<string>) {
  try {
    localStorage.setItem(
      `${COMPLETION_KEY}.${albumId}`,
      JSON.stringify([...done]),
    )
  } catch {
    /* ignore */
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

function cloneAlbum(album: MemorialAlbumDetail): MemorialAlbumDetail {
  return {
    ...album,
    items: (album.items || []).map((item) => ({ ...item })),
  }
}

export function MemorialAlbumDetailView({
  album,
  edit,
  trackCompletion = false,
}: MemorialAlbumDetailViewProps) {
  const canEdit = Boolean(edit)
  const [editing, setEditing] = useState<EditSection | null>(null)
  const [draft, setDraft] = useState(() => cloneAlbum(album))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<Set<string>>(() =>
    trackCompletion ? loadDoneSet(album.id) : new Set(),
  )
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setDraft(cloneAlbum(album))
    setEditing(null)
    setError('')
    setSelected(new Set())
    if (trackCompletion) setDone(loadDoneSet(album.id))
  }, [album, trackCompletion])

  const doneCount = useMemo(() => {
    if (!trackCompletion) return 0
    return (album.items || []).filter((item) => done.has(item.name)).length
  }, [album.items, done, trackCompletion])

  function startEdit(section: EditSection) {
    setDraft(cloneAlbum(album))
    setError('')
    setEditing(section)
  }

  function cancelEdit() {
    setDraft(cloneAlbum(album))
    setError('')
    setEditing(null)
  }

  async function saveSection() {
    if (!edit || !editing) return
    setSaving(true)
    setError('')
    try {
      let patch: Partial<MemorialAlbumDetail> = {}
      if (editing === 'basic') {
        patch = {
          description: draft.description,
          altName: draft.altName,
          category: draft.category,
          rewardNpc: draft.rewardNpc,
          rewardItem: draft.rewardItem,
          itemCount: draft.itemCount,
        }
      } else {
        patch = {
          items: draft.items.filter((r) => r.name.trim()),
        }
      }
      const res = await updateMemorialAlbum(edit.token, album.id, patch)
      edit.onSaved(res.memorialAlbum)
      edit.onToast?.(`저장 완료 · ${res.memorialAlbum.name}`)
      setEditing(null)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : '메모리얼 앨범 저장에 실패했습니다.'
      setError(message)
      edit.onToast?.(message)
    } finally {
      setSaving(false)
    }
  }

  function toggleSelect(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function markSelectedDone() {
    if (!selected.size) return
    setDone((prev) => {
      const next = new Set(prev)
      for (const name of selected) next.add(name)
      saveDoneSet(album.id, next)
      return next
    })
    setSelected(new Set())
  }

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">메모리얼 앨범</span>
        </div>
        <h2>{album.name}</h2>
        {album.description ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{album.description}</p>
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
              <span>보상 NPC</span>
              <input
                value={draft.rewardNpc || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    rewardNpc: e.target.value || null,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>보상품</span>
              <input
                value={draft.rewardItem || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    rewardItem: e.target.value || null,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>항목 개수</span>
              <input
                value={draft.itemCount ?? ''}
                disabled={saving}
                onChange={(e) => {
                  const t = e.target.value.trim()
                  setDraft((prev) => ({
                    ...prev,
                    itemCount: t ? Number(t) || null : null,
                  }))
                }}
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
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </div>
          </div>
        ) : (
          <div className="quest-kv-grid">
            <Row label="분류" value={album.category} />
            <Row label="추가 이름" value={album.altName} />
            <Row label="보상 NPC" value={album.rewardNpc} />
            <Row label="보상품" value={album.rewardItem} />
            <Row
              label="항목"
              value={
                trackCompletion
                  ? `${doneCount} / ${album.items.length}`
                  : album.itemCount != null
                    ? String(album.itemCount)
                    : String(album.items.length)
              }
            />
          </div>
        )}
      </section>

      <section className="quest-detail-section">
        <DetailSectionHead
          title="항목"
          canEdit={canEdit}
          editing={editing === 'items'}
          onEdit={() => startEdit('items')}
        />
        {editing === 'items' ? (
          <>
            <ItemsEditor
              rows={draft.items}
              disabled={saving}
              onChange={(items) => setDraft((prev) => ({ ...prev, items }))}
            />
            <DetailSectionActions
              busy={saving}
              onCancel={cancelEdit}
              onSave={() => void saveSection()}
            />
          </>
        ) : (album.items || []).length > 0 ? (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>아이템</th>
                    {trackCompletion ? <th className="col-desk">완료</th> : null}
                    <th className="col-desk">부연 설명</th>
                  </tr>
                </thead>
                <tbody>
                  {album.items.map((row, idx) => {
                    const isDone = done.has(row.name)
                    return (
                      <tr
                        key={`${row.name}-${idx}`}
                        className={idx % 2 === 0 ? 'is-even' : 'is-odd'}
                      >
                        <td>{row.name}</td>
                        {trackCompletion ? (
                          <td className="col-desk">
                            <input
                              type="checkbox"
                              checked={selected.has(row.name) || isDone}
                              disabled={isDone}
                              aria-label={`${row.name} 선택`}
                              onChange={() => toggleSelect(row.name)}
                            />
                          </td>
                        ) : null}
                        <td className="col-desk">{row.note || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {trackCompletion ? (
              <div className="form-actions" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  disabled={!selected.size}
                  onClick={markSelectedDone}
                >
                  선택된 항목 완료
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="form-note">등록된 항목이 없습니다.</p>
        )}
      </section>
    </div>
  )
}

function ItemsEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: MemorialAlbumItem[]
  onChange: (rows: MemorialAlbumItem[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>아이템</th>
              <th>부연 설명</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`memorial-item-${idx}`}>
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
                    value={row.note || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rows.map((r, i) =>
                          i === idx
                            ? { ...r, note: e.target.value || null }
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
        onClick={() => onChange([...rows, { name: '', note: null }])}
      >
        추가
      </button>
    </>
  )
}
