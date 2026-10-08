import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  fetchInbox,
  fetchMessage,
  fetchSent,
  replyMessage,
  searchUsers,
  sendMessage,
} from '../lib/api'
import type { MessageItem, User } from '../types'

type Tab = 'inbox' | 'sent' | 'compose'
type View =
  | { mode: 'list' }
  | { mode: 'detail'; id: string }
  | { mode: 'compose'; replyTo?: MessageItem }

type MessagesProps = {
  token: string
  user: User
  onToast: (message: string) => void
  onUnreadChange: (count: number) => void
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function Messages({ token, user, onToast, onUnreadChange }: MessagesProps) {
  const [tab, setTab] = useState<Tab>('inbox')
  const [view, setView] = useState<View>({ mode: 'list' })
  const [inbox, setInbox] = useState<MessageItem[]>([])
  const [sent, setSent] = useState<MessageItem[]>([])
  const [thread, setThread] = useState<MessageItem[]>([])
  const [selected, setSelected] = useState<MessageItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [suggestions, setSuggestions] = useState<
    Array<Pick<User, 'id' | 'username' | 'nickname' | 'level'>>
  >([])

  const list = tab === 'sent' ? sent : inbox

  const unreadInList = useMemo(
    () => inbox.filter((m) => !m.isRead).length,
    [inbox],
  )

  async function refreshLists() {
    const [inboxRes, sentRes] = await Promise.all([
      fetchInbox(token),
      fetchSent(token),
    ])
    setInbox(inboxRes.messages)
    setSent(sentRes.messages)
    const unread = inboxRes.messages.filter((m) => !m.isRead).length
    onUnreadChange(unread)
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        await refreshLists()
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : '쪽지를 불러오지 못했습니다.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  useEffect(() => {
    if (view.mode !== 'compose' || view.replyTo) return
    if (to.trim().length < 1) {
      setSuggestions([])
      return
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await searchUsers(token, to.trim())
        setSuggestions(res.users)
      } catch {
        setSuggestions([])
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [to, token, view])

  function openCompose(replyTo?: MessageItem) {
    setError('')
    setReplyBody('')
    if (replyTo) {
      setTo(replyTo.from.id === user.id ? replyTo.to.nickname : replyTo.from.nickname)
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`)
      setBody('')
      setView({ mode: 'compose', replyTo })
      setTab('compose')
      return
    }
    setTo('')
    setSubject('')
    setBody('')
    setSuggestions([])
    setView({ mode: 'compose' })
    setTab('compose')
  }

  async function openDetail(id: string) {
    try {
      setLoading(true)
      setError('')
      const res = await fetchMessage(token, id)
      setSelected(res.message)
      setThread(res.thread)
      setView({ mode: 'detail', id })
      await refreshLists()
    } catch (err) {
      setError(err instanceof Error ? err.message : '쪽지를 열지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setLoading(true)
      setError('')
      if (view.mode === 'compose' && view.replyTo) {
        await replyMessage(token, view.replyTo.id, body)
        onToast('답장을 보냈습니다.')
      } else {
        await sendMessage(token, { to, subject, body })
        onToast('쪽지를 보냈습니다.')
      }
      await refreshLists()
      setTab('sent')
      setView({ mode: 'list' })
      setTo('')
      setSubject('')
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '쪽지를 보내지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    try {
      setLoading(true)
      setError('')
      const res = await replyMessage(token, selected.id, replyBody)
      onToast('답장을 보냈습니다.')
      setReplyBody('')
      await openDetail(res.message.id)
      await refreshLists()
    } catch (err) {
      setError(err instanceof Error ? err.message : '답장을 보내지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="messages">
      <div className="messages-head">
        <div>
          <h1>쪽지함</h1>
          <p>유저끼리 쪽지를 보내고 답장할 수 있습니다.</p>
        </div>
        <button type="button" className="messages-write-btn" onClick={() => openCompose()}>
          쪽지 쓰기
        </button>
      </div>

      <div className="messages-tabs" role="tablist">
        <button
          type="button"
          className={tab === 'inbox' && view.mode === 'list' ? 'active' : ''}
          onClick={() => {
            setTab('inbox')
            setView({ mode: 'list' })
          }}
        >
          받은쪽지{unreadInList > 0 ? ` (${unreadInList})` : ''}
        </button>
        <button
          type="button"
          className={tab === 'sent' && view.mode === 'list' ? 'active' : ''}
          onClick={() => {
            setTab('sent')
            setView({ mode: 'list' })
          }}
        >
          보낸쪽지
        </button>
        <button
          type="button"
          className={tab === 'compose' || view.mode === 'compose' ? 'active' : ''}
          onClick={() => openCompose()}
        >
          쓰기
        </button>
      </div>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      {view.mode === 'list' && (
        <div className="messages-list-wrap">
          {loading && list.length === 0 ? (
            <p className="board-empty">불러오는 중…</p>
          ) : list.length === 0 ? (
            <p className="board-empty">쪽지가 없습니다.</p>
          ) : (
            <ul className="messages-list">
              {list.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`messages-row ${item.isRead ? '' : 'unread'}`}
                    onClick={() => openDetail(item.id)}
                  >
                    <span className="messages-row-title">{item.subject}</span>
                    <span className="messages-row-meta">
                      {tab === 'inbox' ? item.from.nickname : item.to.nickname}
                      {' · '}
                      {formatDate(item.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {view.mode === 'detail' && selected && (
        <div className="message-detail">
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setView({ mode: 'list' })
              setSelected(null)
            }}
          >
            ← 목록
          </button>

          <header className="message-detail-head">
            <h2>{selected.subject}</h2>
            <p>
              {selected.from.nickname} → {selected.to.nickname}
              {' · '}
              {formatDate(selected.createdAt)}
            </p>
          </header>

          <div className="message-thread">
            {thread.map((item) => (
              <article key={item.id} className="message-bubble">
                <header>
                  <strong>{item.from.nickname}</strong>
                  <span>{formatDate(item.createdAt)}</span>
                </header>
                <p>{item.body}</p>
              </article>
            ))}
          </div>

          <form className="message-reply" onSubmit={handleReply}>
            <label className="field">
              <span className="field-label">답장</span>
              <textarea
                rows={4}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="답장 내용을 입력하세요"
                disabled={loading}
                required
              />
            </label>
            <div className="message-actions">
              <button
                type="button"
                className="text-link"
                onClick={() => openCompose(selected)}
                disabled={loading}
              >
                새 창으로 답장
              </button>
              <button type="submit" className="submit-btn compact" disabled={loading}>
                {loading ? '보내는 중…' : '답장 보내기'}
              </button>
            </div>
          </form>
        </div>
      )}

      {view.mode === 'compose' && (
        <form className="message-compose" onSubmit={handleSend}>
          <label className="field">
            <span className="field-label">받는 사람</span>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="닉네임 또는 아이디"
              disabled={loading || Boolean(view.replyTo)}
              required
            />
            {suggestions.length > 0 && !view.replyTo && (
              <ul className="user-suggest">
                {suggestions.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTo(item.nickname)
                        setSuggestions([])
                      }}
                    >
                      {item.nickname}
                      <span>@{item.username} · Lv.{item.level}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </label>

          <label className="field">
            <span className="field-label">제목</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="제목"
              disabled={loading || Boolean(view.replyTo)}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">내용</span>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="내용을 입력하세요"
              disabled={loading}
              required
            />
          </label>

          <div className="message-actions">
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setTab('inbox')
                setView({ mode: 'list' })
              }}
              disabled={loading}
            >
              취소
            </button>
            <button type="submit" className="submit-btn compact" disabled={loading}>
              {loading ? '보내는 중…' : view.replyTo ? '답장 보내기' : '보내기'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
