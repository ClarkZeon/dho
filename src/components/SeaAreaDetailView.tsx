import { useEffect, useState } from 'react'
import { updateSeaArea } from '../lib/api'
import type {
  SeaAreaCollectItem,
  SeaAreaDetail,
  SeaAreaDestination,
  SeaAreaNpc,
  SeaAreaPlace,
} from '../types'

type SeaAreaDetailViewProps = {
  seaArea: SeaAreaDetail
  /** 관리자: 섹션별 연필로 수정 */
  edit?: {
    token: string
    onSaved: (seaArea: SeaAreaDetail) => void
    onToast?: (text: string) => void
  }
}

type EditSection =
  | 'basic'
  | 'places'
  | 'fishing'
  | 'gathering'
  | 'pets'
  | 'destinations'
  | 'npcs'
  | 'description'

const SEA_CATEGORIES = [
  '북대서양',
  '남대서양',
  '지중해',
  '북해',
  '인도양',
  '북태평양',
  '남태평양',
  '극동',
  '기타',
]

function emptyCollect(source: string): SeaAreaCollectItem {
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

function cloneDetail(seaArea: SeaAreaDetail): SeaAreaDetail {
  return {
    ...seaArea,
    regions: [...(seaArea.regions || [])],
    places: seaArea.places.map((p) => ({ ...p })),
    collectItems: seaArea.collectItems.map((c) => ({ ...c })),
    destinations: seaArea.destinations.map((d) => ({ ...d })),
    seaNpcs: seaArea.seaNpcs.map((n) => ({
      ...n,
      names: [...n.names],
    })),
  }
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

function Row({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  const text =
    value == null || value === ''
      ? '-'
      : typeof value === 'number'
        ? String(value)
        : String(value).trim() || '-'
  return (
    <div>
      <span>{label}</span>
      <strong>{text}</strong>
    </div>
  )
}

function formatBounds(seaArea: Pick<
  SeaAreaDetail,
  'boundNorth' | 'boundWest' | 'boundSouth' | 'boundEast'
>) {
  const parts = [
    seaArea.boundNorth != null ? `북 ${seaArea.boundNorth}` : null,
    seaArea.boundWest != null ? `서 ${seaArea.boundWest}` : null,
    seaArea.boundSouth != null ? `남 ${seaArea.boundSouth}` : null,
    seaArea.boundEast != null ? `동 ${seaArea.boundEast}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : null
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

function SectionHead({
  title,
  canEdit,
  editing,
  onEdit,
}: {
  title: string
  canEdit: boolean
  editing: boolean
  onEdit: () => void
}) {
  return (
    <div className="quest-section-head">
      <h3>{title}</h3>
      {canEdit && !editing ? (
        <button
          type="button"
          className="quest-edit-icon-btn"
          aria-label={`${title} 수정`}
          title={`${title} 수정`}
          onClick={onEdit}
        >
          <PencilIcon />
        </button>
      ) : null}
    </div>
  )
}

function SectionActions({
  busy,
  onCancel,
  onSave,
}: {
  busy: boolean
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="quest-walkthrough-actions">
      <button
        type="button"
        className="admin-btn"
        disabled={busy}
        onClick={onCancel}
      >
        취소
      </button>
      <button
        type="button"
        className="admin-btn admin-btn-primary"
        disabled={busy}
        onClick={onSave}
      >
        {busy ? '저장 중…' : '저장'}
      </button>
    </div>
  )
}

function ReadCollectTable({
  items,
  variant,
}: {
  items: SeaAreaCollectItem[]
  variant: 'fish' | 'gather' | 'pet'
}) {
  if (!items.length) {
    return <p className="form-note">등록된 항목이 없습니다.</p>
  }
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>랭크</th>
            {variant !== 'pet' && <th className="col-desk">종류</th>}
            {variant !== 'pet' && <th className="col-desk">추천 지점</th>}
            {variant === 'fish' && <th className="col-desk">교환</th>}
            {variant === 'fish' && <th className="col-desk">방생</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={`${item.source}-${item.name}-${idx}`}>
              <td>{item.name || '-'}</td>
              <td>{item.rank ?? '-'}</td>
              {variant !== 'pet' && (
                <td className="col-desk">{item.type || '-'}</td>
              )}
              {variant !== 'pet' && (
                <td className="col-desk">{item.recommendSpot || '-'}</td>
              )}
              {variant === 'fish' && (
                <td className="col-desk">{flagLabel(item.canExchange)}</td>
              )}
              {variant === 'fish' && (
                <td className="col-desk">{flagLabel(item.canRelease)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SeaAreaDetailView({ seaArea, edit }: SeaAreaDetailViewProps) {
  const canEdit = Boolean(edit)
  const [editing, setEditing] = useState<EditSection | null>(null)
  const [draft, setDraft] = useState(() => cloneDetail(seaArea))
  const [regionDraft, setRegionDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(cloneDetail(seaArea))
    setRegionDraft('')
    setEditing(null)
    setError('')
  }, [seaArea])

  function startEdit(section: EditSection) {
    setDraft(cloneDetail(seaArea))
    setRegionDraft('')
    setError('')
    setEditing(section)
  }

  function cancelEdit() {
    setDraft(cloneDetail(seaArea))
    setRegionDraft('')
    setError('')
    setEditing(null)
  }

  function patchDraft(partial: Partial<SeaAreaDetail>) {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  function updateCollect(source: string, nextItems: SeaAreaCollectItem[]) {
    setDraft((prev) => ({
      ...prev,
      collectItems: [
        ...prev.collectItems.filter((i) => i.source !== source),
        ...nextItems.map((i) => ({ ...i, source })),
      ],
    }))
  }

  function itemsOf(source: string, from: SeaAreaDetail = seaArea) {
    return from.collectItems.filter((i) => i.source === source)
  }

  async function saveSection() {
    if (!edit || !editing) return
    setSaving(true)
    setError('')
    try {
      let patch: Partial<SeaAreaDetail> = {}
      if (editing === 'basic') {
        if (!draft.name.trim()) throw new Error('해역 이름이 필요합니다.')
        patch = {
          name: draft.name,
          altName: draft.altName,
          category: draft.category,
          regions: draft.regions,
          boundNorth: draft.boundNorth,
          boundWest: draft.boundWest,
          boundSouth: draft.boundSouth,
          boundEast: draft.boundEast,
          wave: draft.wave,
          current: draft.current,
          maxSpeedBonus: draft.maxSpeedBonus,
        }
      } else if (editing === 'description') {
        patch = { description: draft.description }
      } else if (editing === 'places') {
        patch = {
          places: draft.places.filter((p) => p.kind.trim() || p.name.trim()),
        }
      } else if (
        editing === 'fishing' ||
        editing === 'gathering' ||
        editing === 'pets'
      ) {
        const source =
          editing === 'fishing'
            ? '낚시'
            : editing === 'gathering'
              ? '채집'
              : '애완동물'
        patch = {
          collectItems: [
            ...seaArea.collectItems.filter((i) => i.source !== source),
            ...draft.collectItems.filter(
              (i) => i.source === source && i.name.trim(),
            ),
          ],
        }
      } else if (editing === 'destinations') {
        patch = {
          destinations: draft.destinations.filter(
            (d) => d.discovery.trim() || d.content.trim(),
          ),
        }
      } else if (editing === 'npcs') {
        patch = {
          seaNpcs: draft.seaNpcs.filter(
            (n) =>
              n.fleetCount != null ||
              (n.trait && n.trait.trim()) ||
              n.names.length > 0,
          ),
        }
      }

      const res = await updateSeaArea(edit.token, seaArea.id, patch)
      edit.onSaved(res.seaArea)
      edit.onToast?.(`저장 완료 · ${res.seaArea.name}`)
      setEditing(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '해역 저장에 실패했습니다.'
      setError(message)
      edit.onToast?.(message)
    } finally {
      setSaving(false)
    }
  }

  const fishing = itemsOf('낚시')
  const gathering = itemsOf('채집')
  const pets = itemsOf('애완동물')
  const otherCollect = seaArea.collectItems.filter(
    (i) => !['낚시', '채집', '애완동물'].includes(i.source),
  )
  const destBySource = seaArea.destinations.reduce<
    Record<string, typeof seaArea.destinations>
  >((acc, item) => {
    const key = item.source || '보물지도'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  const showPlaces = canEdit || seaArea.places.length > 0
  const showFishing = canEdit || fishing.length > 0
  const showGathering = canEdit || gathering.length > 0
  const showPets = canEdit || pets.length > 0
  const showOtherCollect = canEdit || otherCollect.length > 0
  const showDestinations = canEdit || seaArea.destinations.length > 0
  const showNpcs = canEdit || seaArea.seaNpcs.length > 0
  const showDescription = canEdit || Boolean(seaArea.description)

  return (
    <div className="quest-detail sea-area-edit">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">
            {seaArea.category ? seaArea.category : '해역'}
          </span>
        </div>
        <h2>{seaArea.name}</h2>
        {seaArea.altName ? <p>{seaArea.altName}</p> : null}
        {!canEdit && seaArea.description ? (
          <p>{seaArea.description}</p>
        ) : null}
      </header>

      {error ? (
        <p className="form-note error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="quest-detail-section">
        <SectionHead
          title="기본 정보"
          canEdit={canEdit}
          editing={editing === 'basic'}
          onEdit={() => startEdit('basic')}
        />
        {editing === 'basic' ? (
          <>
            <div className="sea-area-edit-grid">
              <label className="field">
                <span>분류</span>
                <select
                  value={draft.category || ''}
                  onChange={(e) =>
                    patchDraft({ category: e.target.value || null })
                  }
                  disabled={saving}
                >
                  <option value="">선택</option>
                  {SEA_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {draft.category &&
                    !SEA_CATEGORIES.includes(draft.category) && (
                      <option value={draft.category}>{draft.category}</option>
                    )}
                </select>
              </label>
              <label className="field">
                <span>해역</span>
                <input
                  value={draft.name}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                  required
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>추가 이름</span>
                <input
                  value={draft.altName || ''}
                  onChange={(e) =>
                    patchDraft({ altName: e.target.value || null })
                  }
                  disabled={saving}
                />
              </label>
              <div className="field">
                <span>지역</span>
                <div className="sea-area-chip-row">
                  {draft.regions.map((region, idx) => (
                    <span key={`${region}-${idx}`} className="sea-area-chip">
                      {region}
                      <button
                        type="button"
                        aria-label={`${region} 삭제`}
                        disabled={saving}
                        onClick={() =>
                          patchDraft({
                            regions: draft.regions.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="sea-area-inline-add">
                  <input
                    value={regionDraft}
                    onChange={(e) => setRegionDraft(e.target.value)}
                    placeholder="지역 추가"
                    disabled={saving}
                  />
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={saving}
                    onClick={() => {
                      const next = regionDraft.trim()
                      if (!next) return
                      if (draft.regions.includes(next)) {
                        setRegionDraft('')
                        return
                      }
                      patchDraft({ regions: [...draft.regions, next] })
                      setRegionDraft('')
                    }}
                  >
                    추가
                  </button>
                </div>
              </div>
              <label className="field">
                <span>북</span>
                <input
                  inputMode="numeric"
                  value={numOrEmpty(draft.boundNorth)}
                  onChange={(e) =>
                    patchDraft({
                      boundNorth: parseOptionalInt(e.target.value),
                    })
                  }
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>서</span>
                <input
                  inputMode="numeric"
                  value={numOrEmpty(draft.boundWest)}
                  onChange={(e) =>
                    patchDraft({
                      boundWest: parseOptionalInt(e.target.value),
                    })
                  }
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>남</span>
                <input
                  inputMode="numeric"
                  value={numOrEmpty(draft.boundSouth)}
                  onChange={(e) =>
                    patchDraft({
                      boundSouth: parseOptionalInt(e.target.value),
                    })
                  }
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>동</span>
                <input
                  inputMode="numeric"
                  value={numOrEmpty(draft.boundEast)}
                  onChange={(e) =>
                    patchDraft({
                      boundEast: parseOptionalInt(e.target.value),
                    })
                  }
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>파도</span>
                <input
                  inputMode="numeric"
                  value={numOrEmpty(draft.wave)}
                  onChange={(e) =>
                    patchDraft({ wave: parseOptionalInt(e.target.value) })
                  }
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>조류</span>
                <input
                  inputMode="numeric"
                  value={numOrEmpty(draft.current)}
                  onChange={(e) =>
                    patchDraft({ current: parseOptionalInt(e.target.value) })
                  }
                  disabled={saving}
                />
              </label>
              <label className="field">
                <span>최대 속도 증가</span>
                <input
                  value={draft.maxSpeedBonus || ''}
                  onChange={(e) =>
                    patchDraft({ maxSpeedBonus: e.target.value || null })
                  }
                  placeholder="예: 50%"
                  disabled={saving}
                />
              </label>
            </div>
            <SectionActions
              busy={saving}
              onCancel={cancelEdit}
              onSave={() => void saveSection()}
            />
          </>
        ) : (
          <div className="quest-kv-grid">
            <Row label="분류" value={seaArea.category} />
            <Row label="해역" value={seaArea.name} />
            <Row label="추가 이름" value={seaArea.altName} />
            <Row
              label="지역"
              value={
                seaArea.regions?.length
                  ? seaArea.regions.join(', ')
                  : seaArea.region
              }
            />
            <Row label="경계" value={formatBounds(seaArea)} />
            <Row label="파도" value={seaArea.wave} />
            <Row label="조류" value={seaArea.current} />
            <Row label="최대 속도 증가" value={seaArea.maxSpeedBonus} />
          </div>
        )}
      </section>

      {showPlaces && (
        <section className="quest-detail-section">
          <SectionHead
            title="해역 내 장소"
            canEdit={canEdit}
            editing={editing === 'places'}
            onEdit={() => startEdit('places')}
          />
          {editing === 'places' ? (
            <>
              <EditPlaces
                places={draft.places}
                onChange={(places) => patchDraft({ places })}
                disabled={saving}
              />
              <SectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : seaArea.places.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>종류</th>
                    <th>내용</th>
                  </tr>
                </thead>
                <tbody>
                  {seaArea.places.map((place, idx) => (
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

      {showFishing && (
        <section className="quest-detail-section">
          <SectionHead
            title="낚시"
            canEdit={canEdit}
            editing={editing === 'fishing'}
            onEdit={() => startEdit('fishing')}
          />
          {editing === 'fishing' ? (
            <>
              <EditCollectTable
                source="낚시"
                items={itemsOf('낚시', draft)}
                variant="fish"
                onChange={updateCollect}
                disabled={saving}
              />
              <SectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (
            <ReadCollectTable items={fishing} variant="fish" />
          )}
        </section>
      )}

      {showGathering && (
        <section className="quest-detail-section">
          <SectionHead
            title="채집"
            canEdit={canEdit}
            editing={editing === 'gathering'}
            onEdit={() => startEdit('gathering')}
          />
          {editing === 'gathering' ? (
            <>
              <EditCollectTable
                source="채집"
                items={itemsOf('채집', draft)}
                variant="gather"
                onChange={updateCollect}
                disabled={saving}
              />
              <SectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (
            <ReadCollectTable items={gathering} variant="gather" />
          )}
        </section>
      )}

      {showPets && (
        <section className="quest-detail-section">
          <SectionHead
            title="애완동물"
            canEdit={canEdit}
            editing={editing === 'pets'}
            onEdit={() => startEdit('pets')}
          />
          {editing === 'pets' ? (
            <>
              <EditCollectTable
                source="애완동물"
                items={itemsOf('애완동물', draft)}
                variant="pet"
                onChange={updateCollect}
                disabled={saving}
              />
              <SectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (
            <ReadCollectTable items={pets} variant="pet" />
          )}
        </section>
      )}

      {showOtherCollect && (
        <section className="quest-detail-section">
          <h3>기타 수집</h3>
          {otherCollect.length > 0 ? (
            <ReadCollectTable items={otherCollect} variant="gather" />
          ) : (
            <p className="quest-muted">없음</p>
          )}
        </section>
      )}

      {showDestinations && (
        <section className="quest-detail-section">
          <SectionHead
            title="목적지"
            canEdit={canEdit}
            editing={editing === 'destinations'}
            onEdit={() => startEdit('destinations')}
          />
          {editing === 'destinations' ? (
            <>
              <EditDestinations
                destinations={draft.destinations}
                onChange={(destinations) => patchDraft({ destinations })}
                disabled={saving}
              />
              <SectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : seaArea.destinations.length > 0 ? (
            Object.entries(destBySource).map(([source, items]) => (
              <div key={source} style={{ marginBottom: '0.85rem' }}>
                <p className="quest-badge" style={{ display: 'inline-block' }}>
                  {source}
                </p>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>발견물</th>
                        <th>내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={`${source}-${item.discovery}-${idx}`}>
                          <td>{item.discovery || '-'}</td>
                          <td>{item.content || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            <p className="form-note">등록된 목적지가 없습니다.</p>
          )}
        </section>
      )}

      {showNpcs && (
        <section className="quest-detail-section">
          <SectionHead
            title="해상 NPC"
            canEdit={canEdit}
            editing={editing === 'npcs'}
            onEdit={() => startEdit('npcs')}
          />
          {editing === 'npcs' ? (
            <>
              <EditNpcs
                seaNpcs={draft.seaNpcs}
                onChange={(seaNpcs) => patchDraft({ seaNpcs })}
                disabled={saving}
              />
              <SectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : seaArea.seaNpcs.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>함대 수</th>
                    <th>특징</th>
                    <th>해상 NPC</th>
                  </tr>
                </thead>
                <tbody>
                  {seaArea.seaNpcs.map((npc, idx) => (
                    <tr key={`${npc.fleetCount}-${idx}`}>
                      <td>{npc.fleetCount ?? '-'}</td>
                      <td>{npc.trait || '-'}</td>
                      <td>{npc.names.length ? npc.names.join(', ') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 해상 NPC가 없습니다.</p>
          )}
        </section>
      )}

      {showDescription && (
        <section className="quest-detail-section">
          <SectionHead
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
                  onChange={(e) =>
                    patchDraft({ description: e.target.value || null })
                  }
                  placeholder="해역 설명"
                  disabled={saving}
                />
              </label>
              <SectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (
            <p>{seaArea.description || '설명이 없습니다.'}</p>
          )}
        </section>
      )}
    </div>
  )
}

function EditCollectTable({
  source,
  items,
  variant,
  onChange,
  disabled,
}: {
  source: string
  items: SeaAreaCollectItem[]
  variant: 'fish' | 'gather' | 'pet'
  onChange: (source: string, items: SeaAreaCollectItem[]) => void
  disabled?: boolean
}) {
  function setItem(idx: number, partial: Partial<SeaAreaCollectItem>) {
    onChange(
      source,
      items.map((item, i) => (i === idx ? { ...item, ...partial } : item)),
    )
  }

  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>이름</th>
              {variant !== 'pet' && <th>랭크</th>}
              {variant !== 'pet' && <th className="col-desk">종류</th>}
              {variant !== 'pet' && <th className="col-desk">추천 지점</th>}
              {variant === 'fish' && <th className="col-desk">교환</th>}
              {variant === 'fish' && <th className="col-desk">방생</th>}
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={`${source}-${idx}`}>
                <td>
                  <input
                    value={item.name}
                    disabled={disabled}
                    onChange={(e) => setItem(idx, { name: e.target.value })}
                  />
                </td>
                {variant !== 'pet' && (
                  <td>
                    <input
                      inputMode="numeric"
                      value={numOrEmpty(item.rank)}
                      disabled={disabled}
                      onChange={(e) =>
                        setItem(idx, { rank: parseOptionalInt(e.target.value) })
                      }
                    />
                  </td>
                )}
                {variant !== 'pet' && (
                  <td className="col-desk">
                    <input
                      value={item.type || ''}
                      disabled={disabled}
                      onChange={(e) =>
                        setItem(idx, { type: e.target.value || null })
                      }
                    />
                  </td>
                )}
                {variant !== 'pet' && (
                  <td className="col-desk">
                    <input
                      value={item.recommendSpot || ''}
                      disabled={disabled}
                      onChange={(e) =>
                        setItem(idx, {
                          recommendSpot: e.target.value || null,
                        })
                      }
                    />
                  </td>
                )}
                {variant === 'fish' && (
                  <td className="col-desk">
                    <input
                      type="checkbox"
                      checked={item.canExchange === true}
                      disabled={disabled}
                      onChange={(e) =>
                        setItem(idx, { canExchange: e.target.checked })
                      }
                    />
                  </td>
                )}
                {variant === 'fish' && (
                  <td className="col-desk">
                    <input
                      type="checkbox"
                      checked={item.canRelease === true}
                      disabled={disabled}
                      onChange={(e) =>
                        setItem(idx, { canRelease: e.target.checked })
                      }
                    />
                  </td>
                )}
                <td className="col-action">
                  <button
                    type="button"
                    className="admin-danger-btn"
                    disabled={disabled}
                    onClick={() =>
                      onChange(
                        source,
                        items.filter((_, i) => i !== idx),
                      )
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
        onClick={() => onChange(source, [...items, emptyCollect(source)])}
      >
        추가
      </button>
    </>
  )
}

function EditPlaces({
  places,
  onChange,
  disabled,
}: {
  places: SeaAreaPlace[]
  onChange: (places: SeaAreaPlace[]) => void
  disabled?: boolean
}) {
  return (
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
            {places.map((place, idx) => (
              <tr key={`place-${idx}`}>
                <td>
                  <input
                    value={place.kind}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        places.map((p, i) =>
                          i === idx ? { ...p, kind: e.target.value } : p,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={place.name}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        places.map((p, i) =>
                          i === idx ? { ...p, name: e.target.value } : p,
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
                    onClick={() =>
                      onChange(places.filter((_, i) => i !== idx))
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
        onClick={() => onChange([...places, { kind: '', name: '' }])}
      >
        추가
      </button>
    </>
  )
}

function EditDestinations({
  destinations,
  onChange,
  disabled,
}: {
  destinations: SeaAreaDestination[]
  onChange: (destinations: SeaAreaDestination[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>구분</th>
              <th>발견물</th>
              <th>내용</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {destinations.map((item, idx) => (
              <tr key={`dest-${idx}`}>
                <td>
                  <select
                    value={item.source}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        destinations.map((d, i) =>
                          i === idx ? { ...d, source: e.target.value } : d,
                        ),
                      )
                    }
                  >
                    <option value="보물지도">보물지도</option>
                    <option value="퀘스트">퀘스트</option>
                  </select>
                </td>
                <td>
                  <input
                    value={item.discovery}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        destinations.map((d, i) =>
                          i === idx ? { ...d, discovery: e.target.value } : d,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={item.content}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        destinations.map((d, i) =>
                          i === idx ? { ...d, content: e.target.value } : d,
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
                    onClick={() =>
                      onChange(destinations.filter((_, i) => i !== idx))
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
          onChange([
            ...destinations,
            { source: '보물지도', discovery: '', content: '' },
          ])
        }
      >
        추가
      </button>
    </>
  )
}

function EditNpcs({
  seaNpcs,
  onChange,
  disabled,
}: {
  seaNpcs: SeaAreaNpc[]
  onChange: (seaNpcs: SeaAreaNpc[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>함대 수</th>
              <th>특징</th>
              <th>해상 NPC</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {seaNpcs.map((npc, idx) => (
              <tr key={`npc-${idx}`}>
                <td>
                  <input
                    inputMode="numeric"
                    value={numOrEmpty(npc.fleetCount)}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        seaNpcs.map((n, i) =>
                          i === idx
                            ? {
                                ...n,
                                fleetCount: parseOptionalInt(e.target.value),
                              }
                            : n,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={npc.trait || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        seaNpcs.map((n, i) =>
                          i === idx
                            ? { ...n, trait: e.target.value || null }
                            : n,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={npc.names.join(', ')}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        seaNpcs.map((n, i) =>
                          i === idx
                            ? {
                                ...n,
                                names: e.target.value
                                  .split(/[,，]/)
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              }
                            : n,
                        ),
                      )
                    }
                    placeholder="쉼표로 구분"
                  />
                </td>
                <td className="col-action">
                  <button
                    type="button"
                    className="admin-danger-btn"
                    disabled={disabled}
                    onClick={() =>
                      onChange(seaNpcs.filter((_, i) => i !== idx))
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
          onChange([
            ...seaNpcs,
            { fleetCount: null, trait: null, names: [] },
          ])
        }
      >
        추가
      </button>
    </>
  )
}
