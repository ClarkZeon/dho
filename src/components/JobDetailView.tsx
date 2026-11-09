import { lazy, Suspense, useState, type ReactNode } from 'react'
import { fetchSkill } from '../lib/api'
import { getModuleDef } from '../lib/detailModules'
import type { JobDetail, SkillDetail } from '../types'
import { ConfirmLayer } from './ConfirmLayer'
import { DetailModal } from './DetailModal'
import { DucatAmount } from './DucatAmount'
import { LoadingOverlay } from './LoadingOverlay'
import {
  SkillBonusChips,
  SkillModule,
  type SkillModuleRef,
} from './modules/SkillModule'

/** SkillDetailView ↔ JobDetailView 순환 참조 방지 */
const SkillDetailView = lazy(() =>
  import('./SkillDetailView').then((m) => ({ default: m.SkillDetailView })),
)

type JobDetailViewProps = {
  job: JobDetail
  token?: string
  isAdmin?: boolean
  /** 외부에서 점프를 맡길 때. 없으면 token으로 내부 점프 */
  onOpenSkill?: (skill: SkillModuleRef) => void
}

function Kv({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  if (value == null || value === '') return null
  if (typeof value === 'string' && !value.trim()) return null
  return (
    <div>
      <span>{label}</span>
      <strong style={{ whiteSpace: 'pre-wrap' }}>{value}</strong>
    </div>
  )
}

/** 직업 모듈 호스트 페이지 — 기본 정보·필요·연구는 모듈 인스턴스 고유 필드 */
export function JobDetailView({
  job,
  token = '',
  isAdmin = false,
  onOpenSkill,
}: JobDetailViewProps) {
  const authToken = token
  const [skillDetail, setSkillDetail] = useState<SkillDetail | null>(null)
  const [skillLoading, setSkillLoading] = useState(false)
  const [skillMissName, setSkillMissName] = useState('')
  const [skillError, setSkillError] = useState('')

  async function openMatchedSkill(skill: SkillModuleRef) {
    if (onOpenSkill) {
      onOpenSkill(skill)
      return
    }
    if (!authToken) return
    const key = (skill.slug || skill.name || '').trim()
    if (!key) return
    const missLabel = (skill.name || key).trim()
    setSkillLoading(true)
    setSkillMissName('')
    setSkillError('')
    try {
      const res = await fetchSkill(authToken, key)
      setSkillDetail(res.skill)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (/찾을 수 없|없습니다/i.test(message)) {
        setSkillMissName(missLabel)
      } else {
        setSkillError(message || '스킬 상세를 불러오지 못했습니다.')
      }
    } finally {
      setSkillLoading(false)
    }
  }

  function openSkillsAddTab(skillName: string) {
    const params = new URLSearchParams()
    params.set('q', skillName)
    params.set('add', '1')
    const url = `${window.location.pathname}${window.location.search}#/skills?${params.toString()}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const canJump = Boolean(onOpenSkill || authToken)
  const handleOpen = canJump
    ? (skill: SkillModuleRef) => void openMatchedSkill(skill)
    : undefined

  return (
    <div className="quest-detail" data-module-host="job">
      <header className="quest-detail-hero">
        <div className="quest-detail-hero-top">
          <span className="quest-badge">
            {getModuleDef('job')?.title ?? '직업'}
          </span>
          {job.category ? (
            <span className="quest-badge">{job.category}</span>
          ) : null}
        </div>
        <h2>
          {job.name}
          {job.altName ? (
            <span className="port-alt-name"> ({job.altName})</span>
          ) : null}
        </h2>
        {job.description ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{job.description}</p>
        ) : null}
      </header>

      <section className="quest-detail-section">
        <h3>기본 정보</h3>
        <div className="quest-kv-grid">
          <Kv label="분류" value={job.category} />
          <Kv label="추천장" value={job.recommendation} />
          <Kv
            label="비용"
            value={job.cost ? <DucatAmount value={job.cost} /> : null}
          />
        </div>
      </section>

      <SkillModule
        skills={job.preferredSkills.map((name) => ({ name }))}
        onOpenSkill={handleOpen}
        busy={skillLoading}
      />

      {job.requirements.length > 0 ? (
        <section className="quest-detail-section">
          <h3>필요</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>종류</th>
                  <th>내용</th>
                </tr>
              </thead>
              <tbody>
                {job.requirements.map((row, idx) => (
                  <tr key={`${row.kind}-${idx}`}>
                    <td>{row.kind || '-'}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>
                      {row.content || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {job.researches.length > 0 ? (
        <section className="quest-detail-section">
          <h3>연구</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>연구</th>
                  <th>전공</th>
                  <th>획득 스킬</th>
                </tr>
              </thead>
              <tbody>
                {job.researches.map((row, idx) => (
                  <tr key={`${row.name}-${idx}`}>
                    <td>{row.name}</td>
                    <td>{row.major || '-'}</td>
                    <td>
                      {row.skill?.trim() ? (
                        <SkillBonusChips
                          text={row.skill}
                          onOpenSkill={handleOpen}
                          busy={skillLoading}
                        />
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {skillLoading ? <LoadingOverlay label="스킬 불러오는 중…" /> : null}

      {skillMissName ? (
        <ConfirmLayer
          title="확인"
          message={`「${skillMissName}」 스킬이 없습니다.`}
          stack={1}
          onCancel={() => setSkillMissName('')}
          confirmLabel={isAdmin ? '등록하러 이동하기' : undefined}
          onConfirm={
            isAdmin
              ? () => {
                  openSkillsAddTab(skillMissName)
                  setSkillMissName('')
                }
              : undefined
          }
        />
      ) : null}

      {skillError ? (
        <ConfirmLayer
          title="확인"
          message={skillError}
          stack={1}
          onCancel={() => setSkillError('')}
        />
      ) : null}

      {skillDetail ? (
        <DetailModal
          title="스킬 상세"
          label={`${skillDetail.name} 상세`}
          onClose={() => {
            setSkillDetail(null)
            setSkillError('')
          }}
          stack={1}
          headerActions={
            isAdmin ? (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  const params = new URLSearchParams()
                  params.set('q', skillDetail.name)
                  params.set('open', skillDetail.slug || skillDetail.name)
                  const url = `${window.location.pathname}${window.location.search}#/skills?${params.toString()}`
                  window.open(url, '_blank', 'noopener,noreferrer')
                }}
              >
                스킬 메뉴로 이동
              </button>
            ) : undefined
          }
        >
          <Suspense fallback={<LoadingOverlay label="스킬 불러오는 중…" />}>
            <SkillDetailView
              skill={skillDetail}
              token={authToken}
              isAdmin={isAdmin}
            />
          </Suspense>
        </DetailModal>
      ) : null}
    </div>
  )
}
