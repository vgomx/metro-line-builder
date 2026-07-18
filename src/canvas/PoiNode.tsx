import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PointOfInterest } from '../types'
import { openMojiUrl } from '../openmoji'
import { LABEL_FONT_SIZE } from './labelPlacement'

interface PoiNodeProps {
  poi: PointOfInterest
  selected: boolean
  /** True while this landmark is being actively repositioned by a drag. */
  dragging: boolean
  onPointerDown: (e: ReactPointerEvent<SVGGElement>, poi: PointOfInterest) => void
}

/** Drawn size of the icon on the map, in world units. */
const ICON_SIZE = 26
/** Matches StationNode's answer to the cursor, so every marker on the map swells alike. */
const HOVER_GROWTH = 1.5
const DRAG_GROWTH = 2

export function PoiNode({ poi, selected, dragging, onPointerDown }: PoiNodeProps) {
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
      <g filter={dragging ? 'url(#station-drag-shadow)' : undefined}>
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
