import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Dashboard } from './components/Dashboard'
import { Toast } from './components/Toast'
import {
  clearSession,
  loadSession,
  login as loginRequest,
  logout as logoutRequest,
  saveSession,
  signup as signupRequest,
} from './lib/api'
import type { Session, User } from './types'
import './App.css'

type Mode = 'login' | 'signup'

function normalizeUser(
  user: Partial<User> & Pick<User, 'id' | 'username' | 'nickname' | 'createdAt'>,
): User {
  const level =
    Number.isFinite(user.level) && (user.level as number) >= 1
      ? Math.floor(user.level as number)
      : 1
  const xp =
    Number.isFinite(user.xp) && (user.xp as number) >= 0
      ? Math.floor(user.xp as number)
      : 0
  const xpToNext =
    Number.isFinite(user.xpToNext) && (user.xpToNext as number) > 0
      ? Math.floor(user.xpToNext as number)
      : level * 100
  const role = user.role === 'admin' ? 'admin' : 'member'
  return { ...user, role, level, xp, xpToNext }
}

function App() {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [message, setMessage] = useState('')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<Session | null>(null)

  const clearToast = useCallback(() => setToast(''), [])
  const showToast = useCallback((text: string) => setToast(text), [])

  useEffect(() => {
    const saved = loadSession()
    if (!saved) return
    setSession({
      token: saved.token,
      user: normalizeUser(saved.user),
    })
  }, [])

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setMessage('')
    setPassword('')
    setPasswordConfirm('')
    setShowPassword(false)
  }

  function persistSession(next: Session) {
    const normalized = {
      token: next.token,
      user: normalizeUser(next.user),
    }
    saveSession(normalized, remember)
    setSession(normalized)
  }

  async function logout() {
    if (session?.token) {
      try {
        await logoutRequest(session.token)
      } catch {
        // ignore network logout failure
      }
    }
    clearSession()
    setSession(null)
    setMessage('')
    setToast('로그아웃되었습니다.')
    setMode('login')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        const data = await signupRequest({
          username,
          nickname,
          password,
          passwordConfirm,
        })
        setMessage(`${data.user.nickname} 님 계정이 만들어졌습니다. 로그인해 주세요.`)
        setMode('login')
        setPassword('')
        setPasswordConfirm('')
        return
      }

      const data = await loginRequest({ username, password })
      persistSession({ user: data.user, token: data.token })

      const parts = [`${data.user.nickname} 님, 로그인되었습니다.`]
      if (data.reward?.dailyXp) {
        parts.push(`일일 접속 +${data.reward.dailyXp} XP`)
      }
      if (data.reward?.gainedLevels) {
        parts.push(`레벨업! Lv.${data.user.level}`)
      }
      setToast(parts.join(' · '))
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {session ? (
        <Dashboard
          user={session.user}
          token={session.token}
          onLogout={logout}
          onToast={showToast}
        />
      ) : (
        <div className="login-page">
          <div className="login-atmosphere" aria-hidden="true">
            <div className="horizon" />
            <div className="sea" />
            <div className="compass-ring" />
            <div className="light-beam" />
          </div>

          <header className="topbar">
            <span className="topbar-mark">
              DHO <em>Light</em>
            </span>
            <span className="topbar-meta">빛 · 희망</span>
          </header>

          <main className="login-stage">
            <section className="brand-panel">
              <p className="brand-kicker">DHO LIGHT</p>
              <h1 className="brand-title">
                대항해시대
                <span>온라인</span>
              </h1>
              <p className="brand-lead">
                <span>선박 수치와 가속도 계산을</span>
                <span>어디서나 바로 다루는 보조 앱</span>
              </p>
            </section>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="form-head">
                <h2>{mode === 'login' ? '로그인' : '회원가입'}</h2>
                <p>
                  {mode === 'login'
                    ? '아이디와 비밀번호를 입력하세요'
                    : '사용할 아이디와 닉네임을 정해 주세요'}
                </p>
              </div>

              <label className="field">
                <span className="field-label">아이디</span>
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  placeholder="영문, 숫자, _ (4~20자)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </label>

              {mode === 'signup' && (
                <label className="field">
                  <span className="field-label">닉네임</span>
                  <input
                    type="text"
                    name="nickname"
                    autoComplete="nickname"
                    placeholder="2~16자"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    disabled={loading}
                  />
                </label>
              )}

              <label className="field">
                <span className="field-label">비밀번호</span>
                <div className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete={
                      mode === 'login' ? 'current-password' : 'new-password'
                    }
                    placeholder="8자 이상"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loading}
                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? '숨기기' : '보기'}
                  </button>
                </div>
              </label>

              {mode === 'signup' && (
                <label className="field">
                  <span className="field-label">비밀번호 확인</span>
                  <div className="password-field">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="passwordConfirm"
                      autoComplete="new-password"
                      placeholder="비밀번호를 다시 입력"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={loading}
                      aria-label={
                        showPassword ? '비밀번호 숨기기' : '비밀번호 보기'
                      }
                      aria-pressed={showPassword}
                    >
                      {showPassword ? '숨기기' : '보기'}
                    </button>
                  </div>
                </label>
              )}

              {mode === 'login' && (
                <div className="form-row">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      disabled={loading}
                    />
                    <span>로그인 상태 유지</span>
                  </label>
                  <button type="button" className="text-link" disabled={loading}>
                    비밀번호 찾기
                  </button>
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={loading}>
                <span className="submit-shine" aria-hidden="true" />
                {loading ? '처리 중…' : mode === 'login' ? '로그인' : '가입하기'}
              </button>

              <div className="form-foot">
                {mode === 'login' ? (
                  <>
                    <span>처음이신가요?</span>
                    <button
                      type="button"
                      className="text-link accent"
                      onClick={() => switchMode('signup')}
                      disabled={loading}
                    >
                      계정 만들기
                    </button>
                  </>
                ) : (
                  <>
                    <span>이미 가입하셨나요?</span>
                    <button
                      type="button"
                      className="text-link accent"
                      onClick={() => switchMode('login')}
                      disabled={loading}
                    >
                      로그인으로
                    </button>
                  </>
                )}
              </div>

              {error && (
                <p className="form-note error" role="alert">
                  {error}
                </p>
              )}
              {message && (
                <p className="form-note" role="status">
                  {message}
                </p>
              )}
            </form>
          </main>
        </div>
      )}
      <Toast message={toast} onClose={clearToast} />
    </>
  )
}

export default App
