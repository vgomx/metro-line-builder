import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Station } from '../types'
import type { LabelPlacement } from './labelPlacement'
import { BASELINE_CENTRE, labelGeometry, LABEL_FONT_SIZE } from './labelPlacement'

interface StationNodeProps {
  station: Station
  selected: boolean
  inDraftLine: boolean
  /** True when the station sits on 2+ distinct lines — rendered as an interchange. */
  interchange: boolean
  /** The colour of the one line calling here, for a stop that serves exactly one. Interchanges
   * don't get one: black is what marks them out once the ordinary stops stop using it. */
  lineColor?: string
  /** True while this station is being actively repositioned by a drag. */
  dragging: boolean
  /** A landing to play, or undefined for none. 'appear' is a station being added, which fades
   * in as it drops; 'settle' is one that was already on the map being put down somewhere else,
   * which must not blink out and back on the way. The same two a landmark uses — everything
   * the map puts down should land the same way. */
  landing?: 'appear' | 'settle'
  /** Compass direction (away from every line touching this station) to place the name in. */
  labelPlacement: LabelPlacement
  onPointerDown: (e: ReactPointerEvent<SVGGElement>, station: Station) => void
  onClick: (station: Station) => void
  /** Double-clicking a stop is a request to rename it — the most repeated edit on a map. */
  onDoubleClick: (station: Station) => void
}

/** Matches the landmark's landing exactly — the two are the same gesture. */
const LAND_MS = 320

/** How much a marker swells while it's picked up, and while it's merely under the pointer —
 * the latter matching the line's own hover growth, so a station and the line through it
 * answer the cursor by the same amount. */
const DRAG_GROWTH = 2
const HOVER_GROWTH = 1.5

export function StationNode({
  station,
  selected,
  inDraftLine,
  interchange,
  lineColor,
  dragging,
  landing,
  labelPlacement,
  onPointerDown,
  onClick,
  onDoubleClick,
}: StationNodeProps) {
  const [hovered, setHovered] = useState(false)
  const isInterchange = interchange || station.transfer
  const baseRadius = isInterchange ? 10 : 6.5
  const radius = dragging ? baseRadius + DRAG_GROWTH : baseRadius
  // The two don't stack: a drag is a hover too, and adding both would have the marker jump
  // again at the moment it's grabbed. Picking it up is the stronger state, so it wins.
  const drawnRadius = dragging ? radius : radius + (hovered ? HOVER_GROWTH : 0)

  // Read from the same helper the placement search uses, so the card drawn here is the exact
  // box that search resolved the overlaps against.
  //
  // A main station wears its card as a nameplate: fully rounded, the pill shape LineIndicator
  // gives a named line, in neutral ink. text-primary/text-inverse rather than the fixed
  // ink-900/ink-0 the transient chips use — those are always dark because they only ever flash
  // over the map, but a plate that lives on it has to invert with the theme or it sinks into a
  // dark canvas and leaves the name floating with no plate at all.
  //
  // Nothing about the marker changes: a principal station is one the eye should find by name,
  // and the map already spends its marker vocabulary on what the lines are doing.
  const isMain = station.main
  const { labelX, labelY, cardX, cardY, cardW, cardH, lines } = labelGeometry(station, labelPlacement, isInterchange)

  return (
    <g
      transform={`translate(${station.x}, ${station.y})`}
      onPointerDown={e => onPointerDown(e, station)}
      onClick={() => onClick(station)}
      onDoubleClick={e => {
        // Kept off the svg's own double-click, which finishes a draft: this one only ever
        // means "rename this stop", so it stops here rather than reaching the canvas.
        e.stopPropagation()
        onDoubleClick(station)
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // The marker's own cursor wins over the svg's wherever the pointer is actually on it,
      // so the closed hand has to be repeated here or grabbing a station would keep showing
      // the arrow for as long as the pointer stayed on the marker it was dragging.
      style={{ cursor: dragging ? 'grabbing' : 'pointer' }}
    >
      {/* Safari doesn't reliably render CSS drop-shadow() filters on SVG content, so
          the drag shadow is a real SVG <filter> (defined once in MapCanvas) applied
          via the filter attribute — feDropShadow works across all engines. */}
      <g filter={dragging ? 'url(#station-drag-shadow)' : undefined}>
        {selected && (
          <circle
            r={drawnRadius + 5}
            fill="none"
            stroke="var(--brand-500)"
            strokeWidth={2}
            opacity={0.5}
            style={{ transition: 'r 150ms ease' }}
          />
        )}
        {/* The marker lands rather than appearing. The group's bounding box is symmetric about
            the origin, so fill-box + centre origin scales and drops it around the station. */}
        <g
          style={
            landing
              ? {
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  animation: `${landing === 'appear' ? 'mlb-marker-land' : 'mlb-marker-settle'} ${LAND_MS}ms cubic-bezier(0.3, 1.4, 0.5, 1) both`,
                }
              : undefined
          }
        >
          {isInterchange ? (
            <>
              <circle
                r={drawnRadius}
                fill={inDraftLine ? 'var(--brand-500)' : 'var(--bg-page)'}
                stroke={inDraftLine ? 'var(--brand-500)' : 'var(--text-primary)'}
                strokeWidth={3.5}
                style={{ transition: 'r 150ms ease' }}
              />
              <circle
                r={drawnRadius - 4.5}
                fill="none"
                stroke={inDraftLine ? 'var(--brand-500)' : 'var(--text-primary)'}
                strokeWidth={1.25}
                style={{ transition: 'r 150ms ease' }}
              />
            </>
          ) : (
            <circle
              r={drawnRadius}
              fill={inDraftLine ? 'var(--brand-500)' : 'var(--bg-page)'}
              // A single-line stop wears its line's colour rather than black, so the map's
              // black is spent on interchanges alone — the places where a decision is made.
              //
              // Not the raw colour, though: measured against the page, four of the ten line
              // colours fall under 2:1 in one theme or the other — yellow disappears on a light
              // page, purple and graphite on a dark one — and since the bead is a page-coloured
              // hole inside that ring, low contrast means an invisible stop. Mixing a third of
              // the ink in pulls every colour back to a legible edge while leaving the hue
              // recognisable, and because the ink is themed, the mix darkens on light pages and
              // lightens on dark ones without a second rule.
              stroke={
                inDraftLine
                  ? 'var(--brand-500)'
                  : lineColor
                    ? `color-mix(in srgb, ${lineColor} 68%, var(--text-primary))`
                    : 'var(--text-primary)'
              }
              strokeWidth={2.5}
              style={{ transition: 'r 150ms ease' }}
            />
          )}
        </g>
        {lines.length > 0 && (
          <rect
            x={cardX}
            y={cardY}
            width={cardW}
            height={cardH}
            rx={isMain ? cardH / 2 : 4}
            fill={isMain ? 'var(--text-primary)' : 'var(--bg-surface)'}
            stroke={isMain ? 'none' : 'var(--border-subtle)'}
            strokeWidth={1}
            opacity={isMain ? 1 : 0.92}
            style={{ pointerEvents: 'none' }}
          />
        )}
        {/* One tspan per wrapped line, the block centred on the card the placement search
            sized for exactly these lines. */}
        <text
          x={labelX}
          y={labelY - ((lines.length - 1) * LABEL_FONT_SIZE) / 2 + LABEL_FONT_SIZE * BASELINE_CENTRE}
          textAnchor={labelPlacement.anchor}
          fontSize={LABEL_FONT_SIZE}
          fontFamily="'Barlow Condensed', system-ui, sans-serif"
          fontWeight={isMain ? 700 : 600}
          fill={isMain ? 'var(--text-inverse)' : 'var(--text-primary)'}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {lines.map((line, index) => (
            <tspan key={index} x={labelX} dy={index === 0 ? 0 : LABEL_FONT_SIZE}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    </g>
  )
}
