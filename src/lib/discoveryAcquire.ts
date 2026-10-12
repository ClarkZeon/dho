import type { DiscoveryQuestRef, QuestSkillReq } from '../types'

function formatQuestSkillClause(
  difficulty: number | null | undefined,
  skills: QuestSkillReq[] | null | undefined,
) {
  const skillParts = (skills || [])
    .map((skill) => {
      const name = String(skill?.name || '').trim()
      if (!name) return ''
      return skill.level != null && Number.isFinite(Number(skill.level))
        ? `${name} ${skill.level}`
        : name
    })
    .filter(Boolean)

  if (difficulty != null && Number.isFinite(Number(difficulty))) {
    if (skillParts.length) return `${difficulty} ${skillParts.join(', ')}`
    return String(difficulty)
  }
  return skillParts.join(', ')
}

/**
 * 매칭된 퀘스트로 위키형 발견 방법 전체 문구 생성
 * 예: [퀘스트] 모험 | 악어냐 물고기냐 (7 생태 조사 8, 생물학 10, 프랑스어 1) - 마르세이유
 */
export function formatAcquireFromQuest(
  quest: DiscoveryQuestRef | null | undefined,
  acquireType: string | null | undefined = '퀘스트',
) {
  if (!quest?.name) return null
  const type = String(acquireType || '퀘스트').trim() || '퀘스트'
  const category = String(quest.category || quest.questType || '').trim()
  const skillsClause = formatQuestSkillClause(quest.difficulty, quest.skills)
  const places = String(quest.requestPlaces || '').trim()

  let body = ''
  if (category) body += `${category} | `
  body += quest.name
  if (skillsClause) body += ` (${skillsClause})`
  if (places) body += ` - ${places}`

  return `[${type}] ${body}`
}

/** 발견 방법 표시: 퀘스트 매칭 시 퀘스트 데이터가 소스 */
export function formatDiscoveryAcquire(discovery: {
  acquireType?: string | null
  acquireName?: string | null
  acquireQuest?: DiscoveryQuestRef | null
}) {
  const fromQuest = formatAcquireFromQuest(
    discovery.acquireQuest,
    '퀘스트',
  )
  if (fromQuest) return fromQuest

  const type = String(discovery.acquireType || '').trim()
  const name = String(discovery.acquireName || '').trim()
  if (type && name) return `[${type}] ${name}`
  if (type) return `[${type}]`
  return name
}
