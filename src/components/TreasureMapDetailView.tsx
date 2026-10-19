import { useEffect, useState } from 'react'
import { updateTreasureMap } from '../lib/api'
import type { TreasureMapDetail } from '../types'
import {
  DetailSectionActions,
  DetailSectionHead,
} from './DetailSectionHead'

type TreasureMapDetailViewProps = {
  map: TreasureMapDetail
  edit?: {
    token: string
    onSaved: (map: TreasureMapDetail) => void
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

function discoveryLabel(row: TreasureMapDetail['discoveries'][number]) {
  const cat = row.category ? `[${row.category}]` : ''
  const rank = row.rank != null ? String(row.rank) : ''
  return [cat, rank, row.name].filter(Boolean).join(' ')
}

function skillLabel(row: TreasureMapDetail['skillReqs'][number]) {
  return row.rank != null ? `${row.name} ${row.rank}` : row.name
}

function destinationLabel(map: TreasureMapDetail) {
  if (map.destinationCity && map.destination) {
    return `${map.destinationCity} → ${map.destination}`
  }
  return map.destination || map.destinationCity
}

function rewardExp(map: TreasureMapDetail) {
  const parts = []
  if (map.discoveryExp != null) parts.push(`발견 경험치 : ${map.discoveryExp}`)
  if (map.cardExp != null) parts.push(`카드 획득 경험치 : ${map.cardExp}`)
  return parts.join(', ')
}

export function TreasureMapDetailView({
  map,
  edit,
}: TreasureMapDetailViewProps) {
  const canEdit = Boolean(edit)
  const [editing, setEditing] = useState<'basic' | 'walk' | null>(null)
  const [draft, setDraft] = useState(map)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(map)
    setEditing(null)
    setError('')
  }, [map])

  async function save() {
    if (!edit) return
    setSaving(true)
    setError('')
    try {
      const res = await updateTreasureMap(edit.token, map.id, {
        altName: draft.altName,
        description: draft.description,
        category: draft.category,
        academicField: draft.academicField,
        destinationCity: draft.destinationCity,
        destination: draft.destination,
        libraries: draft.libraries,
        walkthrough: draft.walkthrough,
      })
      edit.onSaved(res.treasureMap)
      edit.onToast?.(`저장 완료 · ${res.treasureMap.name}`)
      setEditing(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '지도 저장에 실패했습니다.'
      setError(message)
      edit.onToast?.(message)
    } finally {
      setSaving(false)
    }
  }

  const showNeed = canEdit || map.skillReqs.length > 0
  const showReward =
    canEdit ||
    map.discoveryExp != null ||
    map.cardExp != null ||
    map.ducat != null ||
    map.rewardItems.length > 0
  const showLinked = canEdit || map.linkedQuests.length > 0
  const showWalk = canEdit || Boolean(map.walkthrough?.trim())

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">{map.mapKind || '보물지도'}</span>
          {map.category ? (
            <span className="quest-badge">{map.category}</span>
          ) : null}
        </div>
        <h2>{map.name}</h2>
        {map.description ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{map.description}</p>
        ) : canEdit ? (
          <p className="quest-muted">설명 없음</p>
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
          onEdit={() => {
            setDraft(map)
            setEditing('basic')
          }}
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
              <span>서고</span>
              <input
                value={(draft.libraries || []).join(', ')}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    libraries: e.target.value
                      .split(/[,，]/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </label>
            <label className="field">
              <span>학문 분야</span>
              <input
                value={draft.academicField || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    academicField: e.target.value || null,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>목적지 도시</span>
              <input
                value={draft.destinationCity || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    destinationCity: e.target.value || null,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>목적지</span>
              <input
                value={draft.destination || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    destination: e.target.value || null,
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
                onCancel={() => {
                  setDraft(map)
                  setEditing(null)
                }}
                onSave={() => void save()}
              />
            </div>
          </div>
        ) : (
          <div className="quest-kv-grid">
            <Row label="분류" value={map.category} hideEmpty={!canEdit} />
            <Row
              label="서고"
              value={map.libraries.length ? map.libraries.join(', ') : null}
              hideEmpty={!canEdit}
            />
            <Row
              label="학문 분야"
              value={map.academicField}
              hideEmpty={!canEdit}
            />
            <Row
              label="목적지"
              value={destinationLabel(map)}
              hideEmpty={!canEdit}
            />
            <Row
              label="발견물"
              value={
                map.discoveries.length
                  ? map.discoveries.map(discoveryLabel).join('\n')
                  : null
              }
              hideEmpty={!canEdit}
            />
          </div>
        )}
      </section>

      {showNeed && (
        <section className="quest-detail-section">
          <h3>필요</h3>
          {map.skillReqs.length > 0 ? (
            <div className="quest-kv-grid">
              <div className="quest-kv-wide">
                <span>스킬</span>
                <strong>{map.skillReqs.map(skillLabel).join(', ')}</strong>
              </div>
            </div>
          ) : (
            <p className="quest-muted">없음</p>
          )}
        </section>
      )}

      {showReward && (
        <section className="quest-detail-section">
          <h3>보상</h3>
          <div className="quest-kv-grid">
            <Row label="경험치" value={rewardExp(map) || null} hideEmpty={!canEdit} />
            <Row
              label="두캇"
              value={map.ducat != null ? String(map.ducat) : null}
              hideEmpty={!canEdit}
            />
            <Row
              label="아이템"
              value={
                map.rewardItems.length
                  ? map.rewardItems
                      .map((item) =>
                        item.count != null
                          ? `${item.name} ${item.count}`
                          : item.name,
                      )
                      .join(', ')
                  : null
              }
              hideEmpty={!canEdit}
            />
          </div>
        </section>
      )}

      {showLinked && (
        <section className="quest-detail-section">
          <h3>연결 지도/퀘스트</h3>
          {map.linkedQuests.length > 0 ? (
            <ol className="quest-chain is-linked">
              {map.linkedQuests.map((item, index) => (
                <li key={`${item.raw}-${index}`}>
                  <strong>
                    {item.tag ? `[${item.tag}] ${item.title}` : item.title}
                  </strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="quest-muted">없음</p>
          )}
        </section>
      )}

      {showWalk && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="공략"
            canEdit={canEdit}
            editing={editing === 'walk'}
            onEdit={() => {
              setDraft(map)
              setEditing('walk')
            }}
          />
          {editing === 'walk' ? (
            <>
              <textarea
                rows={6}
                value={draft.walkthrough || ''}
                disabled={saving}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    walkthrough: e.target.value || null,
                  }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={() => {
                  setDraft(map)
                  setEditing(null)
                }}
                onSave={() => void save()}
              />
            </>
          ) : map.walkthrough?.trim() ? (
            <p style={{ whiteSpace: 'pre-wrap' }}>{map.walkthrough}</p>
          ) : (
            <p className="quest-muted">없음</p>
          )}
        </section>
      )}
    </div>
  )
}
