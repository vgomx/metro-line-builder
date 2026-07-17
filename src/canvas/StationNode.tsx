import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Station } from '../types'
import type { LabelPlacement } from './labelPlacement'
import { labelGeometry, LABEL_FONT_SIZE } from './labelPlacement'

interface StationNodeProps {
  station: Station
  selected: boolean
  inDraftLine: boolean
  /** True when the station sits on 2+ distinct lines — rendered as an interchange. */
  interchange: boolean
  /** True while this station is being actively repositioned by a drag. */
  dragging: boolean
  /** True for one animation cycle right after the station first appears — pops the marker in. */
  entering?: boolean
  /** Compass direction (away from every line touching this station) to place the name in. */
  labelPlacement: LabelPlacement
  onPointerDown: (e: ReactPointerEvent<SVGGElement>, station: Station) => void
  onClick: (station: Station) => void
}

const POP_MS = 300

/** How much a marker swells while it's picked up, and while it's merely under the pointer —
 * the latter matching the line's own hover growth, so a station and the line through it
 * answer the cursor by the same amount. */
const DRAG_GROWTH = 2
const HOVER_GROWTH = 1.5

export function StationNode({ station, selected, inDraftLine, interchange, dragging, entering, labelPlacement, onPointerDown, onClick }: StationNodeProps) {
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
  const name = station.name.trim()
  const { labelX, labelY, cardX, cardY, cardW, cardH } = labelGeometry(station, labelPlacement, isInterchange)

  return (
    <g
      transform={`translate(${station.x}, ${station.y})`}
      onPointerDown={e => onPointerDown(e, station)}
      onClick={() => onClick(station)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: 'pointer' }}
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
        {/* Marker circles pop in on first appearance. The group's bounding box is symmetric
            about the origin, so fill-box + centre origin scales it around the station. */}
        <g
          style={
            entering
              ? { transformBox: 'fill-box', transformOrigin: 'center', animation: `mlb-station-pop ${POP_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) both` }
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
              stroke={inDraftLine ? 'var(--brand-500)' : 'var(--text-primary)'}
              strokeWidth={2.5}
              style={{ transition: 'r 150ms ease' }}
            />
          )}
        </g>
        {name && (
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
        <text
          x={labelX}
          y={labelY}
          textAnchor={labelPlacement.anchor}
          dominantBaseline="middle"
          fontSize={LABEL_FONT_SIZE}
          fontFamily="'Barlow Condensed', system-ui, sans-serif"
          fontWeight={isMain ? 700 : 600}
          fill={isMain ? 'var(--text-inverse)' : 'var(--text-primary)'}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {station.name}
        </text>
      </g>
    </g>
  )
}
