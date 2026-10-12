import { useEffect, useState } from 'react'
import { updateConsumable } from '../lib/api'
import type { ConsumableDetail } from '../types'

type ConsumableDetailViewProps = {
  consumable: ConsumableDetail
  basicInfoEdit?: {
    token: string
    onSaved: (consumable: ConsumableDetail) => void
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

function PencilIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function methodsToText(methods: string[]) {
  return methods.length ? methods.join(' · ') : ''
}

export function ConsumableDetailView({
  consumable,
  basicInfoEdit,
}: ConsumableDetailViewProps) {
  const canEdit = Boolean(basicInfoEdit)
  const [editing, setEditing] = useState(false)
  const [categoryDraft, setCategoryDraft] = useState(consumable.category || '')
  const [useEffectDraft, setUseEffectDraft] = useState(
    consumable.useEffect || '',
  )
  const [methodsDraft, setMethodsDraft] = useState(
    methodsToText(consumable.acquireMethods),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setEditing(false)
    setCategoryDraft(consumable.category || '')
    setUseEffectDraft(consumable.useEffect || '')
    setMethodsDraft(methodsToText(consumable.acquireMethods))
    setError('')
  }, [
    consumable.id,
    consumable.category,
    consumable.useEffect,
    methodsToText(consumable.acquireMethods),
  ])

  function startEdit() {
    setCategoryDraft(consumable.category || '')
    setUseEffectDraft(consumable.useEffect || '')
    setMethodsDraft(methodsToText(consumable.acquireMethods))
    setError('')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setCategoryDraft(consumable.category || '')
    setUseEffectDraft(consumable.useEffect || '')
    setMethodsDraft(methodsToText(consumable.acquireMethods))
    setError('')
  }

  async function saveBasicInfo() {
    if (!basicInfoEdit) return
    setBusy(true)
    setError('')
    try {
      const res = await updateConsumable(
        basicInfoEdit.token,
        consumable.id,
        {
          category: categoryDraft,
          useEffect: useEffectDraft,
          acquireMethods: methodsDraft,
        },
      )
      basicInfoEdit.onSaved(res.consumable)
      setEditing(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '기본 정보 저장에 실패했습니다.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">소비품</span>
        </div>
        <h2>{consumable.name}</h2>
        {consumable.description ? <p>{consumable.description}</p> : null}
      </header>

      <section className="quest-detail-section">
        <div className="quest-section-head">
          <h3>기본 정보</h3>
          {canEdit && !editing ? (
            <button
              type="button"
              className="quest-edit-icon-btn"
              aria-label="기본 정보 수정"
              title="기본 정보 수정"
              onClick={startEdit}
            >
              <PencilIcon />
            </button>
          ) : null}
        </div>
        {editing ? (
          <div className="quest-kv-grid">
            <label className="field">
              <span>분류</span>
              <input
                type="text"
                value={categoryDraft}
                onChange={(e) => setCategoryDraft(e.target.value)}
                disabled={busy}
                aria-label="분류"
              />
            </label>
            <label className="field">
              <span>사용효과</span>
              <input
                type="text"
                value={useEffectDraft}
                onChange={(e) => setUseEffectDraft(e.target.value)}
                disabled={busy}
                aria-label="사용효과"
              />
            </label>
            <label className="field quest-kv-wide">
              <span>획득 방법</span>
              <input
                type="text"
                value={methodsDraft}
                onChange={(e) => setMethodsDraft(e.target.value)}
                disabled={busy}
                aria-label="획득 방법"
                placeholder="구입 · 생산 · 퀘스트"
              />
            </label>
            {error ? (
              <p className="form-note error quest-kv-wide" role="alert">
                {error}
              </p>
            ) : null}
            <div className="quest-walkthrough-actions quest-kv-wide">
              <button
                type="button"
                className="admin-btn"
                disabled={busy}
                onClick={cancelEdit}
              >
                취소
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                disabled={busy}
                onClick={() => void saveBasicInfo()}
              >
                {busy ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          <div className="quest-kv-grid">
            <Row label="분류" value={consumable.category} />
            <Row label="사용효과" value={consumable.useEffect} />
            <div className="quest-kv-wide">
              <span>획득 방법</span>
              <strong>
                {consumable.acquireMethods.length
                  ? consumable.acquireMethods.join(' · ')
                  : '-'}
              </strong>
            </div>
          </div>
        )}
      </section>

      {consumable.purchases.length > 0 ? (
        <section className="quest-detail-section">
          <h3>구입</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>판매 NPC</th>
                  <th>지역</th>
                  <th>장소</th>
                </tr>
              </thead>
              <tbody>
                {consumable.purchases.map((row, idx) => (
                  <tr
                    key={`${row.npc}-${row.region}-${idx}`}
                    className={idx % 2 === 0 ? 'is-even' : 'is-odd'}
                  >
                    <td>{row.npc || '-'}</td>
                    <td>{row.region || '-'}</td>
                    <td>{row.place || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
