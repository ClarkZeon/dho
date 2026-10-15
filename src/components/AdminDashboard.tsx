import { useEffect, useState } from 'react'
import { fetchAdminStats, fetchBoardPosts } from '../lib/api'
import type { BoardPost } from '../types'

export type AdminDashboardNav =
  | 'users'
  | 'ships'
  | 'quests'
  | 'ports'
  | 'regions'
  | 'entry-permits'
  | 'discoveries'
  | 'skills'
  | 'fields'
  | 'sea-areas'
  | 'materials'
  | 'consumables'
  | 'equipments'
  | 'memorial-albums'

type AdminDashboardProps = {
  token: string
  onNavigate: (nav: AdminDashboardNav) => void
}

type CatalogCounts = {
  users: number
  ships: number
  quests: number
  ports: number
  regions: number
  entryPermits: number
  discoveries: number
  skills: number
  fields: number
  seaAreas: number
  materials: number
  consumables: number
  equipments: number
  memorialAlbums: number
  featureRequests: number
}

function formatShortDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return value.slice(0, 10)
  }
}

function previewBody(body: string, max = 96) {
  const text = String(body || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return '본문 없음'
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function AdminDashboard({ token, onNavigate }: AdminDashboardProps) {
  const [featurePosts, setFeaturePosts] = useState<BoardPost[]>([])
  const [counts, setCounts] = useState<CatalogCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<BoardPost | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const [statsRes, featureRes] = await Promise.all([
          fetchAdminStats(token),
          fetchBoardPosts(token, 'feature', { limit: 8 }),
        ])
        if (!alive) return
        setCounts(statsRes.counts)
        setFeaturePosts(featureRes.posts)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '대시보드를 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const featureTotal = counts?.featureRequests ?? featurePosts.length

  return (
    <section className="admin-section">
      <div className="admin-page-head">
        <div>
          <h1>대시보드</h1>
          <p>기능 요청을 먼저 보고, 등록 현황을 한눈에 확인합니다.</p>
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
        <div className="admin-dash">
          <section
            className="admin-dash-feature"
            aria-labelledby="admin-dash-feature-heading"
          >
            <header className="admin-dash-feature-head">
              <div>
                <h2 id="admin-dash-feature-heading">기능 요청 요약</h2>
                <p>커뮤니티 「기능 요청」 게시판의 최근 글입니다.</p>
              </div>
              <strong className="admin-dash-feature-count">
                총 {featureTotal}건
              </strong>
            </header>

            {featurePosts.length === 0 ? (
              <p className="form-note">아직 등록된 기능 요청이 없습니다.</p>
            ) : (
              <ul className="admin-dash-feature-list">
                {featurePosts.map((post) => (
                  <li key={post.id}>
                    <button
                      type="button"
                      className={`admin-dash-feature-item${selected?.id === post.id ? ' is-open' : ''}`}
                      onClick={() =>
                        setSelected((prev) =>
                          prev?.id === post.id ? null : post,
                        )
                      }
                    >
                      <span className="admin-dash-feature-title">
                        {post.isPinned && (
                          <em className="pin-tag">고정</em>
                        )}
                        {post.title}
                      </span>
                      <span className="admin-dash-feature-meta">
                        {post.author.nickname} · {formatShortDate(post.createdAt)}
                      </span>
                      <span className="admin-dash-feature-preview">
                        {previewBody(post.body)}
                      </span>
                    </button>
                    {selected?.id === post.id && (
                      <div className="admin-dash-feature-body">
                        <p>{post.body || '본문 없음'}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {featureTotal > featurePosts.length && (
              <p className="admin-dash-feature-more">
                최근 {featurePosts.length}건만 표시 · 전체 {featureTotal}건
              </p>
            )}
          </section>

          <section
            className="admin-dash-stats"
            aria-labelledby="admin-dash-stats-heading"
          >
            <h2 id="admin-dash-stats-heading">등록 현황</h2>
            <div className="admin-dash-stat-grid">
              {(
                [
                  ['users', '회원', counts?.users],
                  ['ships', '선박', counts?.ships],
                  ['quests', '퀘스트', counts?.quests],
                  ['ports', '항구', counts?.ports],
                  ['regions', '지역', counts?.regions],
                  ['entry-permits', '입항허가', counts?.entryPermits],
                  ['discoveries', '발견물', counts?.discoveries],
                  ['skills', '스킬', counts?.skills],
                  ['fields', '필드', counts?.fields],
                  ['sea-areas', '해역', counts?.seaAreas],
                  ['materials', '선박 재료', counts?.materials],
                  ['consumables', '소비품', counts?.consumables],
                  ['equipments', '장비품', counts?.equipments],
                  ['memorial-albums', '메모리얼', counts?.memorialAlbums],
                ] as const
              ).map(([nav, label, value]) => (
                <button
                  key={nav}
                  type="button"
                  className="admin-dash-stat"
                  onClick={() => onNavigate(nav)}
                >
                  <span>{label}</span>
                  <strong>{value ?? '-'}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
