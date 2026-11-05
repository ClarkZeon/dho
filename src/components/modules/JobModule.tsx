import { getModuleDef } from '../../lib/detailModules'

export type JobModuleRef = {
  id?: number
  slug?: string
  /** 원문 이름. 끝의 `*` 는 전문 직업 표시 */
  name: string
  specialist?: boolean
}

type JobChip = JobModuleRef & {
  name: string
  specialist: boolean
}

type JobModuleProps = {
  /** 다른 호스트 페이지에 붙는 직업 목록 */
  jobs: JobModuleRef[]
  canEdit?: boolean
  /** false면 부모가 제목을 그릴 때 h3 생략 */
  showTitle?: boolean
  onOpenJob?: (job: JobModuleRef) => void
}

/** 위키 `사냥꾼*` → 전문 직업 */
export function parseJobMark(raw: string): {
  name: string
  specialist: boolean
} {
  const text = String(raw || '').trim()
  const specialist = /\*+\s*$/.test(text)
  const name = text.replace(/\*+\s*$/, '').trim()
  return { name: name || text, specialist }
}

/** 직업 이름(들)을 칩으로 표시. `*` 표기는 전문 직업 스타일 */
export function JobChips({
  jobs,
  onOpenJob,
}: {
  jobs: Array<string | JobModuleRef | null | undefined>
  onOpenJob?: (job: JobModuleRef) => void
}) {
  const items = (jobs || [])
    .map((raw): JobChip | null => {
      if (raw == null) return null
      if (typeof raw === 'string') {
        const marked = parseJobMark(raw)
        if (!marked.name.trim()) return null
        return { name: marked.name, specialist: marked.specialist }
      }
      const marked = parseJobMark(raw.name)
      const name = marked.name.trim()
      if (!name) return null
      return {
        ...raw,
        name,
        specialist: raw.specialist ?? marked.specialist,
      }
    })
    .filter((item): item is JobChip => item != null)

  if (items.length === 0) return null

  return (
    <ul className="quest-skill-chips">
      {items.map((item, index) => (
        <li
          key={
            item.id != null ? `id:${item.id}` : `name:${item.name}-${index}`
          }
          className={item.specialist ? 'is-specialist' : undefined}
          title={item.specialist ? '전문 직업' : undefined}
        >
          {onOpenJob ? (
            <button
              type="button"
              className="quest-skill-chip-btn"
              onClick={() =>
                onOpenJob({
                  id: item.id,
                  slug: item.slug,
                  name: item.name,
                  specialist: item.specialist,
                })
              }
            >
              {item.name}
            </button>
          ) : (
            <span>{item.name}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function JobChipList({
  items,
  onOpenJob,
}: {
  items: JobChip[]
  onOpenJob?: (job: JobModuleRef) => void
}) {
  return <JobChips jobs={items} onOpenJob={onOpenJob} />
}

/**
 * 「직업」 모듈 — 다른 모듈 페이지에 붙는 연결 직업.
 * 직업 본문(기본 정보·필요·연구)은 JobDetailView 가 담당한다.
 * 전문 직업(`*` 표기)은 일반과 별도 라인 칩으로 표시한다.
 */
export function JobModule({
  jobs,
  canEdit = false,
  showTitle = true,
  onOpenJob,
}: JobModuleProps) {
  const title = getModuleDef('job')?.title ?? '직업'
  const list: JobChip[] = (jobs || [])
    .map((item) => {
      const marked = parseJobMark(item.name)
      return {
        ...item,
        name: marked.name,
        specialist: item.specialist ?? marked.specialist,
      }
    })
    .filter((item) => item.name.trim())

  const normal = list.filter((item) => !item.specialist)
  const specialist = list.filter((item) => item.specialist)

  if (!canEdit && list.length === 0) return null

  const body =
    list.length > 0 ? (
      <div className="skill-module-rows">
        {specialist.length > 0 ? (
          <div className="skill-module-row">
            <span className="skill-module-row-label is-specialist">전문</span>
            <JobChipList items={specialist} onOpenJob={onOpenJob} />
          </div>
        ) : null}
        {normal.length > 0 ? (
          <div className="skill-module-row">
            <span className="skill-module-row-label">우대</span>
            <JobChipList items={normal} onOpenJob={onOpenJob} />
          </div>
        ) : null}
      </div>
    ) : (
      <p className="quest-muted">없음</p>
    )

  if (!showTitle) return body

  return (
    <section className="quest-detail-section" data-module="job">
      <h3>{title}</h3>
      {body}
    </section>
  )
}
