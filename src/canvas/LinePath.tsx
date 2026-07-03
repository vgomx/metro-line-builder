import type { MouseEvent } from 'react'
import type { Line, Station } from '../types'
import { routeOrthogonal } from './routing'
import { resolveLineNodes } from './lineNodes'

interface LinePathProps {
  line: Line
  stations: Record<string, Station>
  selected: boolean
  onClick?: (line: Line, e: MouseEvent<SVGPathElement>) => void
}

/**
 * Renders as a real <path id={line.id}> with its natural pathLength intact, so a future
 * train-animation layer can call document.getElementById(line.id).getPointAtLength(...)
 * to walk a marker along it without touching this component. Nodes can be real stations
 * or bare waypoints that just shape the route without stopping there.
 */
export function LinePath({ line, stations, selected, onClick }: LinePathProps) {
  const points = resolveLineNodes(line.nodes, stations)
  if (points.length < 2) return null

  const d = routeOrthogonal(points)

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
