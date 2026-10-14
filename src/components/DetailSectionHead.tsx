import type { ReactNode } from 'react'

export function PencilIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export function DetailSectionHead({
  title,
  canEdit,
  editing,
  onEdit,
}: {
  title: string
  canEdit: boolean
  editing: boolean
  onEdit: () => void
}) {
  return (
    <div className="quest-section-head">
      <h3>{title}</h3>
      {canEdit && !editing ? (
        <button
          type="button"
          className="quest-edit-icon-btn"
          aria-label={`${title} 수정`}
          title={`${title} 수정`}
          onClick={onEdit}
        >
          <PencilIcon />
        </button>
      ) : null}
    </div>
  )
}

export function DetailSectionActions({
  busy,
  onCancel,
  onSave,
}: {
  busy: boolean
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="quest-walkthrough-actions">
      <button
        type="button"
        className="admin-btn"
        disabled={busy}
        onClick={onCancel}
      >
        취소
      </button>
      <button
        type="button"
        className="admin-btn admin-btn-primary"
        disabled={busy}
        onClick={onSave}
      >
        {busy ? '저장 중…' : '저장'}
      </button>
    </div>
  )
}

export function DetailKvRow({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
