import { skillDisplayLevel } from '../lib/questSkills'
import { splitFieldDestContent } from '../lib/fieldDestContent'
import { SkillEdgeLabel } from './SkillEdgeLabel'

/** 육지 목적지 「내용」 — `(스킬 레벨)` → 스킬 칩, 앞 `[스킬]` 제거 */
export function FieldDestContent({
  content,
}: {
  content: string | null | undefined
}) {
  const { text, skillName, skillLevel } = splitFieldDestContent(content)
  if (!text && !skillName) return <>-</>

  const level =
    skillName != null
      ? skillDisplayLevel({ name: skillName, level: skillLevel })
      : null

  return (
    <div className="field-dest-content">
      {skillName ? (
        <ul className="quest-skill-chips">
          <li className="is-skill-chip">
            <SkillEdgeLabel />
            <span>{skillName}</span>
            {level != null ? <em>Lv.{level}</em> : null}
          </li>
        </ul>
      ) : null}
      {text ? <span className="field-dest-content-text">{text}</span> : null}
    </div>
  )
}
