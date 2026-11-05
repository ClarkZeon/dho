import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  deleteSkill,
  fetchSkills,
  importSkillText,
} from '../lib/api'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { SkillDetail } from '../types'
import { ConfirmLayer } from './ConfirmLayer'
import { DetailModal } from './DetailModal'
import { DucatAmount } from './DucatAmount'
import { SkillDetailView } from './SkillDetailView'
import { SortableTh } from './SortableTh'

const PAGE_SIZE = 15

type SkillCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
  /** 해시 `#/skills?q=` 검색어 */
  initialQuery?: string
  /** 해시 `#/skills?open=` 상세 자동 오픈 (slug 또는 이름) */
  openKey?: string
  /** 해시 `#/skills?add=1` — 관리자 스킬 추가 폼 오픈 */
  initialAdd?: boolean
}

type SkillSortKey = 'name' | 'category' | 'rangeScope' | 'learnCost'

function matchesSkill(skill: SkillDetail, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const cities = (skill.useCities || [])
    .map((c) => `${c.region} ${c.city}`)
    .join(' ')
  const places = (skill.learnPlaces || [])
    .map((p) => `${p.region} ${p.city} ${p.npc || ''}`)
    .join(' ')
  const haystack = [
    skill.name,
    skill.slug,
    skill.description,
    skill.category,
    skill.officerDuty,
    skill.rangeScope,
    skill.refineEffect,
    skill.prerequisite,
    (skill.preferredJobs || []).join(' '),
    (skill.acquireConditions || [])
      .map((c) => `${c.kind} ${c.content}`)
      .join(' '),
    cities,
    places,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(q)
}

function skillCategory(skill: SkillDetail) {
  return String(skill.category || '').trim() || '언어'
}

function collectCategories(skills: SkillDetail[]) {
  const set = new Set<string>()
  for (const skill of skills) set.add(skillCategory(skill))
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'))
}

function matchesSkillCategory(skill: SkillDetail, categories: Set<string>) {
  if (categories.size === 0) return true
  return categories.has(skillCategory(skill))
}

/** 유저 사이트 스킬 목록 (분류: 언어 등) */
export function SkillCatalog({
  token,
  isAdmin = false,
  onToast,
  initialQuery = '',
  openKey = '',
  initialAdd = false,
}: SkillCatalogProps) {
  const [skills, setSkills] = useState<SkillDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<SkillDetail | null>(null)
  const [detailEditMode, setDetailEditMode] = useState(false)
  const [query, setQuery] = useState(initialQuery)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set(),
  )
  const [page, setPage] = useState(0)
  const canAdd = isAdmin
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
    useTableSort<SkillSortKey>()

  const loadSkills = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchSkills(token)
      setSkills(res.skills)
      setPage(0)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '스킬 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadSkills()
  }, [loadSkills])

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
    const found = skills.find(
      (s) =>
        s.slug === key ||
        s.name.trim().toLowerCase() === lower ||
        s.name.trim() === key,
    )
    const label = initialQuery.trim() || key
    if (initialQuery.trim()) setQuery(initialQuery.trim())
    if (!found) {
      setOpenMiss(label)
      return
    }
    setOpenMiss('')
    setQuery(initialQuery.trim() || found.name)
    setPage(0)
    setDetailEditMode(false)
    setDetail(found)
  }, [openKey, loading, skills, initialQuery])

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!canAdd) {
      setImportNote('관리자만 스킬을 등록할 수 있습니다.')
      setShowImport(false)
      return
    }
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importSkillText(token, importText)
      setImportText('')
      setShowImport(false)
      setImportNote(
        `「${res.skill.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast?.(`스킬 「${res.skill.name}」 저장 완료`)
      await loadSkills()
    } catch (err) {
      setImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(skill: SkillDetail) {
    if (!window.confirm(`「${skill.name}」 스킬을 삭제할까요?`)) return
    setDeletingId(skill.id)
    try {
      await deleteSkill(token, skill.id)
      setSkills((prev) => prev.filter((s) => s.id !== skill.id))
      if (detail?.id === skill.id) setDetail(null)
      onToast?.(`스킬 「${skill.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  const categories = collectCategories(skills)

  const filtered = sortRows(
    skills.filter(
      (skill) =>
        matchesSkillCategory(skill, selectedCategories) &&
        matchesSkill(skill, query),
    ),
    (skill, key) => {
      switch (key) {
        case 'name':
          return skill.name
        case 'category':
          return skillCategory(skill)
        case 'rangeScope':
          return skill.rangeScope
        case 'learnCost':
          return skill.learnCost
      }
    },
    (a, b) => a.id - b.id,
    compareIdDesc,
  )

  function toggleCategory(category: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
    setPage(0)
  }
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )
  const colCount = 4 + (isAdmin ? 1 : 0)

  function handleSort(key: SkillSortKey) {
    toggleSort(key)
    setPage(0)
  }

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>스킬</h1>
          <p>
            {isAdmin
              ? '위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.'
              : '등록된 스킬을 확인하고 상세를 엽니다. 언어는 분류 중 하나입니다.'}
          </p>
        </div>
        {canAdd && (
          <div className="admin-page-actions">
            <button
              type="button"
              className="btn-admin"
              onClick={() => void loadSkills()}
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
              {showImport ? '닫기' : '스킬 추가'}
            </button>
          </div>
        )}
      </div>

      {canAdd && showImport && (
        <form className="admin-import-form" onSubmit={handleImport}>
          <label className="field">
            <span>스킬 텍스트</span>
            <textarea
              className="quest-import-textarea"
              rows={16}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`스킬생태 조사\n동식물의 생태를 연구하고 발견한다.\n\n분류\t모험\t부관담당\t감시\n행동력\t5\t범위\t자신\n습득 비용\t3,000두캇\t연성 효과\t발견 시 피로 회복\n우대 직업\t궁정 정원사*, 레인저, 바이킹, 브리더, 사냥꾼*, 생물학자\n습득 조건\n종류\t내용\n레벨\t모험 Lv3\n스킬 습득\n지역\t도시\t도시 인물\n유럽 북부\t런던\t모험가 조합 마스터`}
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

      {!loading && categories.length > 0 && (
        <div
          className="material-list-kinds catalog-category-filters"
          role="group"
          aria-label="분류 필터"
        >
          <span className="material-list-tag">분류</span>
          {categories.map((category) => (
            <label key={category} className="material-list-check">
              <input
                type="checkbox"
                checked={selectedCategories.has(category)}
                onChange={() => toggleCategory(category)}
              />
              <span>{category}</span>
            </label>
          ))}
        </div>
      )}

      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
          placeholder="이름·도시·범위로 검색"
          aria-label="스킬 검색"
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
          message={`「${openMiss}」 스킬이 없습니다.`}
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
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <SortableTh
                    label="이름"
                    sortKey="name"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    className="col-desk"
                    label="분류"
                    sortKey="category"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    className="col-desk"
                    label="범위"
                    sortKey="rangeScope"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    className="col-desk"
                    label="습득 비용"
                    sortKey="learnCost"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  {isAdmin && <th className="col-desk col-action">삭제</th>}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((skill, index) => (
                  <tr
                    key={skill.id}
                    className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                    tabIndex={0}
                    onClick={() => {
                      setDetailEditMode(false)
                      setDetail(skill)
                    }}
                    onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setDetailEditMode(false)
                        setDetail(skill)
                      }
                    }}
                  >
                    <td>{skill.name}</td>
                    <td className="col-desk">{skillCategory(skill)}</td>
                    <td className="col-desk">{skill.rangeScope || '-'}</td>
                    <td className="col-desk">
                      {skill.learnCost != null
                        ? <DucatAmount value={skill.learnCost} />
                        : '-'}
                    </td>
                    {isAdmin && (
                      <td
                        className="col-desk col-action admin-cell-control"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="btn-admin"
                          disabled={deletingId === skill.id}
                          onClick={() => void handleDelete(skill)}
                        >
                          {deletingId === skill.id ? '삭제 중…' : '삭제'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={colCount}>
                      {skills.length === 0
                        ? '등록된 스킬이 없습니다.'
                        : '검색 결과가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="catalog-pager" aria-label="스킬 목록 페이지">
              <button
                type="button"
                className="admin-btn"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                이전
              </button>
              <span>
                {safePage + 1} / {totalPages}
                <em>
                  · {filtered.length}개
                  {query.trim() || selectedCategories.size > 0
                    ? ` (전체 ${skills.length})`
                    : ''}
                </em>
              </span>
              <button
                type="button"
                className="admin-btn"
                disabled={safePage >= totalPages - 1}
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
              >
                다음
              </button>
            </div>
          )}
        </>
      )}

      {detail && (
        <DetailModal
          title="스킬 상세"
          label={`${detail.name} 상세`}
          onClose={() => {
            setDetail(null)
            setDetailEditMode(false)
          }}
          headerActions={
            isAdmin ? (
              <div
                className="detail-mode-toggle"
                role="group"
                aria-label="상세 모드"
              >
                <button
                  type="button"
                  className={!detailEditMode ? 'active' : ''}
                  aria-pressed={!detailEditMode}
                  onClick={() => setDetailEditMode(false)}
                >
                  사용자 모드
                </button>
                <button
                  type="button"
                  className={detailEditMode ? 'active' : ''}
                  aria-pressed={detailEditMode}
                  onClick={() => setDetailEditMode(true)}
                >
                  수정 모드
                </button>
              </div>
            ) : undefined
          }
        >
          <SkillDetailView
            skill={detail}
            token={token}
            isAdmin={isAdmin}
            editMode={detailEditMode}
            edit={
              isAdmin
                ? {
                    token,
                    onSaved: (skill) => {
                      setSkills((prev) =>
                        prev.map((s) => (s.id === skill.id ? skill : s)),
                      )
                      setDetail(skill)
                    },
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
