import { LineIndicator } from 'metro-ds'
import type { Line } from '../types'
import { isRailLine } from '../types'
import { railInk, railRings } from './LinePill'

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

  // A white badge double-ruled in the line's colour: rings painted by box-shadow (no border, so
  // they don't grow the box), number in a fixed-dark mix of the colour so it reads on the white in
  // either theme. White throughout, so it stands the same on a light panel and on the dark
  // announcer chip alike.
  const shared = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box' as const,
    background: '#ffffff',
    color: railInk(line.color),
    boxShadow: railRings(line.color),
    fontFamily: "'Barlow Condensed', system-ui, sans-serif",
    fontWeight: 700,
    flexShrink: 0,
  }

  if (shape === 'circle') {
    const d = size === 'xs' ? 18 : 22
    return (
      <span style={{ ...shared, width: `${d}px`, height: `${d}px`, borderRadius: '50%', fontSize: size === 'xs' ? '10px' : '11px' }}>
        {line.number}
      </span>
    )
  }

  // Matched to the design system's pill indicator at each size — sm is 22px tall / 35px min wide /
  // 11px, xs is 18 / 29 / 9 — so a rail badge sits level with the metro badges beside it.
  const pill =
    size === 'xs'
      ? { minWidth: '29px', height: '18px', padding: '0 8px', fontSize: '9px' }
      : { minWidth: '35px', height: '22px', padding: '0 9px', fontSize: '11px' }
  return (
    <span style={{ ...shared, ...pill, borderRadius: '9999px', letterSpacing: '-0.01em' }}>{line.number}</span>
  )
}
