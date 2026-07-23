import { LineIndicator } from 'metro-ds'
import type { Line } from '../types'
import { isRailLine } from '../types'

/**
 * A line's number, wearing its colour — the small badge the lists and pickers identify a line by.
 *
 * Metro stays the design system's solid indicator, untouched. Rail is the reason this wraps it:
 * once numbering is per-type, a metro Line 1 and a rail Line 1 both exist, and a solid badge alone
 * can't tell them apart. So rail is unfilled and double-ruled — two concentric outlines in the
 * line's colour, the badge's echo of the double track — with the digit crisp in the middle. The
 * inner ring is painted, not laid out (a surface gap then a colour ring, via box-shadow), so the
 * number never has to share space with it.
 */
export function LineBadge({ line, shape, size }: { line: Line; shape: 'pill' | 'circle'; size: 'sm' | 'xs' }) {
  if (!isRailLine(line)) {
    return <LineIndicator id={String(line.number)} color={line.color} shape={shape} size={size} />
  }

  const ink = `color-mix(in srgb, ${line.color} 68%, var(--text-primary))`
  const shared = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box' as const,
    background: 'var(--bg-surface)',
    color: ink,
    border: `1.5px solid ${ink}`,
    boxShadow: `inset 0 0 0 1.5px var(--bg-surface), inset 0 0 0 3px ${ink}`,
    fontFamily: "'Barlow Condensed', system-ui, sans-serif",
    fontWeight: 700,
    flexShrink: 0,
  }

  if (shape === 'circle') {
    const d = size === 'xs' ? 16 : 20
    return (
      <span style={{ ...shared, width: `${d}px`, height: `${d}px`, borderRadius: '50%', fontSize: size === 'xs' ? '9px' : '11px' }}>
        {line.number}
      </span>
    )
  }

  // Matched to the design system's pill indicator (height, min-width, font) so a rail badge sits
  // level with the metro badges beside it in the list.
  return (
    <span style={{ ...shared, minWidth: '29px', height: '18px', padding: '0 8px', borderRadius: '9999px', fontSize: '9px', letterSpacing: '-0.09px' }}>
      {line.number}
    </span>
  )
}
