import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  deleteField,
  fetchFields,
  importFieldText,
} from '../lib/api'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { FieldDetail } from '../types'
import { ConfirmLayer } from './ConfirmLayer'
import { DetailModal } from './DetailModal'
import { FieldDetailView } from './FieldDetailView'
import { SortableTh } from './SortableTh'

type FieldCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
  /** 해시 `#/fields?q=` 검색어 */
  initialQuery?: string
  /** 해시 `#/fields?open=` 상세 자동 오픈 (slug 또는 이름) */
  openKey?: string
  /** 해시 `#/fields?add=1` — 관리자 육지 추가 폼 오픈 */
  initialAdd?: boolean
}

type FieldSortKey = 'name' | 'fieldKind' | 'region' | 'seaArea'

const FIELD_IMPORT_PLACEHOLDER = `필드북미 대륙 동쪽 연안
필드 종류	상륙지	지역	북미 동해안
해역	코드 곶 앞바다	좌표	13086, 2797
연결된 장소 	
종류	내용
2차 필드	나이아가라 강 유역
필드 지도	
육지 조사	
단계	필수	종류	조사 항목	횟수	획득 완성도	완성도 제한
1		조사	거대고목	1	10%	10%
채집		20	10%
발견		1	10%
2		인식	163ac	1	10%	50%
채집		40	10%
3		인식	343ac	1	10%	70%
전투		8	10%
4		인식	491ac	1	20%	90%
조사	평면바위	1	10%
전투		15	10%
5		인식	788ac	1	20%	100%
조사	거목	1	10%
채집		60	20%
육지 재조사 보상	
종류	아이템
소비품	명의의 비약 5, 의뢰 알선서 2
보물지도	큰 꽃의 지도 1, 힘센 새의 지도 1
수집 아이템	
탐색채집조달애완동물
랭크	종류	아이템
1	장비품	여행자의 수기
교역품	돌
3	장비품	나무 창, 명탐험가의 수기
4	장비품	사냥꾼의 창
10	장비품	모카신(탐색)
12	장비품	깃털장식 보닛(탐색)♀
목적지 	
발견물보물지도퀘스트
발견물	내용
[기상 현상] 4 환수평호	[인식] 낮 - 북미 대륙 동쪽 연안 남동쪽 해변 남쪽 끝 (인식 9)
육상 NPC 	
레벨	특징	육상 NPC
희귀 	산적의 수령
35		도적단 Lv35(북미)
38		들도적 Lv38
42		무법 개척자 Lv42`

export function FieldCatalog({
  token,
  isAdmin = false,
  onToast,
  initialQuery = '',
  openKey = '',
  initialAdd = false,
}: FieldCatalogProps) {
  const canAdd = isAdmin
  const [fields, setFields] = useState<FieldDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<FieldDetail | null>(null)
  const [detailEditMode, setDetailEditMode] = useState(false)
  const [query, setQuery] = useState(initialQuery)
  const [showImport, setShowImport] = useState(
    () => Boolean(canAdd && initialAdd),
  )
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [openMiss, setOpenMiss] = useState('')
  const openedKeyRef = useRef('')
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<FieldSortKey>()

  const loadFields = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await fetchFields(token)
      setFields(res.fields)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '육지 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadFields()
  }, [loadFields])

  useEffect(() => {
    if (initialQuery.trim()) setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    if (!canAdd) {
      setShowImport(false)
      return
    }
    if (initialAdd) setShowImport(true)
  }, [canAdd, initialAdd])

  useEffect(() => {
    const key = openKey.trim()
    if (!key || loading) return
    if (openedKeyRef.current === key) return
    openedKeyRef.current = key
    const lower = key.toLowerCase()
    const found = fields.find(
      (f) =>
        f.slug === key ||
        f.name.trim().toLowerCase() === lower ||
        f.name.trim() === key ||
        String(f.id) === key,
    )
    const label = initialQuery.trim() || key
    if (initialQuery.trim()) setQuery(initialQuery.trim())
    if (!found) {
      setOpenMiss(label)
      return
    }
    setOpenMiss('')
    setQuery(initialQuery.trim() || found.name)
    setDetailEditMode(false)
    setDetail(found)
  }, [openKey, loading, fields, initialQuery])

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!canAdd) {
      setImportNote('관리자만 육지를 등록할 수 있습니다.')
      return
    }
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importFieldText(token, importText)
      setImportText('')
      setShowImport(false)
      setImportNote(
        `「${res.field.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast?.(`육지 「${res.field.name}」 저장 완료`)
      await loadFields()
    } catch (err) {
      setImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(field: FieldDetail) {
    if (!window.confirm(`「${field.name}」 육지를 삭제할까요?`)) return
    setDeletingId(field.id)
    try {
      await deleteField(token, field.id)
      setFields((prev) => prev.filter((f) => f.id !== field.id))
      if (detail?.id === field.id) setDetail(null)
      onToast?.(`육지 「${field.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  function applyUpdate(field: FieldDetail) {
    setFields((prev) => prev.map((f) => (f.id === field.id ? field : f)))
    setDetail((prev) => (prev?.id === field.id ? field : prev))
  }

  const filtered = fields.filter((field) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const hay = [field.name, field.fieldKind, field.region, field.seaArea]
      .filter((v) => v != null && v !== '')
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  const rows = sortRows(
    filtered,
    (field, key) => field[key],
    (a, b) => a.id - b.id,
    compareIdDesc,
  )
  const colCount = isAdmin ? 6 : 5

  return (
    <section className="tool-page field-catalog">
      <div className="messages-head">
        <div>
          <h1>육지</h1>
          <p>
            {isAdmin
              ? '위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.'
              : '등록된 육지(필드)를 확인하고 조사·보상을 봅니다.'}
          </p>
        </div>
        {canAdd && (
          <div className="admin-page-actions">
            <button
              type="button"
              className="btn-admin"
              onClick={() => void loadFields()}
              disabled={loading}
            >
              새로고침
            </button>
            <button
              type="button"
              className="btn-admin btn-admin-primary"
              onClick={() => {
                setShowImport((v) => !v)
                setImportNote('')
              }}
            >
              {showImport ? '닫기' : '육지 추가'}
            </button>
          </div>
        )}
      </div>

      {canAdd && showImport && (
        <form className="admin-import-form" onSubmit={handleImport}>
          <label className="field">
            <span>육지 텍스트</span>
            <textarea
              className="quest-import-textarea"
              rows={16}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={FIELD_IMPORT_PLACEHOLDER}
              disabled={importing}
            />
          </label>
          <div className="form-actions">
            <button
              type="submit"
              className="btn-admin btn-admin-primary"
              disabled={importing}
            >
              {importing ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      )}

      {importNote && (
        <p
          className={`form-note${
            /실패|못|오류|에러|중복/.test(importNote) ? ' error' : ''
          }`}
        >
          {importNote}
        </p>
      )}

      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·종류·지역·해역으로 검색"
          aria-label="육지 검색"
          autoComplete="off"
          disabled={loading}
        />
      </label>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      {openMiss ? (
        <ConfirmLayer
          title="확인"
          message={`「${openMiss}」 육지가 없습니다.`}
          onCancel={() => setOpenMiss('')}
          confirmLabel={canAdd ? '등록하러 이동하기' : undefined}
          onConfirm={
            canAdd
              ? () => {
                  setShowImport(true)
                  setQuery(openMiss)
                  setOpenMiss('')
                }
              : undefined
          }
        />
      ) : null}

      {loading ? (
        <p className="form-note">불러오는 중…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <SortableTh
                  label="이름"
                  sortKey="name"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="종류"
                  sortKey="fieldKind"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="지역"
                  sortKey="region"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  className="col-desk"
                  label="해역"
                  sortKey="seaArea"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
                <th className="col-desk">좌표</th>
                {isAdmin ? (
                  <th className="col-desk col-action">삭제</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((field, index) => (
                <tr
                  key={field.id}
                  className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                  tabIndex={0}
                  onClick={() => {
                    setDetailEditMode(false)
                    setDetail(field)
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setDetailEditMode(false)
                      setDetail(field)
                    }
                  }}
                >
                  <td>{field.name}</td>
                  <td className="col-desk">{field.fieldKind || '-'}</td>
                  <td className="col-desk">{field.region || '-'}</td>
                  <td className="col-desk">{field.seaArea || '-'}</td>
                  <td className="col-desk">
                    {field.coordX != null && field.coordY != null
                      ? `${field.coordX}, ${field.coordY}`
                      : '-'}
                  </td>
                  {isAdmin ? (
                    <td
                      className="admin-cell-control col-desk col-action"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="admin-danger-btn"
                        disabled={deletingId === field.id}
                        onClick={() => void handleDelete(field)}
                      >
                        {deletingId === field.id ? '삭제 중…' : '삭제'}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={colCount}>
                    {fields.length === 0
                      ? '등록된 육지가 없습니다.'
                      : '검색 결과가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <DetailModal
          title="육지 상세"
          label={`${detail.name} 상세`}
          onClose={() => {
            setDetail(null)
            setDetailEditMode(false)
          }}
          headerActions={
            isAdmin ? (
              <button
                type="button"
                className={`btn-admin${detailEditMode ? ' btn-admin-primary' : ''}`}
                onClick={() => setDetailEditMode((v) => !v)}
              >
                {detailEditMode ? '수정 종료' : '수정'}
              </button>
            ) : undefined
          }
        >
          <FieldDetailView
            field={detail}
            token={token}
            isAdmin={isAdmin}
            edit={
              isAdmin && detailEditMode
                ? {
                    token,
                    onSaved: applyUpdate,
                    onToast,
                  }
                : undefined
            }
          />
        </DetailModal>
      )}
    </section>
  )
}
