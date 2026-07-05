import type { MouseEvent } from 'react'
import type { Line, Point, Station } from '../types'
import { routeOrthogonal } from './routing'
import { computeLaneOffsets, resolveLineNodes } from './lineNodes'

interface LinePathProps {
  line: Line
  stations: Record<string, Station>
  selected: boolean
  /** Every visible line's segments, keyed by endpoint coordinates — tells this line
   * which other lines it shares a route with, so it can fan out into its own lane. */
  segmentLineMap: Map<string, string[]>
  onClick?: (line: Line, e: MouseEvent<SVGPathElement>) => void
}

function offsetPoints(points: Point[], amount: number): Point[] {
  if (amount === 0) return points
  const a = points[0]
  const b = points[points.length - 1]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ox = (-dy / len) * amount
  const oy = (dx / len) * amount
  return points.map(p => ({ x: p.x + ox, y: p.y + oy }))
}

/**
 * Builds the path in runs of consecutive segments that share the same lane offset,
 * rather than one offset per tiny segment — that keeps routeOrthogonal's corner
 * rounding intact within each run, only "breaking" the path where lines actually
 * merge or diverge from a shared route. The perpendicular direction for a run comes
 * from its first segment, which is exact for straight shared corridors (the common
 * case, e.g. Circle/District/Hammersmith & City running side by side) and a close
 * approximation if a shared run itself bends partway through.
 */
function buildLanePath(points: Point[], lineId: string, segmentLineMap: Map<string, string[]>): string {
  const offsets = computeLaneOffsets(points, lineId, segmentLineMap)

  const parts: string[] = []
  let runStart = 0
  for (let i = 1; i <= offsets.length; i++) {
    if (i < offsets.length && offsets[i] === offsets[runStart]) continue
    const runPoints = points.slice(runStart, i + 1)
    parts.push(routeOrthogonal(offsetPoints(runPoints, offsets[runStart])))
    runStart = i
  }
  return parts.join(' ')
}

/**
 * Renders as a real <path id={line.id}> with its natural pathLength intact, so a future
 * train-animation layer can call document.getElementById(line.id).getPointAtLength(...)
 * to walk a marker along it without touching this component. Nodes can be real stations
 * or bare waypoints that just shape the route without stopping there.
 */
export function LinePath({ line, stations, selected, segmentLineMap, onClick }: LinePathProps) {
  const points = resolveLineNodes(line.nodes, stations)
  if (points.length < 2) return null

  const d = buildLanePath(points, line.id, segmentLineMap)

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
