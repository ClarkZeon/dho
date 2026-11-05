/** 퀘스트 난이도: 입체 별 아이콘 + 숫자 */
export function QuestDifficultyStars({
  value,
  mode = 'slots',
}: {
  value: number | null | undefined
  /** slots: 10칸 on/off · filled: 켜진 별만 */
  mode?: 'slots' | 'filled'
}) {
  if (value == null || !Number.isFinite(Number(value))) {
    return mode === 'slots' ? <span className="quest-muted">-</span> : null
  }
  const filled = Math.max(0, Math.min(10, Math.floor(Number(value))))
  const count = mode === 'filled' ? filled : 10
  if (mode === 'filled' && count === 0) {
    return (
      <span className="quest-stars" aria-label="난이도 0">
        <em>0</em>
      </span>
    )
  }

  return (
    <span className="quest-stars" aria-label={`난이도 ${filled}`}>
      {Array.from({ length: count }, (_, i) => (
        <img
          key={i}
          className={`quest-star-icon${i < filled ? ' is-on' : ' is-off'}`}
          src="/icons/quest-difficulty-star.svg"
          alt=""
          aria-hidden="true"
          width={14}
          height={14}
          draggable={false}
        />
      ))}
      <em>{filled}</em>
    </span>
  )
}
