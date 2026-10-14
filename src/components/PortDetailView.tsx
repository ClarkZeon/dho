import { useEffect, useMemo, useState } from 'react'
import { updatePort } from '../lib/api'
import type {
  PortCharacter,
  PortCollectItem,
  PortDestination,
  PortDetail,
  PortLinkedPlace,
  PortProduction,
  PortReward,
  PortSaleItem,
} from '../types'
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

type EditSection =
  | 'basic'
  | 'rewards'
  | 'places'
  | 'characters'
  | 'production'
  | 'destinations'
  | 'sales'
  | 'collect'
  | 'description'

const PORT_CATEGORIES = [
  '동맹항',
  '본거지',
  '공급항',
  '영항',
  '자유 도시',
  '기타',
]

const PORT_FACILITIES = [
  '서고',
  '학교',
  '의뢰 중개인',
  '조합 사무소',
  '길드 사무소',
  '조선소',
  '생산공장',
  '부관',
  '집정관',
]

const PRODUCTION_TABS = [
  '장식품 제작',
  '고정 레시피 책',
  '일반 건조',
  '특수 건조',
]

const DEST_TABS = ['보물지도', '퀘스트']

const SALE_VENDORS = [
  '교역소주인',
  '대장장이',
  '도구점 주인',
  '무기장인',
  '번역가',
  '제재소장인',
  '조각가',
  '조선소주인',
  '판매원',
  '행상인',
]

const COLLECT_SOURCES = ['탐색', '낚시']

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
    rewards: (port.rewards || []).map((r) => ({ ...r })),
    collectItems: (port.collectItems || []).map((c) => ({ ...c })),
    linkedPlaces: (port.linkedPlaces || []).map((p) => ({ ...p })),
    characters: (port.characters || []).map((c) => ({ ...c })),
    productions: (port.productions || []).map((p) => ({ ...p })),
    destinations: (port.destinations || []).map((d) => ({ ...d })),
    saleItems: (port.saleItems || []).map((s) => ({ ...s })),
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

function parseFacilities(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,\uFF0C]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function joinFacilities(list: string[]): string | null {
  const cleaned = list.map((s) => s.trim()).filter(Boolean)
  return cleaned.length ? cleaned.join(', ') : null
}

function flagLabel(value: boolean | null | undefined) {
  if (value === true) return '예'
  if (value === false) return '아니오'
  return '-'
}

function rewardOf(rewards: PortReward[], kind: string): PortReward {
  return (
    rewards.find((r) => r.kind === kind) || {
      kind,
      amount: '',
      reward: '',
    }
  )
}

function setRewardKind(
  rewards: PortReward[],
  kind: string,
  patch: Partial<PortReward>,
): PortReward[] {
  const idx = rewards.findIndex((r) => r.kind === kind)
  if (idx < 0) {
    return [...rewards, { kind, amount: '', reward: '', ...patch }]
  }
  return rewards.map((r, i) => (i === idx ? { ...r, ...patch } : r))
}

export function PortDetailView({ port, edit }: PortDetailViewProps) {
  const canEdit = Boolean(edit)
  const [editing, setEditing] = useState<EditSection | null>(null)
  const [draft, setDraft] = useState(() => clonePort(port))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [prodTab, setProdTab] = useState(PRODUCTION_TABS[0])
  const [destTab, setDestTab] = useState(DEST_TABS[0])
  const [saleTab, setSaleTab] = useState(SALE_VENDORS[0])

  useEffect(() => {
    setDraft(clonePort(port))
    setEditing(null)
    setError('')
  }, [port])

  const coords =
    port.coordX != null && port.coordY != null
      ? `${port.coordX}, ${port.coordY}`
      : null

  const productionTabs = useMemo(() => {
    const fromData = (port.productions || []).map((p) => p.tab)
    return [...new Set([...PRODUCTION_TABS, ...fromData])]
  }, [port.productions])

  const destTabs = useMemo(() => {
    const fromData = (port.destinations || []).map((d) => d.source)
    return [...new Set([...DEST_TABS, ...fromData])]
  }, [port.destinations])

  const saleTabs = useMemo(() => {
    const fromData = (port.saleItems || []).map((s) => s.vendor)
    return [...new Set([...SALE_VENDORS, ...fromData.filter(Boolean)])]
  }, [port.saleItems])

  useEffect(() => {
    if (!productionTabs.includes(prodTab)) setProdTab(productionTabs[0])
  }, [productionTabs, prodTab])

  useEffect(() => {
    if (!destTabs.includes(destTab)) setDestTab(destTabs[0])
  }, [destTabs, destTab])

  useEffect(() => {
    if (!saleTabs.includes(saleTab)) setSaleTab(saleTabs[0] || SALE_VENDORS[0])
  }, [saleTabs, saleTab])

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
          altName: draft.altName,
          category: draft.category,
          region: draft.region,
          seaArea: draft.seaArea,
          coordX: draft.coordX,
          coordY: draft.coordY,
          entryPermit: draft.entryPermit,
          culture: draft.culture,
          language: draft.language,
          facilities: draft.facilities,
          flagQuest: draft.flagQuest,
        }
      } else if (editing === 'description') {
        patch = { description: draft.description }
      } else if (editing === 'rewards') {
        patch = {
          rewards: draft.rewards.filter(
            (r) => r.kind.trim() || r.amount.trim() || r.reward.trim(),
          ),
        }
      } else if (editing === 'places') {
        patch = {
          linkedPlaces: draft.linkedPlaces.filter(
            (p) => p.kind.trim() || p.content.trim(),
          ),
        }
      } else if (editing === 'characters') {
        patch = {
          characters: draft.characters.filter(
            (c) =>
              c.name.trim() ||
              c.preferredReport ||
              c.skills ||
              c.tarot,
          ),
        }
      } else if (editing === 'production') {
        patch = {
          productions: draft.productions.filter(
            (p) => p.maker.trim() || p.items.trim(),
          ),
        }
      } else if (editing === 'destinations') {
        patch = {
          destinations: draft.destinations.filter(
            (d) => d.discovery.trim() || d.content.trim(),
          ),
        }
      } else if (editing === 'sales') {
        patch = {
          saleItems: draft.saleItems.filter(
            (s) => s.item.trim() || s.category.trim() || s.price,
          ),
        }
      } else if (editing === 'collect') {
        patch = {
          collectItems: draft.collectItems.filter(
            (c) => c.name.trim() || c.rank != null || c.recommendSpot,
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

  const showRewards = canEdit || (port.rewards || []).length > 0
  const showPlaces = canEdit || (port.linkedPlaces || []).length > 0
  const showCharacters = canEdit || (port.characters || []).length > 0
  const showProduction = canEdit || (port.productions || []).length > 0
  const showDest = canEdit || (port.destinations || []).length > 0
  const showSales = canEdit || (port.saleItems || []).length > 0
  const showCollect = canEdit || (port.collectItems || []).length > 0
  const showDescription = canEdit || Boolean(port.description)

  const prodRows = (port.productions || []).filter((p) => p.tab === prodTab)
  const destRows = (port.destinations || []).filter((d) => d.source === destTab)
  const saleRows = (port.saleItems || []).filter((s) => s.vendor === saleTab)

  const facilitySet = new Set(parseFacilities(draft.facilities))
  const categoryOptions = port.category && !PORT_CATEGORIES.includes(port.category)
    ? [port.category, ...PORT_CATEGORIES]
    : PORT_CATEGORIES

  return (
    <div className="quest-detail">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">
            {port.category ? port.category : '항구 · 도시'}
          </span>
        </div>
        <h2>
          {port.name}
          {port.altName ? (
            <span className="port-alt-name"> ({port.altName})</span>
          ) : null}
        </h2>
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
            <div className="quest-kv-grid sea-area-edit-grid port-basic-edit">
              <label className="field">
                <span>분류</span>
                <select
                  value={draft.category || ''}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      category: e.target.value || null,
                    }))
                  }
                >
                  <option value="">선택</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>도시</span>
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
              <ClearableField
                label="지역"
                value={draft.region || ''}
                disabled={saving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, region: v || null }))
                }
              />
              <ClearableField
                label="해역"
                value={draft.seaArea || ''}
                disabled={saving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, seaArea: v || null }))
                }
              />
              <label className="field">
                <span>좌표</span>
                <div className="port-coord-pair">
                  <span>X</span>
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
                  <span>Y</span>
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
                </div>
              </label>
              <ClearableField
                label="입항허가"
                value={draft.entryPermit || ''}
                disabled={saving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, entryPermit: v || null }))
                }
              />
              <ClearableField
                label="문화"
                value={draft.culture || ''}
                disabled={saving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, culture: v || null }))
                }
              />
              <ClearableField
                label="언어"
                value={draft.language || ''}
                disabled={saving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, language: v || null }))
                }
              />
              <ClearableField
                label="플래그 퀘스트"
                value={draft.flagQuest || ''}
                disabled={saving}
                onChange={(v) =>
                  setDraft((prev) => ({ ...prev, flagQuest: v || null }))
                }
              />
              <div className="field port-facility-field">
                <span>시설</span>
                <div className="port-facility-grid">
                  {PORT_FACILITIES.map((f) => (
                    <label key={f} className="port-facility-check">
                      <input
                        type="checkbox"
                        checked={facilitySet.has(f)}
                        disabled={saving}
                        onChange={(e) => {
                          const next = new Set(facilitySet)
                          if (e.target.checked) next.add(f)
                          else next.delete(f)
                          setDraft((prev) => ({
                            ...prev,
                            facilities: joinFacilities([...next]),
                          }))
                        }}
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
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
            <Row label="시설" value={port.facilities} />
            {port.flagQuest ? (
              <Row label="플래그 퀘스트" value={port.flagQuest} />
            ) : null}
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
              <EditRewardsForm
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
          ) : (port.rewards || []).length > 0 ? (
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
                  {(port.rewards || []).map((row, idx) => (
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
              <EditLinkedPlaces
                places={draft.linkedPlaces}
                disabled={saving}
                onChange={(linkedPlaces) =>
                  setDraft((prev) => ({ ...prev, linkedPlaces }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (port.linkedPlaces || []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>종류</th>
                    <th>내용</th>
                  </tr>
                </thead>
                <tbody>
                  {(port.linkedPlaces || []).map((row, idx) => (
                    <tr key={`${row.kind}-${idx}`}>
                      <td>{row.kind}</td>
                      <td>{row.content || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 연결 장소가 없습니다.</p>
          )}
        </section>
      )}

      {showCharacters && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="도시 인물"
            canEdit={canEdit}
            editing={editing === 'characters'}
            onEdit={() => startEdit('characters')}
          />
          {editing === 'characters' ? (
            <>
              <EditCharacters
                characters={draft.characters}
                disabled={saving}
                onChange={(characters) =>
                  setDraft((prev) => ({ ...prev, characters }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (port.characters || []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>도시 인물</th>
                    <th>우대 보고</th>
                    <th>스킬</th>
                    <th>타로 카드</th>
                  </tr>
                </thead>
                <tbody>
                  {(port.characters || []).map((row, idx) => (
                    <tr key={`${row.name}-${idx}`}>
                      <td>{row.name}</td>
                      <td>{row.preferredReport || '-'}</td>
                      <td>{row.skills || '-'}</td>
                      <td>{row.tarot || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 도시 인물이 없습니다.</p>
          )}
        </section>
      )}

      {showProduction && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="생산"
            canEdit={canEdit}
            editing={editing === 'production'}
            onEdit={() => startEdit('production')}
          />
          {editing === 'production' ? (
            <>
              <EditProductions
                productions={draft.productions}
                disabled={saving}
                onChange={(productions) =>
                  setDraft((prev) => ({ ...prev, productions }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (port.productions || []).length > 0 ? (
            <>
              <div className="port-subtabs" role="tablist">
                {productionTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    className={tab === prodTab ? 'active' : ''}
                    aria-selected={tab === prodTab}
                    onClick={() => setProdTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {prodRows.length > 0 ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>제작자</th>
                        <th>장식품</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prodRows.map((row, idx) => (
                        <tr key={`${row.maker}-${idx}`}>
                          <td>{row.maker}</td>
                          <td>{row.items || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="form-note">이 탭에 등록된 생산이 없습니다.</p>
              )}
            </>
          ) : (
            <p className="form-note">등록된 생산이 없습니다.</p>
          )}
        </section>
      )}

      {showDest && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="목적지"
            canEdit={canEdit}
            editing={editing === 'destinations'}
            onEdit={() => startEdit('destinations')}
          />
          {editing === 'destinations' ? (
            <>
              <EditDestinations
                destinations={draft.destinations}
                disabled={saving}
                onChange={(destinations) =>
                  setDraft((prev) => ({ ...prev, destinations }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (port.destinations || []).length > 0 ? (
            <>
              <div className="port-subtabs" role="tablist">
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
              {destRows.length > 0 ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>발견물</th>
                        <th>내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {destRows.map((row, idx) => (
                        <tr key={`${row.discovery}-${idx}`}>
                          <td>{row.discovery}</td>
                          <td>{row.content || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="form-note">이 탭에 등록된 목적지가 없습니다.</p>
              )}
            </>
          ) : (
            <p className="form-note">등록된 목적지가 없습니다.</p>
          )}
        </section>
      )}

      {showSales && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="판매 아이템"
            canEdit={canEdit}
            editing={editing === 'sales'}
            onEdit={() => startEdit('sales')}
          />
          {editing === 'sales' ? (
            <>
              <EditSaleItems
                items={draft.saleItems}
                disabled={saving}
                onChange={(saleItems) =>
                  setDraft((prev) => ({ ...prev, saleItems }))
                }
              />
              <DetailSectionActions
                busy={saving}
                onCancel={cancelEdit}
                onSave={() => void saveSection()}
              />
            </>
          ) : (port.saleItems || []).length > 0 ? (
            <>
              <div className="port-subtabs" role="tablist">
                {saleTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    className={tab === saleTab ? 'active' : ''}
                    aria-selected={tab === saleTab}
                    onClick={() => setSaleTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {saleRows.length > 0 ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>분류</th>
                        <th>아이템</th>
                        <th>발전도</th>
                        <th>투자</th>
                        <th>공헌도</th>
                        <th>중심 도시</th>
                        <th>시대</th>
                        <th>가격</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saleRows.map((row, idx) => (
                        <tr key={`${row.item}-${idx}`}>
                          <td>{row.category || '-'}</td>
                          <td>{row.item || '-'}</td>
                          <td>{row.development || '-'}</td>
                          <td>{row.investment || '-'}</td>
                          <td>{row.contribution || '-'}</td>
                          <td>{row.capital || '-'}</td>
                          <td>{row.era || '-'}</td>
                          <td>{row.price || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="form-note">이 상점에 등록된 아이템이 없습니다.</p>
              )}
            </>
          ) : (
            <p className="form-note">등록된 판매 아이템이 없습니다.</p>
          )}
        </section>
      )}

      {showCollect && (
        <section className="quest-detail-section">
          <DetailSectionHead
            title="탐색 · 낚시"
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
          ) : (port.collectItems || []).length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>구분</th>
                    <th>이름</th>
                    <th>랭크</th>
                    <th>추천 지점</th>
                    <th>교환</th>
                    <th>방생</th>
                  </tr>
                </thead>
                <tbody>
                  {(port.collectItems || []).map((item, idx) => (
                    <tr key={`${item.source}-${item.name}-${idx}`}>
                      <td>{item.source}</td>
                      <td>{item.name || '-'}</td>
                      <td>{item.rank ?? '-'}</td>
                      <td>{item.recommendSpot || '-'}</td>
                      <td>{flagLabel(item.canExchange)}</td>
                      <td>{flagLabel(item.canRelease)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="form-note">등록된 탐색·낚시가 없습니다.</p>
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

function ClearableField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="port-clearable">
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="admin-danger-btn"
          disabled={disabled || !value}
          onClick={() => onChange('')}
        >
          삭제
        </button>
      </div>
    </label>
  )
}

function EditRewardsForm({
  rewards,
  onChange,
  disabled,
}: {
  rewards: PortReward[]
  onChange: (rewards: PortReward[]) => void
  disabled?: boolean
}) {
  const invest = rewardOf(rewards, '투자')
  const trade = rewardOf(rewards, '거래')
  return (
    <div className="quest-kv-grid sea-area-edit-grid">
      <ClearableField
        label="투자 보상"
        value={invest.reward}
        disabled={disabled}
        onChange={(v) => onChange(setRewardKind(rewards, '투자', { reward: v }))}
      />
      <label className="field">
        <span>투자</span>
        <div className="port-clearable">
          <input
            value={invest.amount}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                setRewardKind(rewards, '투자', { amount: e.target.value }),
              )
            }
          />
          <span className="port-unit">두캇</span>
        </div>
      </label>
      <ClearableField
        label="거래 보상"
        value={trade.reward}
        disabled={disabled}
        onChange={(v) => onChange(setRewardKind(rewards, '거래', { reward: v }))}
      />
      <label className="field">
        <span>거래</span>
        <div className="port-clearable">
          <input
            value={trade.amount}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                setRewardKind(rewards, '거래', { amount: e.target.value }),
              )
            }
          />
          <span className="port-unit">두캇</span>
        </div>
      </label>
    </div>
  )
}

function EditLinkedPlaces({
  places,
  onChange,
  disabled,
}: {
  places: PortLinkedPlace[]
  onChange: (places: PortLinkedPlace[]) => void
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
            {places.map((row, idx) => (
              <tr key={`place-${idx}`}>
                <td>
                  <input
                    value={row.kind}
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
                    value={row.content}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        places.map((p, i) =>
                          i === idx ? { ...p, content: e.target.value } : p,
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
                    onClick={() => onChange(places.filter((_, i) => i !== idx))}
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
        onClick={() => onChange([...places, { kind: '도시 외곽', content: '' }])}
      >
        추가
      </button>
    </>
  )
}

function EditCharacters({
  characters,
  onChange,
  disabled,
}: {
  characters: PortCharacter[]
  onChange: (characters: PortCharacter[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>도시 인물</th>
              <th>우대 보고</th>
              <th>스킬</th>
              <th>타로 카드</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {characters.map((row, idx) => (
              <tr key={`char-${idx}`}>
                <td>
                  <input
                    value={row.name}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        characters.map((c, i) =>
                          i === idx ? { ...c, name: e.target.value } : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.preferredReport || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        characters.map((c, i) =>
                          i === idx
                            ? { ...c, preferredReport: e.target.value || null }
                            : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.skills || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        characters.map((c, i) =>
                          i === idx
                            ? { ...c, skills: e.target.value || null }
                            : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.tarot || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        characters.map((c, i) =>
                          i === idx
                            ? { ...c, tarot: e.target.value || null }
                            : c,
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
                      onChange(characters.filter((_, i) => i !== idx))
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
            ...characters,
            {
              name: '',
              preferredReport: null,
              skills: null,
              tarot: null,
            },
          ])
        }
      >
        추가
      </button>
    </>
  )
}

function EditProductions({
  productions,
  onChange,
  disabled,
}: {
  productions: PortProduction[]
  onChange: (productions: PortProduction[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>탭</th>
              <th>제작자</th>
              <th>항목</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {productions.map((row, idx) => (
              <tr key={`prod-${idx}`}>
                <td>
                  <select
                    value={row.tab}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        productions.map((p, i) =>
                          i === idx ? { ...p, tab: e.target.value } : p,
                        ),
                      )
                    }
                  >
                    {PRODUCTION_TABS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    {row.tab && !PRODUCTION_TABS.includes(row.tab) ? (
                      <option value={row.tab}>{row.tab}</option>
                    ) : null}
                  </select>
                </td>
                <td>
                  <input
                    value={row.maker}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        productions.map((p, i) =>
                          i === idx ? { ...p, maker: e.target.value } : p,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.items}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        productions.map((p, i) =>
                          i === idx ? { ...p, items: e.target.value } : p,
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
                      onChange(productions.filter((_, i) => i !== idx))
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
            ...productions,
            { tab: PRODUCTION_TABS[0], maker: '', items: '' },
          ])
        }
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
  destinations: PortDestination[]
  onChange: (destinations: PortDestination[]) => void
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
            {destinations.map((row, idx) => (
              <tr key={`dest-${idx}`}>
                <td>
                  <select
                    value={row.source}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        destinations.map((d, i) =>
                          i === idx ? { ...d, source: e.target.value } : d,
                        ),
                      )
                    }
                  >
                    {DEST_TABS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    {row.source && !DEST_TABS.includes(row.source) ? (
                      <option value={row.source}>{row.source}</option>
                    ) : null}
                  </select>
                </td>
                <td>
                  <input
                    value={row.discovery}
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
                    value={row.content}
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
            { source: DEST_TABS[0], discovery: '', content: '' },
          ])
        }
      >
        추가
      </button>
    </>
  )
}

function EditSaleItems({
  items,
  onChange,
  disabled,
}: {
  items: PortSaleItem[]
  onChange: (items: PortSaleItem[]) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>상점</th>
              <th>분류</th>
              <th>아이템</th>
              <th>발전도</th>
              <th>투자</th>
              <th>공헌도</th>
              <th>중심 도시</th>
              <th>시대</th>
              <th>가격</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, idx) => (
              <tr key={`sale-${idx}`}>
                <td>
                  <select
                    value={row.vendor}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((s, i) =>
                          i === idx ? { ...s, vendor: e.target.value } : s,
                        ),
                      )
                    }
                  >
                    {SALE_VENDORS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                    {row.vendor && !SALE_VENDORS.includes(row.vendor) ? (
                      <option value={row.vendor}>{row.vendor}</option>
                    ) : null}
                  </select>
                </td>
                <td>
                  <input
                    value={row.category}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((s, i) =>
                          i === idx ? { ...s, category: e.target.value } : s,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.item}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((s, i) =>
                          i === idx ? { ...s, item: e.target.value } : s,
                        ),
                      )
                    }
                  />
                </td>
                {(
                  [
                    'development',
                    'investment',
                    'contribution',
                    'capital',
                    'era',
                    'price',
                  ] as const
                ).map((key) => (
                  <td key={key}>
                    <input
                      value={row[key] || ''}
                      disabled={disabled}
                      onChange={(e) =>
                        onChange(
                          items.map((s, i) =>
                            i === idx
                              ? { ...s, [key]: e.target.value || null }
                              : s,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
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
            {
              vendor: SALE_VENDORS[0],
              category: '',
              item: '',
              development: null,
              investment: null,
              contribution: null,
              capital: null,
              era: null,
              price: null,
            },
          ])
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
              <th>이름</th>
              <th>랭크</th>
              <th>추천 지점</th>
              <th>교환</th>
              <th>방생</th>
              <th className="col-action">삭제</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={`collect-${idx}`}>
                <td>
                  <select
                    value={item.source}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx ? { ...c, source: e.target.value } : c,
                        ),
                      )
                    }
                  >
                    {COLLECT_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    {item.source && !COLLECT_SOURCES.includes(item.source) ? (
                      <option value={item.source}>{item.source}</option>
                    ) : null}
                  </select>
                </td>
                <td>
                  <input
                    value={item.name}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx ? { ...c, name: e.target.value } : c,
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
                    value={item.recommendSpot || ''}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx
                            ? {
                                ...c,
                                recommendSpot: e.target.value || null,
                              }
                            : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={item.canExchange === true}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx
                            ? { ...c, canExchange: e.target.checked }
                            : c,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={item.canRelease === true}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        items.map((c, i) =>
                          i === idx
                            ? { ...c, canRelease: e.target.checked }
                            : c,
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
      <div className="port-collect-add">
        {COLLECT_SOURCES.map((source) => (
          <button
            key={source}
            type="button"
            className="admin-btn"
            disabled={disabled}
            onClick={() =>
              onChange([
                ...items,
                {
                  source,
                  name: '',
                  rank: null,
                  type: null,
                  recommendSpot: null,
                  canExchange: source === '낚시' ? false : null,
                  canRelease: source === '낚시' ? false : null,
                },
              ])
            }
          >
            {source} 추가
          </button>
        ))}
      </div>
    </>
  )
}
