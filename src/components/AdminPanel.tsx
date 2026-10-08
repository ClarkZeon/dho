import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  deleteAdminUser,
  fetchAdminUsers,
  fetchQuests,
  fetchShips,
  importQuestText,
  importShipText,
  updateAdminUserRole,
} from '../lib/api'
import type { AdminUser, QuestDetail, ShipDetail, User } from '../types'
import { QuestDetailView } from './QuestDetailView'
import { ShipDetailView } from './ShipDetailView'

type AdminNav = 'users' | 'ships' | 'quests'

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
  const [nav, setNav] = useState<AdminNav>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [ships, setShips] = useState<ShipDetail[]>([])
  const [loadingShips, setLoadingShips] = useState(false)
  const [shipsError, setShipsError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const [detailShip, setDetailShip] = useState<ShipDetail | null>(null)

  const [quests, setQuests] = useState<QuestDetail[]>([])
  const [loadingQuests, setLoadingQuests] = useState(false)
  const [questsError, setQuestsError] = useState('')
  const [showQuestImport, setShowQuestImport] = useState(false)
  const [questImportText, setQuestImportText] = useState('')
  const [importingQuest, setImportingQuest] = useState(false)
  const [questImportNote, setQuestImportNote] = useState('')
  const [detailQuest, setDetailQuest] = useState<QuestDetail | null>(null)

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

  const loadShips = useCallback(async () => {
    setLoadingShips(true)
    setShipsError('')
    try {
      const res = await fetchShips(token)
      setShips(res.ships)
    } catch (err) {
      setShipsError(
        err instanceof Error ? err.message : '선박 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingShips(false)
    }
  }, [token])

  const loadQuests = useCallback(async () => {
    setLoadingQuests(true)
    setQuestsError('')
    try {
      const res = await fetchQuests(token)
      setQuests(res.quests)
    } catch (err) {
      setQuestsError(
        err instanceof Error ? err.message : '퀘스트 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingQuests(false)
    }
  }, [token])

  useEffect(() => {
    if (nav === 'users') void loadUsers()
    if (nav === 'ships') void loadShips()
    if (nav === 'quests') void loadQuests()
  }, [nav, loadUsers, loadShips, loadQuests])

  const detailOpen = Boolean(detailShip || detailQuest)

  useEffect(() => {
    if (!detailOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setDetailShip(null)
        setDetailQuest(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [detailOpen])

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
      setShowImport(false)
      setImportNote(`「${res.ship.name}」을(를) 등록했습니다.`)
      onToast(`선박 「${res.ship.name}」 등록 완료`)
      await loadShips()
    } catch (err) {
      setImportNote(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setImporting(false)
    }
  }

  async function handleQuestImport(e: FormEvent) {
    e.preventDefault()
    if (!questImportText.trim()) {
      setQuestImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImportingQuest(true)
    setQuestImportNote('')
    try {
      const res = await importQuestText(token, questImportText)
      setQuestImportText('')
      setShowQuestImport(false)
      setQuestImportNote(
        `「${res.quest.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast(`퀘스트 「${res.quest.name}」 저장 완료`)
      await loadQuests()
    } catch (err) {
      setQuestImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImportingQuest(false)
    }
  }

  const adminCount = users.filter((u) => u.role === 'admin').length

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-glow" aria-hidden="true" />

        <div className="admin-sidebar-brand">
          <p className="admin-sidebar-mark">
            DHO <em>Light</em>
          </p>
          <p className="admin-sidebar-sub">관리자 콘솔</p>
        </div>

        <nav className="admin-sidebar-nav" aria-label="관리 메뉴">
          <p className="admin-sidebar-label">메뉴</p>
          <button
            type="button"
            className={nav === 'users' ? 'active' : ''}
            onClick={() => setNav('users')}
          >
            <span className="admin-nav-index">01</span>
            <span className="admin-nav-text">회원 리스트</span>
          </button>
          <button
            type="button"
            className={nav === 'ships' ? 'active' : ''}
            onClick={() => setNav('ships')}
          >
            <span className="admin-nav-index">02</span>
            <span className="admin-nav-text">선박 리스트</span>
          </button>
          <button
            type="button"
            className={nav === 'quests' ? 'active' : ''}
            onClick={() => setNav('quests')}
          >
            <span className="admin-nav-index">03</span>
            <span className="admin-nav-text">퀘스트 리스트</span>
          </button>
        </nav>

        <div className="admin-sidebar-foot">
          <div className="admin-sidebar-who">
            <span className="admin-sidebar-who-label">접속 중</span>
            <strong>{user.nickname}</strong>
            <span>{user.username}</span>
          </div>
          <div className="admin-sidebar-foot-actions">
            <a href="/">사이트로</a>
            <button type="button" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      <div className="admin-workspace">
        {nav === 'users' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>회원 리스트</h1>
                <p>
                  역할 변경과 계정 삭제를 처리합니다. 마지막 관리자는 강등·삭제할 수
                  없습니다.
                </p>
              </div>
              <button
                type="button"
                className="admin-btn"
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
                      // 마지막 admin 은 강등/삭제 불가. 본인이라도 다른 admin 이 있으면 변경 가능.
                      const roleLocked = busy || isLastAdmin
                      const deleteLocked = busy || isSelf || isLastAdmin
                      const lockHint = isLastAdmin
                        ? '마지막 관리자는 역할을 변경할 수 없습니다.'
                        : isSelf
                          ? '자신의 계정은 삭제할 수 없습니다.'
                          : undefined
                      return (
                        <tr key={row.id}>
                          <td>{row.username}</td>
                          <td>{row.nickname}</td>
                          <td>
                            <select
                              value={row.role}
                              disabled={roleLocked}
                              title={roleLocked ? lockHint : undefined}
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
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {nav === 'ships' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>선박 리스트</h1>
                <p>등록된 선박을 확인하고 텍스트로 추가합니다.</p>
              </div>
              <div className="admin-page-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => void loadShips()}
                  disabled={loadingShips}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setShowImport((v) => !v)
                    setImportNote('')
                  }}
                >
                  {showImport ? '닫기' : '선박 추가'}
                </button>
              </div>
            </div>

            {showImport && (
              <form
                className="admin-import-form"
                onSubmit={handleImport}
              >
                <label className="field">
                  <span>선박 텍스트</span>
                  <textarea
                    rows={12}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="위키 등에서 복사한 선박 정보를 붙여넣으세요."
                    disabled={importing}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={importing}
                  >
                    {importing ? '등록 중…' : '등록'}
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

            {shipsError && (
              <p className="form-note error" role="alert">
                {shipsError}
              </p>
            )}

            {loadingShips ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>분류</th>
                      <th>크기</th>
                      <th>형태</th>
                      <th>레벨</th>
                      <th>획득 구분</th>
                      <th>획득 방법</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ships.map((ship, index) => (
                      <tr
                        key={ship.id}
                        className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                        tabIndex={0}
                        onClick={() => setDetailShip(ship)}
                        onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setDetailShip(ship)
                          }
                        }}
                      >
                        <td>{ship.name}</td>
                        <td>{ship.category || '-'}</td>
                        <td>{ship.size || '-'}</td>
                        <td>{ship.form || '-'}</td>
                        <td>
                          모{ship.adventureLv}/교{ship.tradeLv}/전{ship.battleLv}
                        </td>
                        <td>{ship.acquireType || '-'}</td>
                        <td>{ship.acquireMethod || '-'}</td>
                      </tr>
                    ))}
                    {ships.length === 0 && (
                      <tr>
                        <td colSpan={7}>등록된 선박이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {nav === 'quests' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>퀘스트 리스트</h1>
                <p>
                  위키 텍스트로 추가·갱신합니다. 같은 이름이면 공략·진행 포함 전체를
                  덮어씁니다.
                </p>
              </div>
              <div className="admin-page-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => void loadQuests()}
                  disabled={loadingQuests}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setShowQuestImport((v) => !v)
                    setQuestImportNote('')
                  }}
                >
                  {showQuestImport ? '닫기' : '퀘스트 추가'}
                </button>
              </div>
            </div>

            {showQuestImport && (
              <form className="admin-import-form" onSubmit={handleQuestImport}>
                <label className="field">
                  <span>퀘스트 텍스트 (분류~진행 전체)</span>
                  <textarea
                    className="quest-import-textarea"
                    rows={22}
                    value={questImportText}
                    onChange={(e) => setQuestImportText(e.target.value)}
                    placeholder={`퀘스트이름\n소개 문단\n\n분류\t[모험] 일반\t난이도\t\n…\n공략\t1. …\n진행\t1. …\n결론 - …`}
                    disabled={importingQuest}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={importingQuest}
                  >
                    {importingQuest ? '저장 중…' : '저장'}
                  </button>
                </div>
              </form>
            )}

            {questImportNote && (
              <p
                className={`form-note${
                  /실패|못|오류|에러|중복/.test(questImportNote) ? ' error' : ''
                }`}
              >
                {questImportNote}
              </p>
            )}

            {questsError && (
              <p className="form-note error" role="alert">
                {questsError}
              </p>
            )}

            {loadingQuests ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>분류</th>
                      <th>난이도</th>
                      <th>의뢰 장소</th>
                      <th>목적지</th>
                      <th>발견물</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quests.map((quest, index) => (
                      <tr
                        key={quest.id}
                        className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                        tabIndex={0}
                        onClick={() => setDetailQuest(quest)}
                        onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setDetailQuest(quest)
                          }
                        }}
                      >
                        <td>{quest.name}</td>
                        <td>
                          {quest.category
                            ? `[${quest.category}] ${quest.questType || ''}`.trim()
                            : '-'}
                        </td>
                        <td>{quest.difficulty ?? '-'}</td>
                        <td>{quest.requestPlaces || '-'}</td>
                        <td>{quest.destination || '-'}</td>
                        <td>
                          {[
                            quest.discoveryCategory
                              ? `[${quest.discoveryCategory}]`
                              : null,
                            quest.discoveryRank,
                            quest.discoveryName,
                          ]
                            .filter((v) => v != null && v !== '')
                            .join(' ') || '-'}
                        </td>
                      </tr>
                    ))}
                    {quests.length === 0 && (
                      <tr>
                        <td colSpan={6}>등록된 퀘스트가 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {detailShip && (
        <div
          className="admin-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${detailShip.name} 상세`}
        >
          <button
            type="button"
            className="admin-modal-backdrop"
            aria-label="닫기"
            onClick={() => setDetailShip(null)}
          />
          <div className="admin-modal-panel">
            <header className="admin-modal-head">
              <p>선박 상세</p>
              <button
                type="button"
                className="admin-btn"
                onClick={() => setDetailShip(null)}
              >
                닫기
              </button>
            </header>
            <div className="admin-modal-body">
              <ShipDetailView ship={detailShip} />
            </div>
          </div>
        </div>
      )}

      {detailQuest && (
        <div
          className="admin-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${detailQuest.name} 상세`}
        >
          <button
            type="button"
            className="admin-modal-backdrop"
            aria-label="닫기"
            onClick={() => setDetailQuest(null)}
          />
          <div className="admin-modal-panel">
            <header className="admin-modal-head">
              <p>퀘스트 상세</p>
              <button
                type="button"
                className="admin-btn"
                onClick={() => setDetailQuest(null)}
              >
                닫기
              </button>
            </header>
            <div className="admin-modal-body">
              <QuestDetailView quest={detailQuest} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminForbidden() {
  return (
    <div className="admin-shell admin-forbidden">
      <div className="admin-workspace">
        <section className="admin-section">
          <h1>접근 권한이 없습니다</h1>
          <p>관리자만 `/admin`에 들어갈 수 있습니다.</p>
          <a className="admin-btn admin-btn-primary" href="/">
            메인으로
          </a>
        </section>
      </div>
    </div>
  )
}
