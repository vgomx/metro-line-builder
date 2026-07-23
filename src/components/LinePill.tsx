import type { CSSProperties } from 'react'
import type { Line } from '../types'
import { isRailLine } from '../types'

/**
 * A line, named, wearing its own colour.
 *
 * Pill-shaped, because that is how a line is drawn everywhere else it appears — the badge that
 * follows the selection on the canvas, the indicator in the lists, the route tag in a journey's
 * legs.
 *
 * Metro fills the pill solid; rail leaves it unfilled and runs two coloured rails through it, the
 * same double-track it draws on the map. The distinction has to survive per-type numbering, where
 * a metro Line 1 and a rail Line 1 both exist — the fill is what tells them apart at a glance, not
 * the number.
 *
 * It also carries the naming fallback the rest of the app uses: a line whose name has been cleared
 * still has a number, so a nameless line reads as "Line 4" rather than a blank swatch of colour.
 *
 * `sm` is for sitting inline in a sentence of other text (a leg's "3 stops · 8 min"); `md` for a
 * wrapped row of lines that are the content rather than an annotation on it.
 */
export function LinePill({ line, size = 'md' }: { line: Line; size?: 'sm' | 'md' }) {
  const small = size === 'sm'
  const label = line.name.trim() || `Line ${line.number}`

  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    // A radius larger than the pill can be resolves to exactly half its height, keeping the ends
    // round at any size without the number being kept in step.
    borderRadius: '999px',
    whiteSpace: 'nowrap',
    fontFamily: "'Barlow', system-ui, sans-serif",
    fontSize: small ? '11px' : '12px',
    fontWeight: 600,
    lineHeight: 1.4,
    padding: small ? '1px 8px' : '3px 10px',
  }

  if (isRailLine(line)) {
    // Unfilled and double-ruled — two concentric outlines in the line's colour, the pill's own
    // echo of the double track. The colour is pulled toward the ink so the pale ones (yellow above
    // all) stay legible on the panel, and the same tone rules and letters the pill so it reads as
    // one object in the line's hue. The inner ring is a surface gap plus a colour ring, layered
    // inside the border by box-shadow, so the digit or name in the middle stays perfectly crisp.
    const ink = `color-mix(in srgb, ${line.color} 68%, var(--text-primary))`
    return (
      <span
        style={{
          ...base,
          // A little more room than the filled pill, so the label clears the inner ring painted
          // into the padding rather than sitting on top of it.
          padding: small ? '2px 10px' : '4px 12px',
          background: 'var(--bg-surface)',
          color: ink,
          border: `1.5px solid ${ink}`,
          boxShadow: `inset 0 0 0 1.5px var(--bg-surface), inset 0 0 0 3px ${ink}`,
        }}
      >
        {label}
      </span>
    )
  }

  return (
    <span style={{ ...base, background: line.color, color: '#fff' }}>{label}</span>
  )
}
