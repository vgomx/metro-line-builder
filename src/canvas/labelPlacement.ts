import type { Line, Station } from '../types'
import { resolveNodePoint } from './lineNodes'

export interface LabelPlacement {
  angle: number
  anchor: 'start' | 'middle' | 'end'
}

/**
 * The 8 schematic compass directions a Beck-style tube map label can sit in, ordered
 * by preference when nothing forces a choice. South (straight below) comes first so
 * a station untouched by any line keeps the plain, familiar look; the rest fan out
 * from there.
 */
const LABEL_DIRECTIONS: LabelPlacement[] = [
  { angle: Math.PI / 2, anchor: 'middle' }, // S
  { angle: 0, anchor: 'start' }, // E
  { angle: Math.PI, anchor: 'end' }, // W
  { angle: -Math.PI / 2, anchor: 'middle' }, // N
  { angle: Math.PI / 4, anchor: 'start' }, // SE
  { angle: (3 * Math.PI) / 4, anchor: 'end' }, // SW
  { angle: -Math.PI / 4, anchor: 'start' }, // NE
  { angle: (-3 * Math.PI) / 4, anchor: 'end' }, // NW
]

function angularDistance(a: number, b: number): number {
  const twoPi = Math.PI * 2
  let diff = Math.abs(a - b) % twoPi
  if (diff > Math.PI) diff = twoPi - diff
  return diff
}

/** Angles (in radians, screen space) from a station to every line segment leaving it. */
function incidentAngles(stationId: string, lineList: Line[], stations: Record<string, Station>): number[] {
  const station = stations[stationId]
  if (!station) return []

  const angles: number[] = []
  for (const line of lineList) {
    const nodes = line.nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (node.kind !== 'station' || node.stationId !== stationId) continue
      const neighbors = [nodes[i - 1], nodes[i + 1]]
      for (const neighbor of neighbors) {
        if (!neighbor) continue
        const point = resolveNodePoint(neighbor, stations)
        if (point) angles.push(Math.atan2(point.y - station.y, point.x - station.x))
      }
    }
  }
  return angles
}

/**
 * Picks whichever of the 8 compass directions sits farthest (angularly) from every
 * line segment touching this station, so the name never sits on top of a line's path.
 * Untouched stations default to straight below, matching the map's previous look.
 */
export function computeLabelPlacement(stationId: string, lineList: Line[], stations: Record<string, Station>): LabelPlacement {
  const incident = incidentAngles(stationId, lineList, stations)
  if (incident.length === 0) return LABEL_DIRECTIONS[0]

  let best = LABEL_DIRECTIONS[0]
  let bestScore = -Infinity
  for (const direction of LABEL_DIRECTIONS) {
    const score = Math.min(...incident.map(a => angularDistance(a, direction.angle)))
    if (score > bestScore + 1e-6) {
      bestScore = score
      best = direction
    }
  }
  return best
}
