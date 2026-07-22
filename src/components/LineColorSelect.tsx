import { useEffect, useRef, useState } from 'react'
import { LINE_COLORS } from '../lineColors'

const SWATCH = 22

/**
 * The line's colour, as a single chip that opens the palette.
 *
 * It used to be eleven swatches laid out permanently in the panel — the largest block up there,
 * for something set once and rarely revisited. Folded into a chip, it costs one row beside the
 * name (and shows the current colour, which the open grid only did by an outline), while the full
 * palette is one tap away.
 */
export function LineColorSelect({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const custom = !LINE_COLORS.includes(value)

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        aria-label="Line colour"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'block',
          width: '28px',
          height: '28px',
          padding: 0,
          background: value,
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
        }}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '32px',
            left: 0,
            zIndex: 60,
            width: '150px',
            boxSizing: 'border-box',
            padding: '8px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Wrapped rather than a fixed grid: on a touchscreen the swatches grow to 32px and
              need to re-flow rather than overrun the popover. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {/* The ten are the palette a transit map is usually drawn from — distinguishable from
                each other and from the page in both themes. The custom swatch is last because it's
                the exception: a colour nobody vetted, which is the map-maker's right and risk. */}
            {LINE_COLORS.map(color => (
              <button
                key={color}
                type="button"
                className="mlb-swatch"
                aria-label={`Set line color ${color}`}
                onClick={() => {
                  onChange(color)
                  setOpen(false)
                }}
                style={{
                  width: `${SWATCH}px`,
                  height: `${SWATCH}px`,
                  borderRadius: 'var(--radius-sm)',
                  background: color,
                  border: 'none',
                  cursor: 'pointer',
                  outline: value === color ? `2px solid ${color}` : 'none',
                  outlineOffset: '2px',
                  transition: 'outline 100ms ease',
                }}
              />
            ))}
            {/* Stays open while the native picker is used — it fires as the user drags. */}
            <label
              className="mlb-swatch"
              style={{
                width: `${SWATCH}px`,
                height: `${SWATCH}px`,
                borderRadius: 'var(--radius-sm)',
                border: custom ? 'none' : '1px dashed var(--border-strong)',
                outline: custom ? `2px solid ${value}` : 'none',
                outlineOffset: '2px',
                background: custom ? value : 'conic-gradient(#C62828, #F9A825, #2E7D32, #0277BD, #6A1B9A, #C62828)',
                cursor: 'pointer',
                display: 'block',
                overflow: 'hidden',
              }}
            >
              <input
                type="color"
                aria-label="Custom line colour"
                value={value}
                onChange={e => onChange(e.target.value.toUpperCase())}
                style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', display: 'block' }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
