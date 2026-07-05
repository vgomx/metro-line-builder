import type { MouseEvent } from 'react'
import type { Line, Point, Station } from '../types'
import { routeOrthogonal } from './routing'
import { computeLaneOffsets, resolveLineVertices } from './lineNodes'

interface LinePathProps {
  line: Line
  stations: Record<string, Station>
  selected: boolean
  /** Every visible line's routed vertices, keyed by endpoint coordinates — tells this
   * line which other lines it shares a route with, so it can fan out into its own lane. */
  segmentLineMap: Map<string, string[]>
  onClick?: (line: Line, e: MouseEvent<SVGPathElement>) => void
}

function unitPerp(a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: -dy / len, y: dx / len }
}

/**
 * Offsets a single vertex perpendicular to the path, mitering the incoming/outgoing
 * segment directions at an interior vertex instead of translating along one
 * direction derived from the whole path's start/end chord. A single-direction
 * translation only stays a constant visual width from the original path when it's
 * straight; across a bend it drifts, which is what made fanned-out parallel lines
 * look unevenly spaced near corners.
 */
function offsetVertex(vertices: Point[], i: number, amount: number): Point {
  const p = vertices[i]
  if (amount === 0) return p
  const prev = vertices[i - 1]
  const next = vertices[i + 1]
  const perpIn = prev ? unitPerp(prev, p) : null
  const perpOut = next ? unitPerp(p, next) : null
  if (perpIn && perpOut) {
    const sumX = perpIn.x + perpOut.x
    const sumY = perpIn.y + perpOut.y
    const sumLen = Math.hypot(sumX, sumY)
    // Anti-parallel perpendiculars (a straight 180° reversal) can't be mitered —
    // fall back to the incoming direction rather than divide by ~0.
    if (sumLen < 1e-6) return { x: p.x + perpIn.x * amount, y: p.y + perpIn.y * amount }
    const cosTheta = perpIn.x * perpOut.x + perpIn.y * perpOut.y
    const miterScale = Math.sqrt(2 / (1 + cosTheta))
    return { x: p.x + (sumX / sumLen) * miterScale * amount, y: p.y + (sumY / sumLen) * miterScale * amount }
  }
  const perp = (perpIn ?? perpOut)!
  return { x: p.x + perp.x * amount, y: p.y + perp.y * amount }
}

/**
 * Offsets every vertex of the line by its lane amount and rounds the whole thing in
 * one pass, so a corner keeps a single smooth fillet regardless of whether it's a
 * real bend or a point where sharing starts/stops. A vertex sitting between two
 * segments with different lane amounts (a merge/split point, often a bare waypoint
 * rather than a station) uses their average instead of either one outright — easing
 * the offset across that single vertex instead of jumping, which is what previously
 * produced a duplicate point right next to a real corner and pinched the fillet.
 */
function buildLanePath(vertices: Point[], lineId: string, segmentLineMap: Map<string, string[]>): string {
  const segmentOffsets = computeLaneOffsets(vertices, lineId, segmentLineMap)
  const offsetVertices = vertices.map((_, i) => {
    const before = i > 0 ? segmentOffsets[i - 1] : undefined
    const after = i < segmentOffsets.length ? segmentOffsets[i] : undefined
    const amount = before === undefined ? after! : after === undefined ? before : (before + after) / 2
    return offsetVertex(vertices, i, amount)
  })
  return routeOrthogonal(offsetVertices)
}

/**
 * Renders as a real <path id={line.id}> with its natural pathLength intact, so a future
 * train-animation layer can call document.getElementById(line.id).getPointAtLength(...)
 * to walk a marker along it without touching this component. Nodes can be real stations
 * or bare waypoints that just shape the route without stopping there.
 */
export function LinePath({ line, stations, selected, segmentLineMap, onClick }: LinePathProps) {
  const vertices = resolveLineVertices(line.nodes, stations)
  if (vertices.length < 2) return null

  const d = buildLanePath(vertices, line.id, segmentLineMap)

  const handleClick = (e: MouseEvent<SVGPathElement>) => {
    e.stopPropagation()
    onClick?.(line, e)
  }

  return (
    <>
      {/* Wider transparent hit target makes it easy to click the line precisely (e.g. to insert a station). */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={16} onClick={handleClick} style={{ cursor: 'pointer' }} />
      <path
        id={line.id}
        d={d}
        fill="none"
        stroke={line.color}
        strokeWidth={selected ? 7 : 5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={selected ? 1 : 0.9}
        style={{ pointerEvents: 'none' }}
      />
    </>
  )
}
