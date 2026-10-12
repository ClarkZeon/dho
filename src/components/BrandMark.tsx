type BrandMarkProps = {
  className?: string
}

/** DHO Light 워드마크 + 조타키(키) */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span className={`brand-mark${className ? ` ${className}` : ''}`}>
      <svg
        className="brand-mark-helm"
        viewBox="0 0 64 64"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="32"
          cy="32"
          r="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
        />
        <circle
          cx="32"
          cy="32"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <circle cx="32" cy="32" r="2.6" fill="currentColor" />
        {[0, 45, 90, 135].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 32 32)`}>
            <rect x="29.4" y="8" width="5.2" height="14" rx="1.6" fill="currentColor" />
            <rect x="29.4" y="42" width="5.2" height="14" rx="1.6" fill="currentColor" />
          </g>
        ))}
      </svg>
      <span className="brand-mark-text">
        DHO <em>Light</em>
      </span>
    </span>
  )
}
