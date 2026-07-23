import type { Line } from '../types'

/**
 * A line, named, wearing its own colour.
 *
 * Pill-shaped, because that is how a line is drawn everywhere else it appears — the badge that
 * follows the selection on the canvas, the indicator in the lists, the route tag in a journey's
 * legs. The Inspector was the one place still showing them as square-cornered tags.
 *
 * It also carries the naming fallback the rest of the app uses. A line whose name has been cleared
 * still has a number, and the two Inspector lists that this replaces rendered the raw name — so a
 * nameless line appeared as a blank swatch of colour with nothing to identify it.
 *
 * `sm` is for sitting inline in a sentence of other text (a leg's "3 stops · 8 min"); `md` for a
 * wrapped row of lines that are the content rather than an annotation on it.
 */
export function LinePill({ line, size = 'md' }: { line: Line; size?: 'sm' | 'md' }) {
  const small = size === 'sm'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        // A radius larger than the pill can be resolves to exactly half its height, which is what
        // keeps the ends round at any size without the number having to be kept in step.
        borderRadius: '999px',
        background: line.color,
        color: '#fff',
        whiteSpace: 'nowrap',
        fontFamily: "'Barlow', system-ui, sans-serif",
        fontSize: small ? '11px' : '12px',
        fontWeight: 600,
        lineHeight: 1.4,
        padding: small ? '1px 8px' : '3px 10px',
      }}
    >
      {line.name.trim() || `Line ${line.number}`}
    </span>
  )
}
