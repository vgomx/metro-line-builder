import type { MouseEvent } from 'react'
import type { Line } from '../types'
import type { LineGeometry } from './lineNodes'
import { buildLinePath } from './lineNodes'

interface LinePathProps {
  line: Line
  /** This line's routed vertices, already subdivided against the rest of the network. */
  geometry: LineGeometry
  selected: boolean
  /** True for one animation cycle right after the line first appears — draws its stroke on. */
  revealing?: boolean
  /** Every subdivided segment's line ids — tells this line which lane to take in a fan. */
  segmentLineMap: Map<string, string[]>
  onClick?: (line: Line, e: MouseEvent<SVGPathElement>) => void
}

const REVEAL_MS = 620

/**
 * Renders as a real <path id={line.id}> with its natural pathLength intact, so the train
 * layer can walk a marker along it. Nodes can be real stations or bare waypoints that
 * just shape the route without stopping there.
 */
export function LinePath({ line, geometry, selected, revealing, segmentLineMap, onClick }: LinePathProps) {
  const d = buildLinePath(geometry, line.id, segmentLineMap)
  if (!d) return null

  const handleClick = (e: MouseEvent<SVGPathElement>) => {
    e.stopPropagation()
    onClick?.(line, e)
  }

  // Normalise the dash to the path's own length so the draw-on works at any scale, then
  // sweep the dash offset from covered to revealed. The animation fills forwards, so the
  // line stays fully drawn once `revealing` clears and the dash props drop away.
  const revealProps = revealing
    ? ({
        pathLength: 1,
        strokeDasharray: '1 1',
        style: { pointerEvents: 'none' as const, animation: `mlb-line-draw ${REVEAL_MS}ms ease forwards` },
      } as const)
    : ({ style: { pointerEvents: 'none' as const } } as const)

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
        {...revealProps}
      />
      {/* Selected line reads as "live": a faint highlight streams along it. Skipped
          during the draw-on so the two animations don't fight for the same stroke. */}
      {selected && !revealing && (
        <path
          d={d}
          fill="none"
          stroke="rgba(255, 255, 255, 0.6)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="1.5 26.5"
          style={{ pointerEvents: 'none', animation: 'mlb-line-flow 1.6s linear infinite' }}
        />
      )}
    </>
  )
}
