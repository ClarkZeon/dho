import { useEffect, useState } from 'react'
import { updatePort } from '../lib/api'
import type { PortCollectItem, PortDetail, PortReward } from '../types'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'

type PortDetailViewProps = {
  port: PortDetail
  edit?: {
    token: string
    onSaved: (port: PortDetail) => void
    onToast?: (text: string) => void
  }
}

type EditSection = 'basic' | 'rewards' | 'collect' | 'description'

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value?.trim() ? value : '-'}</strong>
    </div>
  )
}

function clonePort(port: PortDetail): PortDetail {
  return {
    ...port,
    rewards: port.rewards.map((r) => ({ ...r })),
    collectItems: port.collectItems.map((c) => ({ ...c })),
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

export function PortDetailView({ port, edit }: PortDetailViewProps) {
  const canEdit = Boolean(edit)
  const [editing, setEditing] = useState<EditSection | null>(null)
  const [draft, setDraft] = useState(() => clonePort(port))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(clonePort(port))
    setEditing(null)
    setError('')
  }, [port])

  const coords =
    port.coordX != null && port.coordY != null
      ? `${port.coordX}, ${port.coordY}`
      : null

  const collectBySource = port.collectItems.reduce<
    Record<string, typeof port.collectItems>
  >((acc, item) => {
    const key = item.source || '기타'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  function startEdit(section: EditSection) {
    setDraft(clonePort(port))
    setError('')
    setEditing(section)
  }

  function cancelEdit() {
    setDraft(clonePort(port))
    setError('')
    setEditing(null)
  }

  async function saveSection() {
    if (!edit || !editing) return
    setSaving(true)
    setError('')
    try {
      let patch: Partial<PortDetail> = {}
      if (editing === 'basic') {
        if (!draft.name.trim()) throw new Error('항구(도시) 이름이 필요합니다.')
        patch = {
          name: draft.name,
          category: draft.category,
          region: draft.region,
          seaArea: draft.seaArea,
          coordX: draft.coordX,
          coordY: draft.coordY,
          entryPermit: draft.entryPermit,
          culture: draft.culture,
          language: draft.language,
        }
      } else if (editing === 'description') {
        patch = { description: draft.description }
      } else if (editing === 'rewards') {
        patch = {
          rewards: draft.rewards.filter(
            (r) => r.kind.trim() || r.amount.trim() || r.reward.trim(),
          ),
        }
      } else if (editing === 'collect') {
        patch = {
          collectItems: draft.collectItems.filter(
            (c) => c.items.trim() || c.type || c.rank != null,
          ),
        }
      }
      const res = await updatePort(edit.token, port.id, patch)
      edit.onSaved(res.port)
      edit.onToast?.(`저장 완료 · ${res.port.name}`)
      setEditing(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '항구 저장에 실패했습니다.'
      setError(message)
      edit.onToast?.(message)
    } finally {
      setSaving(false)
    }
  }

  const showRewards = canEdit || port.rewards.length > 0
  const showCollect = canEdit || port.collectItems.length > 0
  const showDescription = canEdit || Boolean(port.description)

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">
            {port.category ? port.category : '항구 · 도시'}
          </span>
        </div>
        <h2>{port.name}</h2>
        {!canEdit && port.description ? <p>{port.description}</p> : null}
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
                <span>지역</span>
                <input
                  value={draft.region || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      region: e.target.value || null,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>해역</span>
                <input
                  value={draft.seaArea || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      seaArea: e.target.value || null,
                    }))
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
                    setDraft((prev) => ({
                      ...prev,
                      coordX: parseOptionalInt(e.target.value),
                    }))
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
                    setDraft((prev) => ({
                      ...prev,
                      coordY: parseOptionalInt(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>입항허가</span>
                <input
                  value={draft.entryPermit || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      entryPermit: e.target.value || null,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>문화</span>
                <input
                  value={draft.culture || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      culture: e.target.value || null,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>언어</span>
                <input
                  value={draft.language || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      language: e.target.value || null,
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
            <Row label="분류" value={port.category} />
            <Row label="지역" value={port.region} />
            <Row label="해역" value={port.seaArea} />
            <Row label="좌표" value={coords} />
            <Row label="입항허가" value={port.entryPermit} />
            <Row label="문화" value={port.culture} />
            <Row label="언어" value={port.language} />
          </div>
        )}
      </section>

      {showRewards && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="보상"
            canEdit={canEdit}
            editing={editing === 'rewards'}
            onEdit={() => startEdit('rewards')}
          />
          {editing === 'rewards' ? (
            <>
              <EditRewards
                rewards={draft.rewards}
                disabled={saving}
                onChange={(rewards) =>
                  setDraft((prev) => ({ ...prev, rewards }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : port.rewards.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>종류</th>
                    <th>금액</th>
                    <th>보상</th>
                  </tr>
                </thead>
                <tbody>
                  {port.rewards.map((row, idx) => (
                    <tr key={`${row.kind}-${idx}`}>
                      <td>{row.kind}</td>
                      <td>{row.amount || '-'}</td>
                      <td>{row.reward || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 보상이 없습니다.</p>
          )}
        </section>
      )}

      {showCollect && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="수집 아이템"
            canEdit={canEdit}
            editing={editing === 'collect'}
            onEdit={() => startEdit('collect')}
          />
          {editing === 'collect' ? (
            <>
              <EditCollect
                items={draft.collectItems}
                disabled={saving}
                onChange={(collectItems) =>
                  setDraft((prev) => ({ ...prev, collectItems }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : port.collectItems.length > 0 ? (
            Object.entries(collectBySource).map(([source, items]) => (
              <div key={source} style={{ marginBottom: '0.85rem' }}>
                <p className="quest-badge" style={{ display: 'inline-block' }}>
                  {source}
                </p>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>랭크</th>
                        <th>종류</th>
                        <th>아이템</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={`${source}-${item.rank}-${idx}`}>
                          <td>{item.rank ?? '-'}</td>
                          <td>{item.type || '-'}</td>
                          <td>{item.items || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            <p className="form-note">등록된 수집 아이템이 없습니다.</p>
          )}
        </section>
      )}

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
            <p>{port.description || '설명이 없습니다.'}</p>
          )}
        </section>
      )}
    </div>
  )
}

function EditRewards({
  rewards,
  onChange,
  disabled,
}: {
  rewards: PortReward[]
  onChange: (rewards: PortReward[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>종류</th>
              <th>금액</th>
              <th>보상</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {rewards.map((row, idx) => (
              <tr key={`reward-${idx}`}>
                <td>
                  <input
                    value={row.kind}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rewards.map((r, i) =>
                          i === idx ? { ...r, kind: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.amount}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rewards.map((r, i) =>
                          i === idx ? { ...r, amount: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.reward}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        rewards.map((r, i) =>
                          i === idx ? { ...r, reward: e.target.value } : r,
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
                    onClick={() => onChange(rewards.filter((_, i) => i !== idx))}
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
          onChange([...rewards, { kind: '', amount: '', reward: '' }])
        }
      >
        추가
      </button>
    </>
  )
}

function EditCollect({
  items,
  onChange,
  disabled,
}: {
  items: PortCollectItem[]
  onChange: (items: PortCollectItem[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>구분</th>
              <th>랭크</th>
              <th>종류</th>
              <th>아이템</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={`collect-${idx}`}>
                <td>
                  <input
                    value={item.source}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx ? { ...c, source: e.target.value } : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(item.rank)}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx
                            ? { ...c, rank: parseOptionalInt(e.target.value) }
                            : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={item.type || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx
                            ? { ...c, type: e.target.value || null }
                            : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={item.items}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx ? { ...c, items: e.target.value } : c,
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
                    onClick={() => onChange(items.filter((_, i) => i !== idx))}
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
            ...items,
            { source: '낚시', rank: null, type: null, items: '' },
          ])
        }
      >
        추가
      </button>
    </>
  )
}
