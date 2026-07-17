import { useState } from 'react'
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
const HOVER_MS = 160

const STROKE_WIDTH = 5
const STROKE_WIDTH_SELECTED = 7
/**
 * How much a line thickens under the pointer. Kept to 1.5 by the fan as much as by taste: a
 * shared corridor spaces its lanes LANE_WIDTH (7) apart, so a 5px line has only 2px of air
 * either side, and swelling much past this would have a hovered line touch the one beside it.
 */
const HOVER_GROWTH = 1.5

/**
 * Renders as a real <path id={line.id}> with its natural pathLength intact, so the train
 * layer can walk a marker along it. Nodes can be real stations or bare waypoints that
 * just shape the route without stopping there.
 */
export function LinePath({ line, geometry, selected, revealing, segmentLineMap, onClick }: LinePathProps) {
  const [hovered, setHovered] = useState(false)
  const d = buildLinePath(geometry, line.id, segmentLineMap)
  if (!d) return null

  // Held back while the line sketches itself on, so the swell doesn't fight the draw-on for
  // the same stroke.
  const lifted = hovered && !revealing

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
    : ({
        // stroke-width is a presentation attribute SVG lets CSS animate, so the swell eases
        // rather than snapping. Left off during the reveal, where the animation owns the stroke.
        style: { pointerEvents: 'none' as const, transition: `stroke-width ${HOVER_MS}ms ease, opacity ${HOVER_MS}ms ease` },
      } as const)

  return (
    <>
      {/* Wider transparent hit target makes it easy to click the line precisely (e.g. to insert
          a station), and is the only part of the line that takes a pointer — so it's what the
          swell below listens to as well. Its own width never changes, so the line can't twitch
          out from under the cursor at the edge of the target. */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}
      />
      {/* Hovering thickens the line and brings it to full strength — the line itself answering
          the pointer, rather than a decoration around it. */}
      <path
        id={line.id}
        d={d}
        fill="none"
        stroke={line.color}
        strokeWidth={(selected ? STROKE_WIDTH_SELECTED : STROKE_WIDTH) + (lifted ? HOVER_GROWTH : 0)}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={selected || lifted ? 1 : 0.9}
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
