import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchSkills } from '../lib/api'
import { compareIdDesc, useTableSort } from '../lib/tableSort'
import type { SkillDetail } from '../types'
import { DetailModal } from './DetailModal'
import { SkillDetailView } from './SkillDetailView'
import { SortableTh } from './SortableTh'

const PAGE_SIZE = 15

type SkillCatalogProps = {
  token: string
}

type SkillSortKey = 'name' | 'category' | 'rangeScope' | 'learnCost' | 'useCities'

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

function useCitiesLabel(skill: SkillDetail) {
  return skill.useCities?.length
    ? skill.useCities.map((c) => c.city).join(', ')
    : ''
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
export function SkillCatalog({ token }: SkillCatalogProps) {
  const [skills, setSkills] = useState<SkillDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<SkillDetail | null>(null)
  const [query, setQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set(),
  )
  const [page, setPage] = useState(0)
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<SkillSortKey>()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchSkills(token)
        if (!alive) return
        setSkills(res.skills)
        setPage(0)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '스킬 목록을 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

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
        case 'useCities':
          return useCitiesLabel(skill)
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

  function handleSort(key: SkillSortKey) {
    toggleSort(key)
    setPage(0)
  }

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>스킬</h1>
          <p>등록된 스킬을 확인하고 상세를 엽니다. 언어는 분류 중 하나입니다.</p>
        </div>
      </div>

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
                  <SortableTh
                    className="col-desk"
                    label="사용 도시"
                    sortKey="useCities"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((skill, index) => (
                  <tr
                    key={skill.id}
                    className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                    tabIndex={0}
                    onClick={() => setDetail(skill)}
                    onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setDetail(skill)
                      }
                    }}
                  >
                    <td>{skill.name}</td>
                    <td className="col-desk">{skillCategory(skill)}</td>
                    <td className="col-desk">{skill.rangeScope || '-'}</td>
                    <td className="col-desk">
                      {skill.learnCost != null
                        ? `${skill.learnCost.toLocaleString('ko-KR')}두캇`
                        : '-'}
                    </td>
                    <td className="admin-table-wrap-cell col-desk">
                      {useCitiesLabel(skill) || '-'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5}>
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
          onClose={() => setDetail(null)}
        >
          <SkillDetailView skill={detail} />
        </DetailModal>
      )}
    </section>
  )
}
