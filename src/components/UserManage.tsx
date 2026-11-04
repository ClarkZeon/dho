import { useCallback, useEffect, useState } from 'react'
import {
  deleteAdminUser,
  fetchAdminUsers,
  updateAdminUserRole,
} from '../lib/api'
import { useTableSort } from '../lib/tableSort'
import type { AdminUser, User } from '../types'
import { SortableTh } from './SortableTh'

const PAGE_SIZE = 15

type UserSortKey = 'username' | 'nickname' | 'role' | 'level' | 'lastLoginAt'

type UserManageProps = {
  user: User
  token: string
  onToast: (message: string) => void
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

export function UserManage({ user, token, onToast }: UserManageProps) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const { sortKey, sortDir, toggleSort, sortRows } =
    useTableSort<UserSortKey>()

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdminUsers(token)
      setUsers(res.users)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '회원 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const queryLower = query.trim().toLowerCase()
  const filtered = users.filter((row) => {
    if (!queryLower) return true
    const haystack = [
      row.username,
      row.nickname,
      row.role,
      row.level,
      row.lastLoginAt,
    ]
      .filter((v) => v != null && v !== '')
      .join(' ')
      .toLowerCase()
    return haystack.includes(queryLower)
  })
  const sorted = sortRows(
    filtered,
    (row, key) => {
      if (key === 'lastLoginAt') return row.lastLoginAt || ''
      return row[key]
    },
    (a, b) => a.username.localeCompare(b.username, 'ko'),
    (a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
  )
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = sorted.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )
  const adminCount = users.filter((u) => u.role === 'admin').length

  useEffect(() => {
    if (page > safePage) setPage(safePage)
  }, [page, safePage])

  async function handleRoleChange(
    target: AdminUser,
    role: 'admin' | 'member',
  ) {
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
    setDeletingId(target.id)
    try {
      await deleteAdminUser(token, target.id)
      setUsers((prev) => prev.filter((u) => u.id !== target.id))
      onToast(`${target.nickname} 계정을 삭제했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  function handleSort(key: UserSortKey) {
    toggleSort(key)
    setPage(0)
  }

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>회원</h1>
          <p>
            역할 변경과 계정 삭제를 처리합니다. 마지막 관리자는 강등·삭제할 수
            없습니다.
          </p>
        </div>
        <div className="admin-page-actions">
          <button
            type="button"
            className="btn-admin"
            onClick={() => void loadUsers()}
            disabled={loading}
          >
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      <label className="field catalog-search">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
          placeholder="아이디·닉네임·역할로 검색"
          aria-label="회원 검색"
          autoComplete="off"
          disabled={loading}
        />
      </label>

      {loading ? (
        <p className="form-note">불러오는 중…</p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <SortableTh
                    label="아이디"
                    sortKey="username"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    className="col-desk"
                    label="닉네임"
                    sortKey="nickname"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    className="col-desk"
                    label="역할"
                    sortKey="role"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    className="col-desk"
                    label="레벨"
                    sortKey="level"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    className="col-desk"
                    label="최근 로그인"
                    sortKey="lastLoginAt"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <th className="col-desk">삭제</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((row) => {
                  const isSelf = row.id === user.id
                  const isLastAdmin = row.role === 'admin' && adminCount <= 1
                  const busy = busyId === row.id
                  const deleting = deletingId === row.id
                  const roleLocked = busy || isLastAdmin
                  const deleteLocked = deleting || isSelf || isLastAdmin
                  const lockHint = isLastAdmin
                    ? '마지막 관리자는 역할을 변경할 수 없습니다.'
                    : isSelf
                      ? '자신의 계정은 삭제할 수 없습니다.'
                      : undefined
                  return (
                    <tr key={row.id}>
                      <td>{row.username}</td>
                      <td className="col-desk">{row.nickname}</td>
                      <td className="col-desk">
                        <select
                          className="admin-control"
                          value={row.role}
                          disabled={roleLocked}
                          title={
                            roleLocked && isLastAdmin ? lockHint : undefined
                          }
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
                      <td className="col-desk">Lv.{row.level}</td>
                      <td className="col-desk">
                        {formatDate(row.lastLoginAt)}
                      </td>
                      <td className="col-desk">
                        <button
                          type="button"
                          className="admin-danger-btn"
                          disabled={deleteLocked}
                          title={deleteLocked ? lockHint : undefined}
                          onClick={() => void handleDelete(row)}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      {users.length === 0
                        ? '등록된 회원이 없습니다.'
                        : '검색 결과가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {sorted.length > 0 && (
            <div className="catalog-pager" aria-label="회원 목록 페이지">
              <button
                type="button"
                className="btn-admin"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                이전
              </button>
              <span>
                {safePage + 1} / {totalPages}
                <em>
                  · {sorted.length}개
                  {query.trim() ? ` (전체 ${users.length})` : ''}
                </em>
              </span>
              <button
                type="button"
                className="btn-admin"
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
    </section>
  )
}
