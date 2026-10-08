import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'

export type ShipSearchOption = {
  value: string
  label: string
  meta?: string
  disabled?: boolean
}

type ShipSearchSelectProps = {
  label: string
  value: string
  options: ShipSearchOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  emptyText?: string
}

export function ShipSearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder = '선박 이름 검색…',
  disabled = false,
  emptyText = '검색 결과 없음',
}: ShipSearchSelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const selected = options.find((o) => o.value === value) ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? options.filter((o) => {
          const hay = `${o.label} ${o.meta ?? ''}`.toLowerCase()
          return hay.includes(q)
        })
      : options
    return list.filter((o) => !o.disabled || o.value === value)
  }, [options, query, value])

  useEffect(() => {
    if (!open) return
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  function pick(next: string) {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (!open) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const item = filtered[activeIndex]
      if (item && !item.disabled) pick(item.value)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="ship-pick ship-search-select" ref={rootRef}>
      <span className="ship-pick-label">{label}</span>
      <div className={`ship-search-control ${open ? 'is-open' : ''}`}>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={label}
          disabled={disabled}
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : selected?.label ?? ''}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setQuery('')
          }}
          onKeyDown={onKeyDown}
        />
        {value && !disabled && (
          <button
            type="button"
            className="ship-search-clear"
            aria-label="선택 해제"
            onClick={() => {
              onChange('')
              setQuery('')
              setOpen(true)
              inputRef.current?.focus()
            }}
          >
            ×
          </button>
        )}
      </div>

      {open && !disabled && (
        <ul id={listId} className="ship-search-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="ship-search-empty">{emptyText}</li>
          ) : (
            filtered.map((option, index) => (
              <li key={option.value} role="option" aria-selected={option.value === value}>
                <button
                  type="button"
                  className={`ship-search-option ${option.value === value ? 'is-selected' : ''} ${index === activeIndex ? 'is-active' : ''}`}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    if (!option.disabled) pick(option.value)
                  }}
                >
                  <span>{option.label}</span>
                  {option.meta && <em>{option.meta}</em>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
