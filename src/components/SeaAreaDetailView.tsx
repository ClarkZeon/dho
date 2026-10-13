import { useEffect, useState, type FormEvent } from 'react'
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
  /** 관리자: 상세에서 직접 수정 */
  edit?: {
    token: string
    onSaved: (seaArea: SeaAreaDetail) => void
    onToast?: (text: string) => void
  }
}

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

function formatBounds(seaArea: SeaAreaDetail) {
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

function ReadCollectSection({
  title,
  items,
  variant,
}: {
  title: string
  items: SeaAreaCollectItem[]
  variant: 'fish' | 'gather' | 'pet'
}) {
  if (!items.length) return null
  return (
    <section className="quest-detail-section">
      <h3>{title}</h3>
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
              <tr key={`${title}-${item.name}-${idx}`}>
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
    </section>
  )
}

export function SeaAreaDetailView({ seaArea, edit }: SeaAreaDetailViewProps) {
  const canEdit = Boolean(edit)
  const [draft, setDraft] = useState(() => cloneDetail(seaArea))
  const [regionDraft, setRegionDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveNote, setSaveNote] = useState('')

  useEffect(() => {
    setDraft(cloneDetail(seaArea))
    setRegionDraft('')
    setError('')
    setSaveNote('')
  }, [seaArea])

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

  function itemsOf(source: string) {
    return draft.collectItems.filter((i) => i.source === source)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!edit) return
    setSaving(true)
    setError('')
    setSaveNote('')
    try {
      const res = await updateSeaArea(edit.token, seaArea.id, {
        name: draft.name,
        altName: draft.altName,
        description: draft.description,
        category: draft.category,
        regions: draft.regions,
        boundNorth: draft.boundNorth,
        boundWest: draft.boundWest,
        boundSouth: draft.boundSouth,
        boundEast: draft.boundEast,
        wave: draft.wave,
        current: draft.current,
        maxSpeedBonus: draft.maxSpeedBonus,
        places: draft.places,
        collectItems: draft.collectItems.filter((i) => i.name.trim()),
        destinations: draft.destinations,
        seaNpcs: draft.seaNpcs,
      })
      edit.onSaved(res.seaArea)
      const note = `저장 완료 · ${res.seaArea.name}`
      setSaveNote(note)
      edit.onToast?.(note)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '해역 저장에 실패했습니다.'
      setError(message)
      edit.onToast?.(message)
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) {
    const fishing = seaArea.collectItems.filter((i) => i.source === '낚시')
    const gathering = seaArea.collectItems.filter((i) => i.source === '채집')
    const pets = seaArea.collectItems.filter((i) => i.source === '애완동물')
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

    return (
      <div className="quest-detail">
        <header className="quest-detail-hero">
          <div className="quest-detail-hero-top">
            <span className="quest-badge">
              {seaArea.category ? seaArea.category : '해역'}
            </span>
          </div>
          <h2>{seaArea.name}</h2>
          {seaArea.altName ? <p>{seaArea.altName}</p> : null}
          {seaArea.description ? <p>{seaArea.description}</p> : null}
        </header>

        <section className="quest-detail-section">
          <h3>기본 정보</h3>
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
        </section>

        {seaArea.places.length > 0 && (
          <section className="quest-detail-section">
            <h3>해역 내 장소</h3>
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
          </section>
        )}

        <ReadCollectSection title="낚시" items={fishing} variant="fish" />
        <ReadCollectSection title="채집" items={gathering} variant="gather" />
        <ReadCollectSection title="애완동물" items={pets} variant="pet" />
        <ReadCollectSection
          title="기타 수집"
          items={otherCollect}
          variant="gather"
        />

        {seaArea.destinations.length > 0 && (
          <section className="quest-detail-section">
            <h3>목적지</h3>
            {Object.entries(destBySource).map(([source, items]) => (
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
            ))}
          </section>
        )}

        {seaArea.seaNpcs.length > 0 && (
          <section className="quest-detail-section">
            <h3>해상 NPC</h3>
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
          </section>
        )}
      </div>
    )
  }

  const fishing = itemsOf('낚시')
  const gathering = itemsOf('채집')
  const pets = itemsOf('애완동물')

  return (
    <form className="quest-detail sea-area-edit" onSubmit={handleSave}>
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">해역 수정</span>
        </div>
        <h2>{draft.name || seaArea.name}</h2>
      </header>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}
      {saveNote && <p className="form-note">{saveNote}</p>}

      <section className="quest-detail-section">
        <h3>기본 정보</h3>
        <div className="sea-area-edit-grid">
          <label className="field">
            <span>분류</span>
            <select
              value={draft.category || ''}
              onChange={(e) =>
                patchDraft({ category: e.target.value || null })
              }
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
            />
          </label>
          <label className="field">
            <span>추가 이름</span>
            <input
              value={draft.altName || ''}
              onChange={(e) =>
                patchDraft({ altName: e.target.value || null })
              }
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
              />
              <button
                type="button"
                className="admin-btn"
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
                patchDraft({ boundNorth: parseOptionalInt(e.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>서</span>
            <input
              inputMode="numeric"
              value={numOrEmpty(draft.boundWest)}
              onChange={(e) =>
                patchDraft({ boundWest: parseOptionalInt(e.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>남</span>
            <input
              inputMode="numeric"
              value={numOrEmpty(draft.boundSouth)}
              onChange={(e) =>
                patchDraft({ boundSouth: parseOptionalInt(e.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>동</span>
            <input
              inputMode="numeric"
              value={numOrEmpty(draft.boundEast)}
              onChange={(e) =>
                patchDraft({ boundEast: parseOptionalInt(e.target.value) })
              }
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
            />
          </label>
        </div>
      </section>

      <EditCollectSection
        title="낚시"
        source="낚시"
        items={fishing}
        variant="fish"
        onChange={updateCollect}
      />
      <EditCollectSection
        title="채집"
        source="채집"
        items={gathering}
        variant="gather"
        onChange={updateCollect}
      />
      <EditCollectSection
        title="애완동물"
        source="애완동물"
        items={pets}
        variant="pet"
        onChange={updateCollect}
      />

      <section className="quest-detail-section">
        <h3>해역 내 장소</h3>
        <EditPlaces
          places={draft.places}
          onChange={(places) => patchDraft({ places })}
        />
      </section>

      <section className="quest-detail-section">
        <h3>목적지</h3>
        <EditDestinations
          destinations={draft.destinations}
          onChange={(destinations) => patchDraft({ destinations })}
        />
      </section>

      <section className="quest-detail-section">
        <h3>해상 NPC</h3>
        <EditNpcs
          seaNpcs={draft.seaNpcs}
          onChange={(seaNpcs) => patchDraft({ seaNpcs })}
        />
      </section>

      <section className="quest-detail-section">
        <h3>설명</h3>
        <label className="field">
          <textarea
            rows={4}
            value={draft.description || ''}
            onChange={(e) =>
              patchDraft({ description: e.target.value || null })
            }
            placeholder="해역 설명"
          />
        </label>
      </section>

      <div className="form-actions">
        <button
          type="submit"
          className="admin-btn admin-btn-primary"
          disabled={saving || !draft.name.trim()}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  )
}

function EditCollectSection({
  title,
  source,
  items,
  variant,
  onChange,
}: {
  title: string
  source: string
  items: SeaAreaCollectItem[]
  variant: 'fish' | 'gather' | 'pet'
  onChange: (source: string, items: SeaAreaCollectItem[]) => void
}) {
  function setItem(idx: number, partial: Partial<SeaAreaCollectItem>) {
    onChange(
      source,
      items.map((item, i) => (i === idx ? { ...item, ...partial } : item)),
    )
  }

  return (
    <section className="quest-detail-section">
      <h3>{title}</h3>
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
                    onChange={(e) => setItem(idx, { name: e.target.value })}
                  />
                </td>
                {variant !== 'pet' && (
                  <td>
                    <input
                      inputMode="numeric"
                      value={numOrEmpty(item.rank)}
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
        onClick={() => onChange(source, [...items, emptyCollect(source)])}
      >
        추가
      </button>
    </section>
  )
}

function EditPlaces({
  places,
  onChange,
}: {
  places: SeaAreaPlace[]
  onChange: (places: SeaAreaPlace[]) => void
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
}: {
  destinations: SeaAreaDestination[]
  onChange: (destinations: SeaAreaDestination[]) => void
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
}: {
  seaNpcs: SeaAreaNpc[]
  onChange: (seaNpcs: SeaAreaNpc[]) => void
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
