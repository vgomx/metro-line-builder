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

/**
 * Shifts each segment sideways by its own lane amount and places every interior
 * vertex at the intersection of the two adjacent shifted segments — the classic
 * variable-offset polyline construction. This keeps exactly one output vertex per
 * input vertex and preserves each segment's direction exactly, so the fillet pass
 * downstream sees clean corners and can apply its normal radius. (Earlier attempts
 * that averaged or duplicated points at a lane merge/split created clusters of
 * near-coincident vertices, which capped the fillet radius at ~1px there and made
 * those corners look sharp.)
 */
function offsetPolyline(vertices: Point[], offsets: number[]): Point[] {
  const n = vertices.length
  if (n < 2) return vertices

  const dirs: Point[] = []
  const norms: Point[] = []
  for (let i = 0; i < n - 1; i++) {
    const dx = vertices[i + 1].x - vertices[i].x
    const dy = vertices[i + 1].y - vertices[i].y
    const len = Math.hypot(dx, dy) || 1
    dirs.push({ x: dx / len, y: dy / len })
    norms.push({ x: -dy / len, y: dx / len })
  }

  const out: Point[] = [
    { x: vertices[0].x + norms[0].x * offsets[0], y: vertices[0].y + norms[0].y * offsets[0] },
  ]
  for (let i = 1; i < n - 1; i++) {
    // Endpoints of the two shifted segments meeting at this vertex.
    const a = { x: vertices[i].x + norms[i - 1].x * offsets[i - 1], y: vertices[i].y + norms[i - 1].y * offsets[i - 1] }
    const b = { x: vertices[i].x + norms[i].x * offsets[i], y: vertices[i].y + norms[i].y * offsets[i] }
    const denom = dirs[i - 1].x * dirs[i].y - dirs[i - 1].y * dirs[i].x
    if (Math.abs(denom) < 1e-9) {
      // Collinear segments: no intersection. Equal offsets need only one point;
      // an offset change along a straight run becomes a short perpendicular jog.
      if (Math.abs(offsets[i - 1] - offsets[i]) < 1e-9) out.push(a)
      else out.push(a, b)
    } else {
      const t = ((b.x - a.x) * dirs[i].y - (b.y - a.y) * dirs[i].x) / denom
      out.push({ x: a.x + dirs[i - 1].x * t, y: a.y + dirs[i - 1].y * t })
    }
  }
  const last = n - 1
  out.push({
    x: vertices[last].x + norms[last - 1].x * offsets[last - 1],
    y: vertices[last].y + norms[last - 1].y * offsets[last - 1],
  })
  return out
}

function buildLanePath(vertices: Point[], lineId: string, segmentLineMap: Map<string, string[]>): string {
  const offsets = computeLaneOffsets(vertices, lineId, segmentLineMap)
  return routeOrthogonal(offsetPolyline(vertices, offsets))
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
