import type { MouseEvent } from 'react'
import type { GeoFeature, Point } from '../types'
import { buildVertices, routeOrthogonal } from './routing'

interface GeoFeaturePathProps {
  feature: GeoFeature
  selected: boolean
  onClick?: (feature: GeoFeature) => void
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

/** Centroid of a polygon's vertices — good enough to seat a park's name near its middle. */
function verticesCentroid(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}

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
export function GeoFeaturePath({ feature, selected, onClick }: GeoFeaturePathProps) {
  if (feature.points.length < 2) return null

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
          style={{ cursor: 'pointer' }}
        />
        {name && (
          <text
            x={anchor.x}
            y={anchor.y}
            textAnchor="middle"
            dominantBaseline="middle"
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

  const centre = verticesCentroid(feature.points)
  return (
    <>
      <path
        d={routeOrthogonal(feature.points, true)}
        fill={PARK_FILL}
        stroke={selected ? 'var(--brand-500)' : PARK_STROKE}
        strokeWidth={selected ? 2 : 1.5}
        opacity={selected ? 0.9 : 0.7}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      />
      {name && (
        <text
          x={centre.x}
          y={centre.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={12}
          fontFamily="'Barlow Condensed', system-ui, sans-serif"
          fontWeight={LABEL_WEIGHT}
          letterSpacing={0.5}
          fill={PARK_LABEL}
          style={{ userSelect: 'none', pointerEvents: 'none', textTransform: 'uppercase' }}
        >
          {name.toUpperCase()}
        </text>
      )}
    </>
  )
}
