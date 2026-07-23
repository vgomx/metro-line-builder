import type { CSSProperties } from 'react'

/**
 * The transport authority's seal.
 *
 * A 2×2 grid of the modes an authority runs — metro, bus, tram, ferry — which is what the mark on
 * the map has always been. It lives here rather than inline in CanvasLegend because it now appears
 * anywhere the authority is named as an operator, and an emblem drawn twice is an emblem that
 * drifts.
 *
 * Companies wear their own seal (see companySymbols); the authority is not a company, but it is an
 * operator, and leaving its name bare where every company had a mark made it read as the absence
 * of an answer rather than as an answer.
 */
export function AuthoritySealIcon({
  size = 16,
  color = 'currentColor',
  style,
}: {
  size?: number
  color?: string
  /** Merged onto the svg — the map's mark animates its own size and needs to say so. */
  style?: CSSProperties
}) {
  // The mark was drawn for the map, where it renders at 40px and up. Below about 24 a 1.6 stroke
  // lands on a fraction of a pixel and greys out, so the line weight is scaled back up rather than
  // the emblem being redrawn — same shapes, still legible in a dropdown row.
  const strokeWidth = size < 24 ? 2.4 : 1.6

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      focusable="false"
      style={{ flexShrink: 0, ...style }}
    >
      <g
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{ transition: 'stroke 150ms ease' }}
      >
        {/* Metro (train front) — top-left */}
        <rect x="3.5" y="2.5" width="9" height="10" rx="3" />
        <line x1="4.7" y1="6.4" x2="11.3" y2="6.4" />
        {/* Bus (side) — top-right */}
        <rect x="18.3" y="3.8" width="11.4" height="6.6" rx="1.6" />
        <line x1="19.3" y1="6.3" x2="28.7" y2="6.3" />
        {/* Tram (side, with overhead pole) — bottom-left */}
        <rect x="3.2" y="20.6" width="9.6" height="6.6" rx="1.6" />
        <line x1="4.1" y1="23" x2="11.9" y2="23" />
        <path d="M8 20.6 V17.8 M5.9 17.8 H10.1" />
        {/* Ferry — bottom-right (centered on the quadrant like the other three) */}
        <rect x="21.8" y="19.2" width="4.4" height="3.4" rx="0.6" />
        <path d="M18.4 22.6 H29.6 L27.6 26.6 H20.4 Z" />
        <path d="M18.9 27.8 q1.7 -1 3.4 0 t3.4 0 t3.4 0" />
      </g>
      <g fill={color} stroke="none" style={{ transition: 'fill 150ms ease' }}>
        {/* Metro headlights */}
        <circle cx="6" cy="10.2" r="0.9" />
        <circle cx="10" cy="10.2" r="0.9" />
        {/* Bus wheels */}
        <circle cx="21" cy="11.4" r="1" />
        <circle cx="27" cy="11.4" r="1" />
        {/* Tram wheels */}
        <circle cx="5.6" cy="27.9" r="1" />
        <circle cx="10.4" cy="27.9" r="1" />
      </g>
    </svg>
  )
}
