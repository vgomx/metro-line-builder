/**
 * A station's mark, drawn to the map's own vocabulary — a circle for a metro stop, a rounded square
 * for a rail one, and a ringed target for an interchange whatever meets there.
 *
 * Shared, because it is now claimed in three places: the canvas draws it, the key explains it, and
 * the stations list identifies stops by it. Three copies of the same shapes is three chances for a
 * list to disagree with the map it is a list of, which is exactly the confusion the marks exist to
 * prevent. The canvas keeps its own drawing — its markers swell on hover, animate on landing, and
 * live in map coordinates — but the flat, static rendering belongs here.
 *
 * Colour is the caller's business: the key wants one muted ink because it explains form rather than
 * which line, while a list wants the line's own colour the way the map does.
 */
export type StationMarkKind = 'stop' | 'rail' | 'interchange'

export function StationMark({ kind, color, size = 14 }: { kind: StationMarkKind; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden style={{ flexShrink: 0, display: 'block' }}>
      {kind === 'interchange' ? (
        <>
          <circle cx="7" cy="7" r="5.5" fill="var(--bg-surface)" stroke={color} strokeWidth="2.4" />
          <circle cx="7" cy="7" r="1.9" fill={color} />
        </>
      ) : kind === 'rail' ? (
        <rect x="2.4" y="2.4" width="9.2" height="9.2" rx="3" fill="var(--bg-surface)" stroke={color} strokeWidth="2" />
      ) : (
        <circle cx="7" cy="7" r="4.5" fill="var(--bg-surface)" stroke={color} strokeWidth="2" />
      )}
    </svg>
  )
}

/**
 * Which mark a station wears, and in what ink — the same three questions the canvas answers.
 *
 * An interchange stays a circle whatever mode meets there and takes the map's ink rather than any
 * one line's colour, because black is what marks a junction out once ordinary stops stop using it.
 * A single-mode stop wears its line's colour pulled toward that ink, since several of the palette
 * fall under legible contrast against the panel on their own. A stop no line has reached yet falls
 * back to its own mode and a neutral edge.
 */
export function stationMarkKind(isInterchange: boolean, isRail: boolean): StationMarkKind {
  return isInterchange ? 'interchange' : isRail ? 'rail' : 'stop'
}

export function stationMarkColor(isInterchange: boolean, lineColor: string | undefined): string {
  if (isInterchange) return 'var(--text-primary)'
  if (!lineColor) return 'var(--border-strong)'
  return `color-mix(in srgb, ${lineColor} 68%, var(--text-primary))`
}
