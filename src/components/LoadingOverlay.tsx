/** 전체 화면 스피너 레이어 */
export function LoadingOverlay({
  label = '불러오는 중…',
}: {
  label?: string
}) {
  return (
    <div
      className="app-loading-overlay"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="app-loading-spinner" aria-hidden="true" />
    </div>
  )
}
