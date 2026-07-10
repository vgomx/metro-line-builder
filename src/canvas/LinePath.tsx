import type { MouseEvent } from 'react'
import type { Line } from '../types'
import type { LineGeometry } from './lineNodes'
import { buildLinePath } from './lineNodes'

interface LinePathProps {
  line: Line
  /** This line's routed vertices, already subdivided against the rest of the network. */
  geometry: LineGeometry
  selected: boolean
  /** Every subdivided segment's line ids — tells this line which lane to take in a fan. */
  segmentLineMap: Map<string, string[]>
  onClick?: (line: Line, e: MouseEvent<SVGPathElement>) => void
}

/**
 * Renders as a real <path id={line.id}> with its natural pathLength intact, so the train
 * layer can walk a marker along it. Nodes can be real stations or bare waypoints that
 * just shape the route without stopping there.
 */
export function LinePath({ line, geometry, selected, segmentLineMap, onClick }: LinePathProps) {
  const d = buildLinePath(geometry, line.id, segmentLineMap)
  if (!d) return null

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
