import type { QuestSkillReq } from '../types'

/** 프랑스어·영어 등 — 이름 끝이 `어` 인 언어 스킬 */
export function isLanguageSkillName(name: string | null | undefined): boolean {
  return /어$/u.test(String(name || '').trim())
}

/** 위키 전문 표기 `*` 제거 + `이름 N*` → 이름/레벨 분리 */
export function cleanQuestSkill(
  skill: Pick<QuestSkillReq, 'name' | 'level'>,
): QuestSkillReq {
  let name = String(skill.name || '')
    .trim()
    .replace(/\*+\s*$/u, '')
    .trim()
  let level =
    skill.level == null || (skill.level as unknown) === ''
      ? null
      : Number(skill.level)
  if (!Number.isFinite(level)) level = null

  // DB에 `생태 조사 1*` 로 붙은 경우
  const embedded = name.match(/^(.+?)\s+(\d+)\s*$/)
  if (embedded && level == null) {
    name = embedded[1].trim()
    level = Number(embedded[2])
  }

  return { name, level }
}

/** 언어 스킬은 레벨 미표시 */
export function skillDisplayLevel(
  skill: Pick<QuestSkillReq, 'name' | 'level'>,
): number | null {
  const cleaned = cleanQuestSkill(skill)
  if (cleaned.level == null) return null
  if (isLanguageSkillName(cleaned.name)) return null
  return cleaned.level
}

/** 연속/선행 퀘스트 스킬 한 줄 표기 — `*` 없음, 언어는 숫자 없음 */
export function formatQuestSkillLabel(
  skill: Pick<QuestSkillReq, 'name' | 'level'>,
): string {
  const cleaned = cleanQuestSkill(skill)
  if (!cleaned.name) return ''
  const level = skillDisplayLevel(cleaned)
  return level != null ? `${cleaned.name} ${level}` : cleaned.name
}

/**
 * 위키는 「종교학 2」와 「추가」가 별도이고, 복붙 시 `2추가 : 프랑스어`처럼 붙을 수 있음.
 * → 종교학 Lv.2 + 프랑스어(추가 스킬) 로 분리.
 */
export function normalizeQuestSkills(
  skills: Array<QuestSkillReq | null | undefined> | null | undefined,
): QuestSkillReq[] {
  const out: QuestSkillReq[] = []
  for (const skill of skills || []) {
    if (!skill) continue
    const name = String(skill.name || '').trim()
    let level =
      skill.level == null || (skill.level as unknown) === ''
        ? null
        : Number(skill.level)
    if (!Number.isFinite(level)) level = null
    if (!name) continue

    const glued = name.match(
      /^(.*?)\s+(\d+)\s*추가\s*(?:\([^)]*\)|[?？])?\s*[:：]?\s*(.+)$/u,
    )
    if (glued) {
      out.push(cleanQuestSkill({ name: glued[1].trim(), level: Number(glued[2]) }))
      const rest = glued[3].trim()
      const restLevel = rest.match(/^(.+?)\s+(\d+)\s*\**\s*$/)
      if (restLevel) {
        out.push(
          cleanQuestSkill({
            name: restLevel[1].trim(),
            level: Number(restLevel[2]),
          }),
        )
      } else if (rest) {
        out.push(cleanQuestSkill({ name: rest, level }))
      }
      continue
    }

    out.push(cleanQuestSkill({ name, level }))
  }
  return out
}
