import type { Line } from '../types'
import { isRailLine, lineCode } from '../types'
import { railInk, railRings } from './LinePill'

/**
 * A line's code, wearing its colour — the small badge the lists and pickers identify a line by.
 *
 * A capsule, always — a rounded stadium wider than it is tall, so a two-character code and a
 * three-character one (M1, R10) read as the same shape at different widths rather than a disc that
 * suddenly stretches. The rounded ends carry the code however long it runs; nothing is ever clipped.
 *
 * Metro fills the capsule solid, its digit in whichever of black or white reads on the colour. Rail
 * leaves it white and double-rules it in the line's colour — the badge's echo of the double track —
 * because numbering runs per kind, so a metro M-code and a rail R-code can share a number and the
 * fill is what tells them apart at a glance, the letter what tells them apart in a sentence.
 *
 * `pill` is the roomier stadium for rows with space to give; `circle` the compact one the dense
 * lists use — same capsule, a tighter floor.
 */

/** Black or white, whichever reads on the fill — the luma split the design system's own indicator
 * uses, brought here so the badge can size itself to the code rather than lean on a fixed width. */
function readableInkOn(color: string): string {
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#111111' : '#FFFFFF'
}

export function LineBadge({ line, shape, size }: { line: Line; shape: 'pill' | 'circle'; size: 'sm' | 'xs' }) {
  const height = size === 'sm' ? 22 : 18
  const fontSize = size === 'sm' ? 11 : 9
  // Both shapes are stadiums, wider than tall; the pill just gives the code more room around it.
  // A floor wide enough that every short code lands on the same width, so a row of them reads even —
  // kept trim so a busy interchange can line up five of them without crowding the name.
  const minWidth = Math.round(height * (shape === 'pill' ? 1.6 : 1.35))

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box' as const,
    height: `${height}px`,
    minWidth: `${minWidth}px`,
    padding: '0 4px',
    borderRadius: '9999px',
    fontFamily: "'Barlow Condensed', system-ui, sans-serif",
    fontWeight: 700,
    fontSize: `${fontSize}px`,
    letterSpacing: '-0.01em',
    flexShrink: 0,
  }

  if (isRailLine(line)) {
    return <span style={{ ...base, background: '#ffffff', color: railInk(line.color), boxShadow: railRings(line.color) }}>{lineCode(line)}</span>
  }
  return <span style={{ ...base, background: line.color, color: readableInkOn(line.color) }}>{lineCode(line)}</span>
}

/**
 * The "and more" badge — a +N in the same capsule as the line badges, but uncoloured, since it
 * stands for lines rather than being one. It ends a truncated row of badges: a busy interchange
 * shows a handful and then this, rather than a wall of them crowding the name off its own row.
 */
export function MoreLinesBadge({ count, size = 'xs' }: { count: number; size?: 'sm' | 'xs' }) {
  const height = size === 'sm' ? 22 : 18
  const fontSize = size === 'sm' ? 11 : 9
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        height: `${height}px`,
        minWidth: `${Math.round(height * 1.35)}px`,
        padding: '0 4px',
        borderRadius: '9999px',
        fontFamily: "'Barlow Condensed', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: `${fontSize}px`,
        letterSpacing: '-0.01em',
        background: 'var(--bg-subtle)',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-default)',
        flexShrink: 0,
      }}
    >
      +{count}
    </span>
  )
}
