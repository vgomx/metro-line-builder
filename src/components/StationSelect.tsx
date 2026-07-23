import { useEffect, useRef, useState } from 'react'
import { LineIndicator } from 'metro-ds'
import type { Line, Station } from '../types'

interface StationSelectProps {
  label: string
  value: string | null
  stationList: Station[]
  /** Every line calling at a station, in list order — the numbers shown beside its name. */
  linesByStation: Map<string, Line[]>
  onChange: (stationId: string | null) => void
}

/** The design system's field height: it borders a wrapper around the 32px input, not the input. */
const FIELD_HEIGHT = 34

/**
 * The station picker for a journey.
 *
 * Like CompanySelect, this is the design system's Select rebuilt against the same tokens, and for
 * the same reason: its options are plain strings, and a station's lines are the one thing that
 * tells two similarly-named stops apart. Written out as text — "Ambleside (1, 2, 3)" — the numbers
 * lose the colour that makes them readable at a glance on a metro map, which is most of what a
 * line number is for.
 */
export function StationSelect({ label, value, stationList, linesByStation, onChange }: StationSelectProps) {
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

  const sorted = [...stationList].sort((a, b) =>
    (a.name.trim() || 'Unnamed station').localeCompare(b.name.trim() || 'Unnamed station'),
  )
  const selected = value ? stationList.find(s => s.id === value) ?? null : null
  const border = focused ? 'var(--border-focus)' : 'var(--border-default)'

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
      <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: "'Barlow', system-ui, sans-serif" }}>
        {label}
      </label>
      <button
        type="button"
        className="mlb-field-btn"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected ? selected.name.trim() || 'Unnamed station' : 'no station picked'}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: `${FIELD_HEIGHT}px`,
          boxSizing: 'border-box',
          padding: '0 10px',
          fontSize: '12px',
          fontFamily: "'Barlow', system-ui, sans-serif",
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
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
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.name.trim() || 'Unnamed station' : 'Pick a station…'}
        </span>
        {selected && <LineNumbers lines={linesByStation.get(selected.id) ?? []} />}
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
            top: `calc(${FIELD_HEIGHT}px + 9px + 22px)`,
            left: 0,
            right: 0,
            zIndex: 200,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
            padding: '4px 0',
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          {sorted.map(station => (
            <div
              key={station.id}
              role="option"
              aria-selected={station.id === value}
              onMouseDown={() => {
                onChange(station.id)
                setOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                fontFamily: "'Barlow', system-ui, sans-serif",
                cursor: 'pointer',
                color: 'var(--text-primary)',
                background: station.id === value ? 'var(--color-info-bg)' : 'transparent',
                fontWeight: station.id === value ? 500 : 400,
                transition: 'background 80ms ease',
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.background = station.id === value ? 'var(--color-info-bg)' : 'var(--bg-subtle)')
              }
              onMouseLeave={e =>
                (e.currentTarget.style.background = station.id === value ? 'var(--color-info-bg)' : 'transparent')
              }
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {station.name.trim() || 'Unnamed station'}
              </span>
              <LineNumbers lines={linesByStation.get(station.id) ?? []} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The lines calling at a station, as the badges a rider reads them by.
 *
 * Capped, because a big interchange would otherwise push the station's own name out of the row —
 * and the name is what's being chosen. The overflow is counted rather than dropped silently, so a
 * station never looks less connected than it is.
 */
function LineNumbers({ lines }: { lines: Line[] }) {
  if (lines.length === 0) return null
  const shown = lines.slice(0, 4)
  const extra = lines.length - shown.length
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
      {shown.map(line => (
        <LineIndicator key={line.id} id={String(line.number)} color={line.color} shape="circle" size="xs" />
      ))}
      {extra > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{extra}</span>}
    </span>
  )
}
