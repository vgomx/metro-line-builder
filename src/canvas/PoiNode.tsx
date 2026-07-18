import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PointOfInterest } from '../types'
import { openMojiUrl } from '../openmoji'


interface PoiNodeProps {
  poi: PointOfInterest
  selected: boolean
  /** True while this landmark is being actively repositioned by a drag. */
  dragging: boolean
  /** A landing to play, or undefined for none. 'appear' is a landmark arriving from the
   * palette, which fades in as it drops; 'settle' is one that was already on the map being
   * put down somewhere else, which must not blink out and back on the way. */
  landing?: 'appear' | 'settle'
  onPointerDown: (e: ReactPointerEvent<SVGGElement>, poi: PointOfInterest) => void
}

/** Drawn size of the icon on the map, in world units. */
const ICON_SIZE = 26
/** Deliberately well under a station's 10: landmarks now sit half a square apart, so their
 * names have to pass each other — and beside the network, a landmark is a footnote. Small
 * enough that two adjacent ones don't fight, rather than adding a second placement solver. */
const LABEL_FONT_SIZE = 6.5
/** Matches StationNode's answer to the cursor, so every marker on the map swells alike. */
const HOVER_GROWTH = 1.5
const DRAG_GROWTH = 2
/** How long the marker takes to land. Paired with the ripple MapCanvas draws under it. */
const LAND_MS = 320

export function PoiNode({ poi, selected, dragging, landing, onPointerDown }: PoiNodeProps) {
  const [hovered, setHovered] = useState(false)
  const href = openMojiUrl(poi.icon)
  const grown = dragging ? DRAG_GROWTH : hovered ? HOVER_GROWTH : 0
  const size = ICON_SIZE + grown * 2
  const half = size / 2
  const name = poi.name.trim()

  return (
    <g
      transform={`translate(${poi.x}, ${poi.y})`}
      onPointerDown={e => onPointerDown(e, poi)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: dragging ? 'grabbing' : 'pointer' }}
    >
      <g
        filter={dragging ? 'url(#station-drag-shadow)' : undefined}
        style={
          landing
            ? {
                transformBox: 'fill-box',
                transformOrigin: 'center',
                animation: `${landing === 'appear' ? 'mlb-poi-land' : 'mlb-poi-settle'} ${LAND_MS}ms cubic-bezier(0.3, 1.4, 0.5, 1) both`,
              }
            : undefined
        }
      >
        {selected && (
          <rect
            x={-half - 4}
            y={-half - 4}
            width={size + 8}
            height={size + 8}
            rx={7}
            fill="none"
            stroke="var(--brand-500)"
            strokeWidth={2}
            opacity={0.5}
          />
        )}
        {/* The plate the artwork sits on, in the same surface a station's name card wears —
            themed, so it follows the canvas into dark mode rather than staying a light patch
            on it. Same opacity too, which lets a line running underneath show faintly through
            instead of being cut clean in two. */}
        <rect
          x={-half - 1}
          y={-half - 1}
          width={size + 2}
          height={size + 2}
          rx={6}
          fill="var(--bg-surface)"
          stroke="var(--border-subtle)"
          strokeWidth={1}
          opacity={0.92}
        />
        {href ? (
          <image href={href} x={-half} y={-half} width={size} height={size} style={{ pointerEvents: 'none' }} />
        ) : (
          // An icon whose asset is missing (a save from a later version, a hand-edited file)
          // still has to be visible and draggable, or it becomes an invisible obstacle.
          <rect x={-half} y={-half} width={size} height={size} rx={5} fill="var(--bg-subtle)" />
        )}
        {name && (
          <text
            y={half + 4}
            textAnchor="middle"
            dominantBaseline="hanging"
            fontSize={LABEL_FONT_SIZE}
            fontFamily="'Barlow Condensed', system-ui, sans-serif"
            fontWeight={600}
            fill="var(--text-primary)"
            stroke="var(--bg-page)"
            strokeWidth={3}
            paintOrder="stroke"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {name}
          </text>
        )}
      </g>
    </g>
  )
}
