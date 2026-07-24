import { useEffect, useRef, useState } from 'react'

/**
 * The "Sort by" control the panel title rows carry.
 *
 * Shared rather than written per list: the lines sort, the stations sort, and anything that grows a
 * list next will want the same thing. It lives apart from the list it orders because it sits up on
 * the panel's title row, so the state belongs to RightPanel and is handed to both.
 *
 * Generic over the key so each list keeps its own vocabulary — the options and their meaning are
 * the caller's, only the dropdown is shared.
 */
export interface SortOption<T extends string> {
  key: T
  label: string
}

export function SortControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: SortOption<T>[]
  onChange: (key: T) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Sort by</span>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          height: '24px',
          padding: '0 8px',
          fontSize: 'var(--text-xs)',
          fontWeight: 500,
          color: 'var(--text-primary)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        {options.find(o => o.key === value)?.label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '28px',
            right: 0,
            zIndex: 50,
            minWidth: '120px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            padding: '4px 0',
          }}
        >
          {options.map(option => (
            <div
              key={option.key}
              role="option"
              aria-selected={option.key === value}
              onClick={() => {
                onChange(option.key)
                setOpen(false)
              }}
              style={{
                padding: '5px 12px',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                background: option.key === value ? 'var(--color-info-bg)' : 'transparent',
                fontWeight: option.key === value ? 500 : 400,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = option.key === value ? 'var(--color-info-bg)' : 'var(--bg-subtle)')}
              onMouseLeave={e => (e.currentTarget.style.background = option.key === value ? 'var(--color-info-bg)' : 'transparent')}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
