import { useEffect, useRef, useState } from 'react'
import { LINE_COLORS } from '../lineColors'

/** The height of a metro-ds field's visible box: it borders a wrapper around the 32px input, so
 * anything sitting beside one has to be 34 to line up. */
const FIELD_HEIGHT = 34

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
          // Square, at the height of the field's *visible* box beside it. The design system's
          // Input draws its border on a wrapper around the 32px input, so the box to match is 34.
          width: `${FIELD_HEIGHT}px`,
          height: `${FIELD_HEIGHT}px`,
          boxSizing: 'border-box',
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
            top: `${FIELD_HEIGHT + 6}px`,
            // Hung from the right, since the chip now sits at the right end of its row.
            right: 0,
            zIndex: 60,
            width: '212px',
            boxSizing: 'border-box',
            padding: '10px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Four to a row, each tile taking an equal share of the width and squared off by its
              aspect ratio — so the palette fills the popover instead of huddling in a corner, and
              the tiles are big enough to tell two dark blues apart. Sized by fraction rather than
              pixels, which also means a touchscreen needs no special case: they're already well
              past a comfortable tap target. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {/* The ten are the palette a transit map is usually drawn from — distinguishable from
                each other and from the page in both themes. The custom swatch is last because it's
                the exception: a colour nobody vetted, which is the map-maker's right and risk. */}
            {LINE_COLORS.map(color => (
              <button
                key={color}
                type="button"
                aria-label={`Set line color ${color}`}
                onClick={() => {
                  onChange(color)
                  setOpen(false)
                }}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: 'var(--radius-md)',
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
              style={{
                width: '100%',
                aspectRatio: '1',
                boxSizing: 'border-box',
                borderRadius: 'var(--radius-md)',
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
