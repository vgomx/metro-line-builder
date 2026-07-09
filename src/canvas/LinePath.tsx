import type { MouseEvent } from 'react'
import type { Line, Point, Station } from '../types'
import { routeOrthogonal } from './routing'
import { computeLaneOffsets, offsetPolyline, resolveLineVertices } from './lineNodes'

interface LinePathProps {
  line: Line
  stations: Record<string, Station>
  selected: boolean
  /** Every visible line's routed vertices, keyed by endpoint coordinates — tells this
   * line which other lines it shares a route with, so it can fan out into its own lane. */
  segmentLineMap: Map<string, string[]>
  onClick?: (line: Line, e: MouseEvent<SVGPathElement>) => void
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
