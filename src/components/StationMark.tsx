import type { StationShape } from '../types'

/**
 * A station's mark, drawn to the map's own vocabulary — a disc for a metro stop, a rounded square
 * for a rail one, a diamond for a tram one, and a ringed version of that same shape for an
 * interchange. The shape says the mode; the ring says "change here".
 *
 * Shared, because it is claimed in three places: the canvas draws it, the key explains it, and the
 * stations list identifies stops by it. Three copies of the same shapes is three chances for a list
 * to disagree with the map it is a list of, which is exactly the confusion the marks exist to
 * prevent. The canvas keeps its own drawing — its markers swell on hover, animate on landing, and
 * live in map coordinates — but the flat, static rendering belongs here.
 *
 * Colour is the caller's business: the key wants one muted ink because it explains form rather than
 * which line, while a list wants the line's own colour the way the map does.
 */

/** A stop's outline in the given shape — a page-coloured fill inside the line's-colour edge, the
 * hollow bead the map draws. Centred on (7,7) of a 14-box; the diamond is a square turned 45°. */
function ShapeMark({ shape, color, half, strokeWidth }: { shape: StationShape; color: string; half: number; strokeWidth: number }) {
  if (shape === 'square') {
    return <rect x={7 - half} y={7 - half} width={half * 2} height={half * 2} rx={Math.max(1.4, half * 0.34)} fill="var(--bg-surface)" stroke={color} strokeWidth={strokeWidth} />
  }
  if (shape === 'diamond') {
    // A square turned 45°: its corners reach `half·√2` from the centre, so the side is shrunk to
    // land the points at the same radius the disc and square fill.
    const s = half / Math.SQRT2
    return <rect x={7 - s} y={7 - s} width={s * 2} height={s * 2} rx={Math.max(1, s * 0.22)} transform="rotate(45 7 7)" fill="var(--bg-surface)" stroke={color} strokeWidth={strokeWidth} />
  }
  return <circle cx="7" cy="7" r={half} fill="var(--bg-surface)" stroke={color} strokeWidth={strokeWidth} />
}

export function StationMark({ shape, interchange = false, color, size = 14 }: { shape: StationShape; interchange?: boolean; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden style={{ flexShrink: 0, display: 'block' }}>
      {interchange ? (
        // The interchange is the mode's own shape, drawn larger and carrying a filled centre bead —
        // the "change here" target, now in the shape of the mode it changes between (or a disc when
        // two modes actually meet, since neither shape can speak for both).
        <>
          <ShapeMark shape={shape} color={color} half={5.4} strokeWidth={2.4} />
          <circle cx="7" cy="7" r="1.9" fill={color} />
        </>
      ) : (
        <ShapeMark shape={shape} color={color} half={4.5} strokeWidth={2} />
      )}
    </svg>
  )
}

/**
 * The ink a mark is drawn in.
 *
 * An interchange takes the map's ink rather than any one line's colour, because black is what marks
 * a junction out once ordinary stops stop using it. A single-mode stop wears its line's colour
 * pulled toward that ink, since several of the palette fall under legible contrast against the panel
 * on their own. A stop no line has reached yet falls back to a neutral edge.
 */
export function stationMarkColor(isInterchange: boolean, lineColor: string | undefined): string {
  if (isInterchange) return 'var(--text-primary)'
  if (!lineColor) return 'var(--border-strong)'
  return `color-mix(in srgb, ${lineColor} 68%, var(--text-primary))`
}
