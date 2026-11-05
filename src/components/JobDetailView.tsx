import type { ReactNode } from 'react'
import { getModuleDef } from '../lib/detailModules'
import type { JobDetail } from '../types'
import { DucatAmount } from './DucatAmount'
import { SkillModule } from './modules/SkillModule'

type JobDetailViewProps = {
  job: JobDetail
  onOpenSkill?: (skill: { name: string }) => void
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
export function JobDetailView({ job, onOpenSkill }: JobDetailViewProps) {
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
          <Kv label="비용" value={job.cost ? <DucatAmount value={job.cost} /> : null} />
        </div>
      </section>

      <SkillModule
        skills={job.preferredSkills.map((name) => ({ name }))}
        onOpenSkill={onOpenSkill}
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
                    <td>{row.kind}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{row.content}</td>
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
                    <td>{row.skill || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
