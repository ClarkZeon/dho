import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  deleteAdminUser,
  fetchAdminUsers,
  importShipText,
  updateAdminUserRole,
} from '../lib/api'
import type { AdminUser, User } from '../types'

type AdminTab = 'users' | 'ships'

type AdminPanelProps = {
  user: User
  token: string
  onLogout: () => void
  onToast: (text: string) => void
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

export function AdminPanel({ user, token, onLogout, onToast }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    setUsersError('')
    try {
      const res = await fetchAdminUsers(token)
      setUsers(res.users)
    } catch (err) {
      setUsersError(
        err instanceof Error ? err.message : '회원 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingUsers(false)
    }
  }, [token])

  useEffect(() => {
    if (tab === 'users') void loadUsers()
  }, [tab, loadUsers])

  async function handleRoleChange(target: AdminUser, role: 'admin' | 'member') {
    if (target.role === role) return
    setBusyId(target.id)
    try {
      const res = await updateAdminUserRole(token, target.id, role)
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? res.user : u)),
      )
      onToast(`${target.nickname} 역할을 ${role}(으)로 변경했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '역할 변경에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(target: AdminUser) {
    if (
      !window.confirm(
        `「${target.nickname}」(${target.username}) 계정을 삭제할까요?`,
      )
    ) {
      return
    }
    setBusyId(target.id)
    try {
      await deleteAdminUser(token, target.id)
      setUsers((prev) => prev.filter((u) => u.id !== target.id))
      onToast(`${target.nickname} 계정을 삭제했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importShipText(token, importText)
      setImportText('')
      setImportNote(`「${res.ship.name}」을(를) 등록했습니다.`)
      onToast(`선박 「${res.ship.name}」 등록 완료`)
    } catch (err) {
      setImportNote(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setImporting(false)
    }
  }

  const adminCount = users.filter((u) => u.role === 'admin').length

  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <div>
          <p className="admin-brand">
            DHO <em>Light</em> · 관리자
          </p>
          <p className="admin-user">
            {user.nickname} ({user.username})
          </p>
        </div>
        <div className="admin-topbar-actions">
          <a className="messages-write-btn" href="/">
            사이트로
          </a>
          <button type="button" className="messages-write-btn" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </header>

      <main className="admin-main">
        <div className="messages-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'users'}
            className={tab === 'users' ? 'active' : ''}
            onClick={() => setTab('users')}
          >
            회원
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ships'}
            className={tab === 'ships' ? 'active' : ''}
            onClick={() => setTab('ships')}
          >
            선박 등록
          </button>
        </div>

        {tab === 'users' && (
          <section className="admin-section">
            <div className="messages-head">
              <div>
                <h1>회원 관리</h1>
                <p>역할 변경과 계정 삭제를 처리합니다.</p>
              </div>
              <button
                type="button"
                className="messages-write-btn"
                onClick={() => void loadUsers()}
                disabled={loadingUsers}
              >
                새로고침
              </button>
            </div>

            {usersError && (
              <p className="form-note error" role="alert">
                {usersError}
              </p>
            )}

            {loadingUsers ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>아이디</th>
                      <th>닉네임</th>
                      <th>역할</th>
                      <th>레벨</th>
                      <th>최근 로그인</th>
                      <th>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((row) => {
                      const isSelf = row.id === user.id
                      const isLastAdmin = row.role === 'admin' && adminCount <= 1
                      const busy = busyId === row.id
                      return (
                        <tr key={row.id}>
                          <td>{row.username}</td>
                          <td>{row.nickname}</td>
                          <td>
                            <select
                              value={row.role}
                              disabled={busy || isSelf || isLastAdmin}
                              onChange={(e) =>
                                void handleRoleChange(
                                  row,
                                  e.target.value === 'admin' ? 'admin' : 'member',
                                )
                              }
                            >
                              <option value="member">member</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td>Lv.{row.level}</td>
                          <td>{formatDate(row.lastLoginAt)}</td>
                          <td>
                            <button
                              type="button"
                              className="admin-danger-btn"
                              disabled={busy || isSelf || isLastAdmin}
                              onClick={() => void handleDelete(row)}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === 'ships' && (
          <section className="admin-section">
            <div className="messages-head">
              <div>
                <h1>선박 등록</h1>
                <p>위키형 선박 텍스트를 붙여넣어 Neon에 등록합니다.</p>
              </div>
            </div>

            <form className="message-compose ship-import-form" onSubmit={handleImport}>
              <label className="field">
                <span>선박 텍스트</span>
                <textarea
                  rows={16}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="위키 등에서 복사한 선박 정보를 붙여넣으세요."
                  disabled={importing}
                />
              </label>
              <div className="form-actions">
                <button
                  type="submit"
                  className="messages-write-btn"
                  disabled={importing}
                >
                  {importing ? '등록 중…' : '등록'}
                </button>
              </div>
              {importNote && (
                <p
                  className={`form-note${
                    /실패|못|오류|에러/.test(importNote) ? ' error' : ''
                  }`}
                >
                  {importNote}
                </p>
              )}
            </form>
          </section>
        )}
      </main>
    </div>
  )
}

export function AdminForbidden() {
  return (
    <div className="admin-page admin-forbidden">
      <header className="admin-topbar">
        <p className="admin-brand">
          DHO <em>Light</em> · 관리자
        </p>
      </header>
      <main className="admin-main">
        <section className="admin-section">
          <h1>접근 권한이 없습니다</h1>
          <p>관리자만 `/admin`에 들어갈 수 있습니다.</p>
          <a className="messages-write-btn" href="/">
            메인으로
          </a>
        </section>
      </main>
    </div>
  )
}
