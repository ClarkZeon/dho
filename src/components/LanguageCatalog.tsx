import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchLibraryLanguages } from '../lib/api'
import { useTableSort } from '../lib/tableSort'
import type { LibraryLanguageDetail } from '../types'
import { DetailModal } from './DetailModal'
import { LibraryLanguageDetailView } from './LibraryLanguageDetailView'
import { SortableTh } from './SortableTh'

const PAGE_SIZE = 15

type LanguageCatalogProps = {
  token: string
}

type LanguageSortKey = 'name' | 'rangeScope' | 'learnCost' | 'useCities'

function matchesLanguage(language: LibraryLanguageDetail, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const cities = (language.useCities || [])
    .map((c) => `${c.region} ${c.city}`)
    .join(' ')
  const places = (language.learnPlaces || [])
    .map((p) => `${p.region} ${p.city} ${p.npc || ''}`)
    .join(' ')
  const haystack = [
    language.name,
    language.slug,
    language.description,
    language.category,
    language.rangeScope,
    language.prerequisite,
    cities,
    places,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(q)
}

function useCitiesLabel(language: LibraryLanguageDetail) {
  return language.useCities?.length
    ? language.useCities.map((c) => c.city).join(', ')
    : ''
}

export function LanguageCatalog({ token }: LanguageCatalogProps) {
  const [languages, setLanguages] = useState<LibraryLanguageDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<LibraryLanguageDetail | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<LanguageSortKey>('name')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchLibraryLanguages(token)
        if (!alive) return
        setLanguages(res.languages)
        setPage(0)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '언어 목록을 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const filtered = sortRows(
    languages.filter((language) => matchesLanguage(language, query)),
    (language, key) => {
      switch (key) {
        case 'name':
          return language.name
        case 'rangeScope':
          return language.rangeScope
        case 'learnCost':
          return language.learnCost
        case 'useCities':
          return useCitiesLabel(language)
      }
    },
    (a, b) => a.id - b.id,
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )

  function handleSort(key: LanguageSortKey) {
    toggleSort(key)
    setPage(0)
  }

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>언어</h1>
          <p>등록된 언어 스킬을 확인하고 상세를 엽니다.</p>
        </div>
      </div>

      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
          placeholder="언어 이름·도시·범위로 검색"
          aria-label="언어 검색"
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
                    label="범위"
                    sortKey="rangeScope"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="습득 비용"
                    sortKey="learnCost"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="사용 도시"
                    sortKey="useCities"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((language, index) => (
                  <tr
                    key={language.id}
                    className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                    tabIndex={0}
                    onClick={() => setDetail(language)}
                    onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setDetail(language)
                      }
                    }}
                  >
                    <td>{language.name}</td>
                    <td>{language.rangeScope || '-'}</td>
                    <td>
                      {language.learnCost != null
                        ? `${language.learnCost.toLocaleString('ko-KR')}두캇`
                        : '-'}
                    </td>
                    <td className="admin-table-wrap-cell">
                      {useCitiesLabel(language) || '-'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      {languages.length === 0
                        ? '등록된 언어가 없습니다.'
                        : '검색 결과가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="catalog-pager" aria-label="언어 목록 페이지">
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
                  {query.trim() ? ` (전체 ${languages.length})` : ''}
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
          title="언어 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <LibraryLanguageDetailView language={detail} />
        </DetailModal>
      )}
    </section>
  )
}
