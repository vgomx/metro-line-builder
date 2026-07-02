import type { MouseEvent } from 'react'
import type { Line, Station } from '../types'
import { routeOrthogonal } from './routing'

interface LinePathProps {
  line: Line
  stations: Record<string, Station>
  selected: boolean
  onClick?: (line: Line) => void
}

/**
 * Renders as a real <path id={line.id}> with its natural pathLength intact, so a future
 * train-animation layer can call document.getElementById(line.id).getPointAtLength(...)
 * to walk a marker along it without touching this component.
 */
export function LinePath({ line, stations, selected, onClick }: LinePathProps) {
  const points = line.stationIds.map(id => stations[id]).filter((s): s is Station => Boolean(s))
  if (points.length < 2) return null

  const d = routeOrthogonal(points)

  const handleClick = (e: MouseEvent<SVGPathElement>) => {
    e.stopPropagation()
    onClick?.(line)
  }

  return (
    <path
      id={line.id}
      d={d}
      fill="none"
      stroke={line.color}
      strokeWidth={selected ? 7 : 5}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={selected ? 1 : 0.9}
      onClick={handleClick}
      style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
    />
  )
}
