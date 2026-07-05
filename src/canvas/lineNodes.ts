import type { Line, LineNode, Point, Station } from '../types'
import { buildVertices } from './routing'

export function resolveNodePoint(node: LineNode, stations: Record<string, Station>): Point | null {
  if (node.kind === 'point') return { x: node.x, y: node.y }
  const station = stations[node.stationId]
  return station ? { x: station.x, y: station.y } : null
}

export function resolveLineNodes(nodes: LineNode[], stations: Record<string, Station>): Point[] {
  return nodes.map(n => resolveNodePoint(n, stations)).filter((p): p is Point => Boolean(p))
}

/**
 * Like resolveLineNodes, but expands every consecutive pair into the actual routed
 * vertex list (including routeOrthogonal's auto-inserted elbow points). Two lines
 * can share part of a routed path without sharing an exact raw node-to-node segment
 * — e.g. a shared diagonal lead-out from one station before diverging at different
 * elbows — and only this finer resolution catches that for shared-lane detection.
 */
export function resolveLineVertices(nodes: LineNode[], stations: Record<string, Station>): Point[] {
  return buildVertices(resolveLineNodes(nodes, stations), false)
}

export function stationIdsOfLine(line: Line): string[] {
  return line.nodes.filter((n): n is Extract<LineNode, { kind: 'station' }> => n.kind === 'station').map(n => n.stationId)
}

export function lineHasStation(line: Line, stationId: string): boolean {
  return line.nodes.some(n => n.kind === 'station' && n.stationId === stationId)
}

export function connectedLineCount(stationId: string, lines: Line[]): number {
  let count = 0
  for (const line of lines) {
    if (lineHasStation(line, stationId)) count++
  }
  return count
}

/** A station reads as a transfer hub either because it's manually flagged, or because it sits on 2+ lines. */
export function isTransferStation(station: Station, lines: Line[]): boolean {
  return station.transfer || connectedLineCount(station.id, lines) >= 2
}

export function sameNode(a: LineNode, b: LineNode): boolean {
  if (a.kind !== b.kind) return false
  return a.kind === 'station' && b.kind === 'station' ? a.stationId === b.stationId : a.kind === 'point' && b.kind === 'point' && a.x === b.x && a.y === b.y
}

function distanceToSegment(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  return Math.hypot(p.x - projX, p.y - projY)
}

/** Index i such that inserting a new node between points[i] and points[i+1] is closest to `click`. */
export function closestSegmentIndex(points: Point[], click: Point): number {
  let bestIndex = 0
  let bestDist = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const dist = distanceToSegment(points[i], points[i + 1], click)
    if (dist < bestDist) {
      bestDist = dist
      bestIndex = i
    }
  }
  return bestIndex
}

/**
 * Index i such that `point` sits exactly on the segment between points[i] and
 * points[i+1] — a real geometric crossing, not just the nearest one — or -1 if the
 * point isn't on any segment. Only checks each line's own node-to-node segments,
 * not the rounded elbow routeOrthogonal adds when two nodes aren't h/v/45°-aligned.
 */
export function exactSegmentIndex(points: Point[], point: Point): number {
  for (let i = 0; i < points.length - 1; i++) {
    if (distanceToSegment(points[i], points[i + 1], point) < 0.5) return i
  }
  return -1
}

/** Direction-independent key for a segment, so A→B and B→A collide to the same key. */
export function segmentKey(a: Point, b: Point): string {
  const [p1, p2] = a.x < b.x || (a.x === b.x && a.y <= b.y) ? [a, b] : [b, a]
  return `${p1.x},${p1.y}|${p2.x},${p2.y}`
}

/**
 * Maps each segment (by its endpoint coordinates) to the ids of every visible line
 * running along it, in a stable order — used to fan parallel colored strokes out
 * across a shared route (Tube-map style, e.g. Circle/District/Hammersmith & City)
 * instead of stacking them invisibly on top of each other.
 */
export function buildSegmentLineMap(lineList: Line[], stations: Record<string, Station>): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const line of lineList) {
    if (!line.visible) continue
    const points = resolveLineNodes(line.nodes, stations)
    for (let i = 0; i < points.length - 1; i++) {
      const key = segmentKey(points[i], points[i + 1])
      const group = map.get(key)
      if (group) group.push(line.id)
      else map.set(key, [line.id])
    }
  }
  return map
}

/**
 * Fine-grained counterpart to buildSegmentLineMap, keyed on routed vertices
 * (resolveLineVertices) instead of raw line nodes — lets the line-path renderer fan
 * out lines that only share part of a routed segment instead of drawing them on top
 * of each other. Train animation keeps using the coarser, node-based map since its
 * stop points are tied to real line nodes, not synthetic elbow vertices.
 */
export function buildVertexSegmentLineMap(lineList: Line[], stations: Record<string, Station>): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const line of lineList) {
    if (!line.visible) continue
    const vertices = resolveLineVertices(line.nodes, stations)
    for (let i = 0; i < vertices.length - 1; i++) {
      const key = segmentKey(vertices[i], vertices[i + 1])
      const group = map.get(key)
      if (group) group.push(line.id)
      else map.set(key, [line.id])
    }
  }
  return map
}

/** Perpendicular spacing between parallel lanes when 2+ lines share the same route. */
export const LANE_WIDTH = 7

/** Perpendicular lane offset for each segment of `points` (length = points.length - 1),
 * based on how many lines share that segment and where this line falls in that group —
 * shared by the line-path renderer and the train animation so both fan out the same way. */
export function computeLaneOffsets(points: Point[], lineId: string, segmentLineMap: Map<string, string[]>): number[] {
  const offsets: number[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const group = segmentLineMap.get(segmentKey(points[i], points[i + 1])) ?? [lineId]
    if (group.length <= 1) {
      offsets.push(0)
      continue
    }
    const index = Math.max(0, group.indexOf(lineId))
    offsets.push((index - (group.length - 1) / 2) * LANE_WIDTH)
  }
  return offsets
}

/** Shifts both endpoints of a segment perpendicular to its direction by `amount`. */
export function offsetSegment(a: Point, b: Point, amount: number): [Point, Point] {
  if (amount === 0) return [a, b]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ox = (-dy / len) * amount
  const oy = (dx / len) * amount
  return [
    { x: a.x + ox, y: a.y + oy },
    { x: b.x + ox, y: b.y + oy },
  ]
}
