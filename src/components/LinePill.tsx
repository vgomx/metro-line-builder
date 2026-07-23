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
    // A white pill double-ruled in the line's colour — the pill's echo of the double track. The
    // rings are painted entirely by box-shadow, not a border, so they take no layout space and the
    // rail pill stands exactly as tall as the filled metro one beside it. The name is the line's
    // colour pulled toward a fixed ink so the pale ones (yellow above all) stay legible on the
    // white, and fixed rather than themed because the ground is always white now, in either mode.
    return (
      <span
        style={{
          ...base,
          background: '#ffffff',
          color: railInk(line.color),
          boxShadow: railRings(line.color),
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

/** The line's colour pulled dark enough to read as text on the white rail badge, in either theme. */
export function railInk(color: string): string {
  return `color-mix(in srgb, ${color} 70%, #18181b)`
}

/** Two concentric rings in the line's colour with a white gap, painted by box-shadow so they add
 * no height — the rail badge stays level with the metro one. */
export function railRings(color: string): string {
  return `inset 0 0 0 1px ${color}, inset 0 0 0 2px #ffffff, inset 0 0 0 3px ${color}`
}
