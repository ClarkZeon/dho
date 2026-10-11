import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchLibraryLanguages } from '../lib/api'
import type { LibraryLanguageDetail } from '../types'
import { DetailModal } from './DetailModal'
import { LibraryLanguageDetailView } from './LibraryLanguageDetailView'

type LanguageCatalogProps = {
  token: string
}

export function LanguageCatalog({ token }: LanguageCatalogProps) {
  const [languages, setLanguages] = useState<LibraryLanguageDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<LibraryLanguageDetail | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchLibraryLanguages(token)
        if (!alive) return
        setLanguages(res.languages)
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

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>언어</h1>
          <p>등록된 언어 스킬을 확인하고 상세를 엽니다.</p>
        </div>
      </div>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="form-note">불러오는 중…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>범위</th>
                <th>습득 비용</th>
                <th>사용 도시</th>
              </tr>
            </thead>
            <tbody>
              {languages.map((language, index) => (
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
                  <td>
                    {language.useCities?.length
                      ? language.useCities.map((c) => c.city).join(', ')
                      : '-'}
                  </td>
                </tr>
              ))}
              {languages.length === 0 && (
                <tr>
                  <td colSpan={4}>등록된 언어가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
