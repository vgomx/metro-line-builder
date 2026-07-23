import { useEffect, useRef, useState } from 'react'
import type { Company } from '../types'
import { CompanySymbolIcon } from '../companySymbols'
import { AuthoritySealIcon } from '../authoritySeal'

interface CompanySelectProps {
  /** The line's operator, or '' for the local transport authority (no company). */
  value: string
  companies: Company[]
  /** What the authority is called on this map — the default operator every line falls back to. */
  authorityLabel: string
  onChange: (companyId: string) => void
}

const ICON = 20

/**
 * The operator picker for a line.
 *
 * The design system's Select shows a plain text label per option, which for a set of companies
 * throws away the thing that tells them apart at a glance — their badge. This is that Select
 * rebuilt against the same tokens and sizing, with the operator's seal drawn beside its name in
 * the trigger and in every row. The authority isn't a company, but it is an operator and has a
 * seal of its own — the mark from the map — so it sits in the same slot rather than leaving a gap
 * that read as a missing answer.
 */
export function CompanySelect({ value, companies, authorityLabel, onChange }: CompanySelectProps) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = companies.find(c => c.id === value)

  const iconSlot = (company: Company | null) => (
    <span style={{ width: ICON, height: ICON, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {company ? <CompanySymbolIcon symbol={company.symbol} size={ICON} /> : <AuthoritySealIcon size={ICON} />}
    </span>
  )

  const border = focused ? 'var(--border-focus)' : 'var(--border-default)'

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
      <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: "'Barlow', system-ui, sans-serif" }}>
        Company
      </label>
      <button
        type="button"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          // The design system's field height, so this lines up with the Inputs it sits beside.
          height: '34px',
          boxSizing: 'border-box',
          padding: '0 12px',
          fontSize: '12px',
          fontFamily: "'Barlow', system-ui, sans-serif",
          color: 'var(--text-primary)',
          background: 'var(--bg-surface)',
          border: `1px solid ${border}`,
          borderRadius: '5px',
          boxShadow: focused ? '0 0 0 3px rgba(60,117,207,0.18)' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
          outline: 'none',
          transition: 'border-color 120ms ease, box-shadow 120ms ease',
        }}
      >
        {iconSlot(selected ?? null)}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.name : authorityLabel}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{ flex: '0 0 12px', color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(34px + 9px + 22px)',
            left: 0,
            right: 0,
            zIndex: 200,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
            padding: '4px 0',
            maxHeight: '240px',
            overflowY: 'auto',
          }}
        >
          <Row icon={iconSlot(null)} label={authorityLabel} active={value === ''} onSelect={() => { onChange(''); setOpen(false) }} />
          {companies.map(company => (
            <Row
              key={company.id}
              icon={iconSlot(company)}
              label={company.name}
              active={company.id === value}
              onSelect={() => {
                onChange(company.id)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ icon, label, active, onSelect }: { icon: React.ReactNode; label: string; active: boolean; onSelect: () => void }) {
  return (
    <div
      role="option"
      aria-selected={active}
      onMouseDown={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        fontSize: '12px',
        fontFamily: "'Barlow', system-ui, sans-serif",
        cursor: 'pointer',
        color: 'var(--text-primary)',
        background: active ? 'var(--color-info-bg)' : 'transparent',
        fontWeight: active ? 500 : 400,
        transition: 'background 80ms ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = active ? 'var(--color-info-bg)' : 'var(--bg-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = active ? 'var(--color-info-bg)' : 'transparent')}
    >
      {icon}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}
