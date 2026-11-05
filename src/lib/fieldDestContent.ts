/**
 * 육지 목적지 내용.
 * 예: `[인식] 낮 - … 남쪽 끝 (인식 9)` → 앞 대괄호 스킬 제거, 뒤 `(스킬 레벨)` 분리
 */
export function splitFieldDestContent(raw: string | null | undefined): {
  text: string
  skillName: string | null
  skillLevel: number | null
} {
  let text = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return { text: '', skillName: null, skillLevel: null }

  let skillName: string | null = null
  let skillLevel: number | null = null

  const trailing = text.match(
    /^(.*?)\s*\(([^()]+?)\s+(\d+(?:\.\d+)?)\)\s*$/u,
  )
  if (trailing) {
    text = trailing[1].trim()
    skillName = trailing[2].trim() || null
    const n = Number(trailing[3])
    skillLevel = Number.isFinite(n) ? n : null
  }

  // 앞에 `[인식]` 이 있으면 제거 (뒤 스킬과 같으면 특히)
  const leading = text.match(/^\[([^\]]+)\]\s*(.*)$/u)
  if (leading) {
    const bracket = leading[1].trim()
    if (!skillName || bracket === skillName || bracket.replace(/\s+/g, '') === skillName.replace(/\s+/g, '')) {
      text = leading[2].trim()
    }
  }

  return { text, skillName, skillLevel }
}
