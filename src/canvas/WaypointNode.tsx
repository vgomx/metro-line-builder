import type { MouseEvent as ReactMouseEvent } from 'react'

interface WaypointNodeProps {
  x: number
  y: number
  color: string
  selected: boolean
  onClick: (e: ReactMouseEvent<SVGRectElement>) => void
}

/**
 * Small diamond marker for a bare waypoint (a "point"-kind line node) on an
 * already-selected line. Stations can already be selected and deleted; waypoints
 * have no id of their own to select by, so this exists purely to let a stray or
 * unwanted route-shaping point be targeted and removed the same way.
 */
export function WaypointNode({ x, y, color, selected, onClick }: WaypointNodeProps) {
  const size = selected ? 9 : 6
  return (
    <rect
      transform={`translate(${x}, ${y}) rotate(45)`}
      x={-size / 2}
      y={-size / 2}
      width={size}
      height={size}
      fill={selected ? color : 'var(--bg-page)'}
      stroke={color}
      strokeWidth={selected ? 2 : 1.5}
      onClick={onClick}
      style={{ cursor: 'pointer', transition: 'width 100ms ease, height 100ms ease' }}
    />
  )
}
