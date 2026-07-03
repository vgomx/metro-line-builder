import type { Line, LineNode, Point, Station } from '../types'

export function resolveNodePoint(node: LineNode, stations: Record<string, Station>): Point | null {
  if (node.kind === 'point') return { x: node.x, y: node.y }
  const station = stations[node.stationId]
  return station ? { x: station.x, y: station.y } : null
}

export function resolveLineNodes(nodes: LineNode[], stations: Record<string, Station>): Point[] {
  return nodes.map(n => resolveNodePoint(n, stations)).filter((p): p is Point => Boolean(p))
}

export function stationIdsOfLine(line: Line): string[] {
  return line.nodes.filter((n): n is Extract<LineNode, { kind: 'station' }> => n.kind === 'station').map(n => n.stationId)
}

export function lineHasStation(line: Line, stationId: string): boolean {
  return line.nodes.some(n => n.kind === 'station' && n.stationId === stationId)
}

export function sameNode(a: LineNode, b: LineNode): boolean {
  if (a.kind !== b.kind) return false
  return a.kind === 'station' && b.kind === 'station' ? a.stationId === b.stationId : a.kind === 'point' && b.kind === 'point' && a.x === b.x && a.y === b.y
}

/** Index i such that inserting a new node between points[i] and points[i+1] is closest to `click`. */
export function closestSegmentIndex(points: Point[], click: Point): number {
  let bestIndex = 0
  let bestDist = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((click.x - a.x) * dx + (click.y - a.y) * dy) / lenSq))
    const projX = a.x + t * dx
    const projY = a.y + t * dy
    const dist = Math.hypot(click.x - projX, click.y - projY)
    if (dist < bestDist) {
      bestDist = dist
      bestIndex = i
    }
  }
  return bestIndex
}
