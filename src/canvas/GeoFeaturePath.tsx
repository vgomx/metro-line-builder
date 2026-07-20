import type { MouseEvent } from 'react'
import type { GeoFeature, Point } from '../types'
import { buildVertices, routeOrthogonal } from './routing'
import { wrapLabel } from './labelPlacement'
import { polygonLabelAnchor } from './polygon'

interface GeoFeaturePathProps {
  feature: GeoFeature
  selected: boolean
  onClick?: (feature: GeoFeature) => void
  /** Double-clicking a river or a park is a request to rename it. */
  onDoubleClick?: (feature: GeoFeature) => void
}

const RIVER_COLOR = '#BFDBFE'
const PARK_FILL = '#DCFCE7'
const PARK_STROKE = '#86EFAC'
// Label ink is a stronger, theme-invariant tint of each feature's own color —
// like the line colors, geography reads as the same blue/green in either theme,
// so these stay literal rather than routed through the semantic token aliases.
const RIVER_LABEL = '#2563EB'
const PARK_LABEL = '#15803D'
// Wide enough for the italic name to sit inside the water band rather than perched above it.
const RIVER_STROKE_WIDTH = 20
const LABEL_WEIGHT = 400
/** Smaller than a station's 10 and well under the 12 it used to be: a park is named for
 * reference, not for reading first — the network is what the eye should land on, and green
 * ground lettering competing with station names pulls attention off it. */
const PARK_LABEL_SIZE = 8.5
const PARK_LINE_HEIGHT = 9.5
/** A park's name wraps to its own width, less a margin so the text doesn't touch the outline.
 * Narrow parks get a floor — below it the name would break to one word per line — and every
 * park gets a ceiling, so a long name wraps even when there is room to run: a single line
 * stretching the width of a large park reads as a banner laid over it, not as its name. */
const PARK_LABEL_MIN_WIDTH = 70
const PARK_LABEL_MAX_WIDTH = 140

/** Centroid of a polygon's vertices — good enough to seat a park's name near its middle. */
/**
 * Point at the halfway mark along the river's *routed* centreline — the same
 * elbow-inserted path routeOrthogonal draws, not the raw drawn segments. Sampling
 * the raw midpoint lands the label off the water wherever routing bends the band
 * away (a 45° elbow puts the true centreline at a different y than the straight
 * chord between two drawn points), so the name floats above or below the stroke.
 */
function riverLabelAnchor(points: Point[]): Point {
  const verts = buildVertices(points, false)
  const segLengths: number[] = []
  let total = 0
  for (let i = 0; i < verts.length - 1; i++) {
    const len = Math.hypot(verts[i + 1].x - verts[i].x, verts[i + 1].y - verts[i].y)
    segLengths.push(len)
    total += len
  }
  let target = total / 2
  for (let i = 0; i < segLengths.length; i++) {
    if (target <= segLengths[i]) {
      const t = segLengths[i] === 0 ? 0 : target / segLengths[i]
      return { x: verts[i].x + (verts[i + 1].x - verts[i].x) * t, y: verts[i].y + (verts[i + 1].y - verts[i].y) * t }
    }
    target -= segLengths[i]
  }
  return verts[verts.length - 1]
}

/**
 * Renders with the same 45-degree elbow routing as transit lines (see
 * routeOrthogonal), so geography reads in the same angled Tube-map idiom
 * as the lines and stations, rather than contrasting organic curves. Its name
 * (if any) is drawn as a map label — seated at the park's centre or along the
 * river — in the same condensed face the station labels use.
 */
export function GeoFeaturePath({ feature, selected, onClick, onDoubleClick }: GeoFeaturePathProps) {
  if (feature.points.length < 2) return null

  const handleDoubleClick = (e: MouseEvent<SVGPathElement>) => {
    e.stopPropagation()
    onDoubleClick?.(feature)
  }

  const handleClick = (e: MouseEvent<SVGPathElement>) => {
    e.stopPropagation()
    onClick?.(feature)
  }

  const name = feature.name.trim()

  if (feature.type === 'river') {
    const anchor = riverLabelAnchor(feature.points)
    return (
      <>
        <path
          d={routeOrthogonal(feature.points)}
          fill="none"
          stroke={RIVER_COLOR}
          strokeWidth={selected ? RIVER_STROKE_WIDTH + 2 : RIVER_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={selected ? 0.9 : 0.7}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: 'pointer' }}
        />
        {name && (
          <text
            x={anchor.x}
            y={anchor.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontFamily="'Barlow Condensed', system-ui, sans-serif"
            fontStyle="italic"
            fontWeight={LABEL_WEIGHT}
            fill={RIVER_LABEL}
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {name}
          </text>
        )}
      </>
    )
  }

  const centre = polygonLabelAnchor(feature.points)
  const parkWidth = Math.max(...feature.points.map(p => p.x)) - Math.min(...feature.points.map(p => p.x))
  const parkLines = wrapLabel(
    name.toUpperCase(),
    Math.min(PARK_LABEL_MAX_WIDTH, Math.max(PARK_LABEL_MIN_WIDTH, parkWidth - PARK_LABEL_SIZE * 2)),
    PARK_LABEL_SIZE,
    2,
  )
  return (
    <>
      <path
        d={routeOrthogonal(feature.points, true)}
        fill={PARK_FILL}
        stroke={selected ? 'var(--brand-500)' : PARK_STROKE}
        strokeWidth={selected ? 2 : 1.5}
        opacity={selected ? 0.9 : 0.7}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: 'pointer' }}
      />
      {/* Wrapped against the park's own width rather than run as one line: a park is as wide
          as it is, and a name that overruns it stops reading as the park's name and starts
          reading as something lying on top of it. Centred as a block, so two lines sit either
          side of the middle rather than hanging below it. */}
      {parkLines.length > 0 && (
        <text
          x={centre.x}
          y={centre.y - ((parkLines.length - 1) * PARK_LINE_HEIGHT) / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={PARK_LABEL_SIZE}
          fontFamily="'Barlow Condensed', system-ui, sans-serif"
          fontWeight={LABEL_WEIGHT}
          letterSpacing={0.5}
          fill={PARK_LABEL}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {parkLines.map((line, index) => (
            <tspan key={index} x={centre.x} dy={index === 0 ? 0 : PARK_LINE_HEIGHT}>
              {line}
            </tspan>
          ))}
        </text>
      )}
    </>
  )
}
