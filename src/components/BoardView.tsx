import { useEffect, useState, type FormEvent } from 'react'
import {
  createBoardPost,
  fetchBoardPost,
  fetchBoardPosts,
} from '../lib/api'
import type { BoardPost, BoardSummary, User } from '../types'

type BoardViewProps = {
  token: string
  user: User
  boardId: string
  initialPostId?: string
  onToast: (message: string) => void
  /** 상세 URL의 글이 없을 때 목록 해시로 되돌림 */
  onClearPostId?: () => void
}

type Mode = 'list' | 'detail' | 'write'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function BoardView({
  token,
  user,
  boardId,
  initialPostId,
  onToast,
  onClearPostId,
}: BoardViewProps) {
  const [mode, setMode] = useState<Mode>('list')
  const [board, setBoard] = useState<BoardSummary | null>(null)
  const [posts, setPosts] = useState<BoardPost[]>([])
  const [selected, setSelected] = useState<BoardPost | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function openDetail(postId: string, fallback?: BoardPost | null) {
    setLoading(true)
    setError('')
    try {
      const res = await fetchBoardPost(token, boardId, postId)
      setBoard(res.board)
      setSelected(res.post)
      setMode('detail')
    } catch (err) {
      if (fallback) {
        setSelected(fallback)
        setMode('detail')
        return
      }
      setMode('list')
      setSelected(null)
      onClearPostId?.()
      setError(err instanceof Error ? err.message : '게시글을 열지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetchBoardPosts(token, boardId)
        if (!alive) return
        setBoard(res.board)
        setPosts(res.posts)

        if (!initialPostId) {
          setMode('list')
          setSelected(null)
          return
        }

        const local = res.posts.find((p) => p.id === initialPostId) || null
        if (!local) {
          setMode('list')
          setSelected(null)
          onClearPostId?.()
          return
        }

        await openDetail(initialPostId, local)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error ? err.message : '게시글을 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token, boardId, initialPostId])

  async function handleWrite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await createBoardPost(token, boardId, {
        title,
        body,
        isPinned: user.role === 'admin' ? isPinned : false,
      })
      onToast('게시글을 등록했습니다.')
      setTitle('')
      setBody('')
      setIsPinned(false)
      const list = await fetchBoardPosts(token, boardId)
      setBoard(list.board)
      setPosts(list.posts)
      setSelected(res.post)
      setMode('detail')
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="board-view">
      <div className="messages-head">
        <div>
          <h1>{board?.title || '게시판'}</h1>
          <p>{board?.description || ''}</p>
        </div>
        {board?.canWrite && mode === 'list' && (
          <button
            type="button"
            className="messages-write-btn"
            onClick={() => {
              setMode('write')
              setError('')
            }}
          >
            글쓰기
          </button>
        )}
      </div>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      {mode === 'list' && (
        <div className="messages-list-wrap">
          {loading && posts.length === 0 ? (
            <p className="board-empty">불러오는 중…</p>
          ) : posts.length === 0 ? (
            <p className="board-empty">아직 게시글이 없습니다.</p>
          ) : (
            <ul className="messages-list">
              {posts.map((post) => (
                <li key={post.id}>
                  <button
                    type="button"
                    className="messages-row"
                    onClick={() => openDetail(post.id)}
                  >
                    <span className="messages-row-title">
                      {post.isPinned && <em className="pin-tag">공지</em>}
                      {post.title}
                    </span>
                    <span className="messages-row-meta">
                      {post.author.nickname} · {formatDate(post.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {mode === 'detail' && selected && (
        <article className="post-detail">
          <div className="post-detail-toolbar">
            <button
              type="button"
              className="post-back-btn"
              onClick={() => {
                setMode('list')
                setSelected(null)
                setError('')
                onClearPostId?.()
              }}
            >
              ← 목록으로
            </button>
            {board && <span className="post-board-chip">{board.title}</span>}
          </div>

          <header className="post-detail-hero">
            {selected.isPinned && <em className="pin-tag large">고정 공지</em>}
            <h2>{selected.title}</h2>
            <div className="post-detail-meta">
              <span className="post-author-avatar" aria-hidden="true">
                {selected.author.nickname.slice(0, 1)}
              </span>
              <div className="post-detail-meta-text">
                <strong>{selected.author.nickname}</strong>
                <span>
                  {formatDate(selected.createdAt)}
                  {selected.updatedAt !== selected.createdAt
                    ? ` · 수정 ${formatDate(selected.updatedAt)}`
                    : ''}
                </span>
              </div>
            </div>
          </header>

          <div className="post-detail-body">
            <div className="post-body">{selected.body}</div>
          </div>
        </article>
      )}

      {mode === 'write' && (
        <form className="message-compose" onSubmit={handleWrite}>
          <label className="field">
            <span className="field-label">제목</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              disabled={loading}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">내용</span>
            <textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="내용을 입력하세요"
              disabled={loading}
              required
            />
          </label>
          {user.role === 'admin' && (
            <label className="check">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                disabled={loading}
              />
              <span>상단 고정</span>
            </label>
          )}
          <div className="message-actions">
            <button
              type="button"
              className="text-link"
              onClick={() => setMode('list')}
              disabled={loading}
            >
              취소
            </button>
            <button type="submit" className="submit-btn compact" disabled={loading}>
              {loading ? '등록 중…' : '등록'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
