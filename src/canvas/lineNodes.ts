import type { Line, LineNode, Point, Station } from '../types'
import { buildVertices, buildVerticesTagged, routeOrthogonal } from './routing'

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

export function connectedLineCount(stationId: string, lines: Line[]): number {
  let count = 0
  for (const line of lines) {
    if (lineHasStation(line, stationId)) count++
  }
  return count
}

/**
 * The stations that go down with a set of lines: those the removed lines called at and no
 * surviving line does. The rule for "can this station be deleted along with its line" lives
 * here and nowhere else — the reducer enforces it and the confirmation dialog previews it, and
 * the two must never disagree about which stations are at stake.
 */
export function exclusiveStationIds(removed: Line[], surviving: Line[]): string[] {
  const ids = new Set<string>()
  for (const line of removed) {
    for (const id of stationIdsOfLine(line)) {
      if (!surviving.some(other => lineHasStation(other, id))) ids.add(id)
    }
  }
  return [...ids]
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

/** How far a point lies from a polyline — the drawn route, not the chord between stops. */
export function distanceToPolyline(points: Point[], p: Point): number {
  let best = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    best = Math.min(best, distanceToSegment(points[i], points[i + 1], p))
  }
  return best
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


/**
 * Where a station sits on a line that doesn't stop there — the node index it would be inserted
 * at — or -1 if the line's route doesn't pass through it at all.
 *
 * Two crossing lines don't know about each other: a crossing is a place where two routes
 * happen to overlap, not a shared node. So a station placed on that crossing afterwards joins
 * whichever line put it there and merely sits underneath the other. This is what lets it be
 * offered to the other one.
 *
 * The test walks the routed geometry rather than the chord between nodes, because the route
 * between two stops bends: an orthogonal run with a 45° elbow passes through points the chord
 * never touches. Each pair of stops is routed on its own and the station tested against the
 * vertices that come back, so the answer matches the path actually drawn.
 */
export function lineRouteIndexThrough(line: Line, stations: Record<string, Station>, station: Station): number {
  if (lineHasStation(line, station.id)) return -1
  const points = resolveLineNodes(line.nodes, stations)
  const point = { x: station.x, y: station.y }
  for (let i = 0; i < points.length - 1; i++) {
    const vertices = buildVertices([points[i], points[i + 1]], false)
    if (exactSegmentIndex(vertices, point) >= 0) return i + 1
  }
  return -1
}

/** Direction-independent key for a segment, so A→B and B→A collide to the same key. */
export function segmentKey(a: Point, b: Point): string {
  const [p1, p2] = a.x < b.x || (a.x === b.x && a.y <= b.y) ? [a, b] : [b, a]
  return `${p1.x},${p1.y}|${p2.x},${p2.y}`
}

/** A line's routed vertices, with each vertex tied back to the line node it came from. */
export interface LineGeometry {
  /** Routed vertices, subdivided so every shared corridor is broken at the same points. */
  vertices: Point[]
  /** Parallel to vertices — index into `resolved`, or -1 for a router elbow or a split point. */
  vertexNode: number[]
  resolved: { node: LineNode; point: Point }[]
}

export interface NetworkGeometry {
  /** Keyed by line id; only visible lines with drawable geometry appear. */
  byLine: Map<string, LineGeometry>
  /** Each subdivided segment → the ids of every line running along it, in lineList order. */
  segmentLineMap: Map<string, string[]>
}

/** Two routed vertices count as the same point only on an exact match; coordinates come
 * from grid-snapped stations and exact elbow arithmetic, so there's no drift to absorb. */
function pointKey(p: Point): string {
  return `${p.x},${p.y}`
}

/** Routed vertices for one line, with duplicates collapsed and node identity preserved. */
function routeLine(line: Line, stations: Record<string, Station>): LineGeometry | null {
  const resolved = line.nodes
    .map(node => ({ node, point: resolveNodePoint(node, stations) }))
    .filter((entry): entry is { node: LineNode; point: Point } => entry.point !== null)
  if (resolved.length < 2) return null

  const tagged = buildVerticesTagged(resolved.map(entry => entry.point))

  // Drop consecutive duplicates (a waypoint dropped onto a station leaves a zero-length
  // segment), carrying node identity onto the vertex we keep — preferring a station over
  // a coincident waypoint so a train still dwells there.
  const vertices: Point[] = []
  const vertexNode: number[] = []
  let sourceCount = 0
  for (let i = 0; i < tagged.vertices.length; i++) {
    const point = tagged.vertices[i]
    const nodeIndex = tagged.isSource[i] ? sourceCount++ : -1
    const last = vertices[vertices.length - 1]
    if (last && last.x === point.x && last.y === point.y) {
      const keptIndex = vertexNode[vertexNode.length - 1]
      const keptIsStation = keptIndex >= 0 && resolved[keptIndex].node.kind === 'station'
      const incomingIsStation = nodeIndex >= 0 && resolved[nodeIndex].node.kind === 'station'
      if (nodeIndex >= 0 && (keptIndex < 0 || (incomingIsStation && !keptIsStation))) {
        vertexNode[vertexNode.length - 1] = nodeIndex
      }
      continue
    }
    vertices.push(point)
    vertexNode.push(nodeIndex)
  }
  if (vertices.length < 2) return null
  return { vertices, vertexNode, resolved }
}

/** Breaks each segment wherever one of `points` lies strictly inside it. */
function subdivideAt(geometry: LineGeometry, points: Point[]): LineGeometry {
  const vertices: Point[] = []
  const vertexNode: number[] = []

  for (let i = 0; i < geometry.vertices.length - 1; i++) {
    const a = geometry.vertices[i]
    const b = geometry.vertices[i + 1]
    vertices.push(a)
    vertexNode.push(geometry.vertexNode[i])

    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengthSq = dx * dx + dy * dy
    if (lengthSq === 0) continue

    const inner: { t: number; point: Point }[] = []
    for (const point of points) {
      const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq
      if (t <= 0 || t >= 1) continue
      // Reject points that merely project onto the segment without lying on it.
      if (Math.abs(a.x + dx * t - point.x) > 1e-6 || Math.abs(a.y + dy * t - point.y) > 1e-6) continue
      inner.push({ t, point })
    }
    inner.sort((u, v) => u.t - v.t)
    for (const split of inner) {
      vertices.push(split.point)
      vertexNode.push(-1)
    }
  }

  const last = geometry.vertices.length - 1
  vertices.push(geometry.vertices[last])
  vertexNode.push(geometry.vertexNode[last])
  return { ...geometry, vertices, vertexNode }
}

/**
 * Routes every visible line and works out which of them share each stretch of track, so
 * the renderer can fan parallel colored strokes across a shared route (Tube-map style,
 * e.g. Circle/District/Hammersmith & City) instead of stacking them on top of each other.
 *
 * Sharing is judged on *routed* vertices rather than raw line nodes — a router elbow can
 * land on another line's station, so two lines can share track without sharing a single
 * node-to-node segment. That alone isn't enough though: lines running down the same
 * corridor often break it at different places (one stops at a station mid-corridor, the
 * other runs straight through), leaving segments that overlap but share no endpoints. So
 * every line's segments are first subdivided at every other line's vertices. Without that
 * step the straight-through line matches nothing, takes a zero offset, and draws right
 * down the middle of the fan — on top of its neighbours instead of beside them.
 */
export function buildNetworkGeometry(lineList: Line[], stations: Record<string, Station>): NetworkGeometry {
  const byLine = new Map<string, LineGeometry>()
  for (const line of lineList) {
    if (!line.visible) continue
    const geometry = routeLine(line, stations)
    if (geometry) byLine.set(line.id, geometry)
  }

  const seen = new Set<string>()
  const points: Point[] = []
  for (const geometry of byLine.values()) {
    for (const point of geometry.vertices) {
      const key = pointKey(point)
      if (seen.has(key)) continue
      seen.add(key)
      points.push(point)
    }
  }

  for (const [id, geometry] of byLine) byLine.set(id, subdivideAt(geometry, points))

  // Walk lineList (not byLine) so a segment's group order is stable across segments —
  // that ordering is what decides which lane each line takes within the fan.
  const segmentLineMap = new Map<string, string[]>()
  for (const line of lineList) {
    const geometry = byLine.get(line.id)
    if (!geometry) continue
    for (let i = 0; i < geometry.vertices.length - 1; i++) {
      const key = segmentKey(geometry.vertices[i], geometry.vertices[i + 1])
      const group = segmentLineMap.get(key)
      // Once per line, however many times that line runs the segment. A route that doubles
      // back along its own track — a loop, or an out-and-back spur — would otherwise be
      // counted twice in its own corridor, widening the fan by a lane and leaving that lane
      // empty, since both traversals then resolve to the same index.
      if (!group) segmentLineMap.set(key, [line.id])
      else if (!group.includes(line.id)) group.push(line.id)
    }
  }

  return { byLine, segmentLineMap }
}

/** Perpendicular spacing between parallel lanes when 2+ lines share the same route. */
export const LANE_WIDTH = 7

/** How far a lane-offset corner's miter may reach from its vertex before it's beveled
 * instead. Sharp turns only carry an offset at shared stations, which are interchanges and
 * so wear the larger (r=10) marker — keeping the cap just inside that means a beveled corner
 * stays hidden under the marker rather than trading one visible artifact for another. */
const MITER_LIMIT = 9

/** True when a→b runs in segmentKey's canonical order (the smaller endpoint first). Used to
 * keep a lane's side of the corridor fixed in the world, not relative to travel. */
function isForwardSegment(a: Point, b: Point): boolean {
  return a.x < b.x || (a.x === b.x && a.y <= b.y)
}

/** Perpendicular lane offset for each segment of `points` (length = points.length - 1),
 * based on how many lines share that segment and where this line falls in that group —
 * shared by the line-path renderer and the train animation so both fan out the same way.
 *
 * The offset is negated for a segment this line traverses against the canonical order. The
 * shift is applied downstream along each line's own direction-normal, which flips with travel
 * direction; two lines sharing a corridor in opposite directions would otherwise have both
 * their offset sign and their normal flip, cancelling out and stacking them on the same lane
 * instead of fanning. Tying the sign to the segment's fixed orientation keeps a lane on the
 * same physical side no matter which way a line runs it. */
export function computeLaneOffsets(points: Point[], lineId: string, segmentLineMap: Map<string, string[]>): number[] {
  const offsets: number[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const group = segmentLineMap.get(segmentKey(points[i], points[i + 1])) ?? [lineId]
    if (group.length <= 1) {
      offsets.push(0)
      continue
    }
    const index = Math.max(0, group.indexOf(lineId))
    const lane = (index - (group.length - 1) / 2) * LANE_WIDTH
    offsets.push(isForwardSegment(points[i], points[i + 1]) ? lane : -lane)
  }
  return offsets
}

/**
 * Shifts each segment of a routed vertex list sideways by its own lane offset and places
 * every interior vertex at the intersection of the two adjacent shifted segments — the
 * classic variable-offset polyline construction. Preserving each segment's direction
 * exactly lets a fillet pass downstream see clean corners and apply its normal radius.
 * (Earlier attempts that averaged or duplicated points at a lane merge/split created
 * clusters of near-coincident vertices, which capped the fillet radius at ~1px there and
 * made those corners look sharp.)
 *
 * Also reports, for each output point, the index of the input vertex it came from. A
 * vertex normally yields exactly one output point, but a lane change along a straight run
 * yields two (the ends of the taper), so a caller that has to find a particular vertex
 * again on the offset track can't just reuse its index.
 */
export function offsetPolylineIndexed(
  vertices: Point[],
  offsets: number[],
): { points: Point[]; sourceIndex: number[] } {
  const n = vertices.length
  if (n < 2) return { points: vertices, sourceIndex: vertices.map((_, i) => i) }

  const dirs: Point[] = []
  const norms: Point[] = []
  const lengths: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const dx = vertices[i + 1].x - vertices[i].x
    const dy = vertices[i + 1].y - vertices[i].y
    const len = Math.hypot(dx, dy) || 1
    lengths.push(len)
    dirs.push({ x: dx / len, y: dy / len })
    norms.push({ x: -dy / len, y: dx / len })
  }

  const points: Point[] = [
    { x: vertices[0].x + norms[0].x * offsets[0], y: vertices[0].y + norms[0].y * offsets[0] },
  ]
  const sourceIndex: number[] = [0]

  for (let i = 1; i < n - 1; i++) {
    // Endpoints of the two shifted segments meeting at this vertex.
    const a = { x: vertices[i].x + norms[i - 1].x * offsets[i - 1], y: vertices[i].y + norms[i - 1].y * offsets[i - 1] }
    const b = { x: vertices[i].x + norms[i].x * offsets[i], y: vertices[i].y + norms[i].y * offsets[i] }
    const denom = dirs[i - 1].x * dirs[i].y - dirs[i - 1].y * dirs[i].x
    if (Math.abs(denom) < 1e-9) {
      // Collinear segments: no intersection to solve for. Equal offsets need only one
      // point. A lane change along a straight run — where a line joins or leaves a shared
      // corridor mid-segment — instead ramps across at 45°, matching the map's own idiom.
      // Stepping straight sideways in place would put a 90° turn immediately against its
      // mirror, which caps the fillet radius at half the step and reads as a hard notch.
      if (Math.abs(offsets[i - 1] - offsets[i]) < 1e-9) {
        points.push(a)
        sourceIndex.push(i)
      } else {
        const shift = Math.abs(offsets[i] - offsets[i - 1])
        // Half the run each side of the vertex, so the taper straddles it symmetrically.
        const reach = Math.min(shift / 2, lengths[i - 1] / 2, lengths[i] / 2)
        points.push(
          { x: a.x - dirs[i - 1].x * reach, y: a.y - dirs[i - 1].y * reach },
          { x: b.x + dirs[i].x * reach, y: b.y + dirs[i].y * reach },
        )
        sourceIndex.push(i, i)
      }
    } else {
      const t = ((b.x - a.x) * dirs[i].y - (b.y - a.y) * dirs[i].x) / denom
      const miterX = a.x + dirs[i - 1].x * t
      const miterY = a.y + dirs[i - 1].y * t
      // The miter is where the two lane-shifted segments cross, and at a sharp turn that
      // crossing runs off to infinity — the classic unbounded-miter spike, the same thing
      // SVG's stroke-miterlimit exists to cap. Left alone, a lane-offset line making a tight
      // turn at a shared station throws a spike out past the station marker and onto whatever
      // line runs alongside it. Past the limit, cut the corner with a bevel instead: a and b
      // both sit at the lane offset from the vertex (<= a lane-width or so out), so the join
      // can no longer reach a neighbour.
      if (Math.hypot(miterX - vertices[i].x, miterY - vertices[i].y) > MITER_LIMIT) {
        points.push(a, b)
        sourceIndex.push(i, i)
      } else {
        points.push({ x: miterX, y: miterY })
        sourceIndex.push(i)
      }
    }
  }

  const last = n - 1
  points.push({
    x: vertices[last].x + norms[last - 1].x * offsets[last - 1],
    y: vertices[last].y + norms[last - 1].y * offsets[last - 1],
  })
  sourceIndex.push(last)
  return { points, sourceIndex }
}

export interface LineTrack {
  /** Where the train dwells or turns, in order — points on this line's own lane. */
  stopPoints: Point[]
  /** Parallel to stopPoints: true for real stations, false for waypoints it glides through. */
  stopFlags: boolean[]
  /** Path `d` between each consecutive pair of stops, lane-offset and filleted. */
  segmentPaths: string[]
}

/** The lane-offset polyline a line is drawn along — its own rail within any shared fan. */
export function buildLaneVertices(
  geometry: LineGeometry,
  lineId: string,
  segmentLineMap: Map<string, string[]>,
): { points: Point[]; sourceIndex: number[] } {
  const offsets = computeLaneOffsets(geometry.vertices, lineId, segmentLineMap)
  return offsetPolylineIndexed(geometry.vertices, offsets)
}

/** The `d` attribute LinePath renders: the line's own lane, filleted at the corners. */
export function buildLinePath(
  geometry: LineGeometry,
  lineId: string,
  segmentLineMap: Map<string, string[]>,
): string {
  const { points } = buildLaneVertices(geometry, lineId, segmentLineMap)
  return points.length >= 2 ? routeOrthogonal(points) : ''
}

/**
 * The rails a train actually runs on: the very same lane-offset geometry LinePath draws,
 * with the line's own nodes located along it as stops. Sharing one source of geometry is
 * what keeps a train on its own rail instead of a neighbour's wherever lines fan out.
 */
export function buildLineTrack(
  geometry: LineGeometry,
  lineId: string,
  segmentLineMap: Map<string, string[]>,
): LineTrack | null {
  const { points, sourceIndex } = buildLaneVertices(geometry, lineId, segmentLineMap)

  const stopIndices: number[] = []
  const stopFlags: boolean[] = []
  for (let vertex = 0; vertex < geometry.vertices.length; vertex++) {
    const nodeIndex = geometry.vertexNode[vertex]
    if (nodeIndex < 0) continue
    const at = sourceIndex.indexOf(vertex)
    if (at < 0) continue
    stopIndices.push(at)
    stopFlags.push(geometry.resolved[nodeIndex].node.kind === 'station')
  }
  if (stopIndices.length < 2) return null

  const segmentPaths: string[] = []
  for (let i = 0; i < stopIndices.length - 1; i++) {
    const span = points.slice(stopIndices[i], stopIndices[i + 1] + 1)
    segmentPaths.push(span.length >= 2 ? routeOrthogonal(span) : '')
  }

  return { stopPoints: stopIndices.map(index => points[index]), stopFlags, segmentPaths }
}

export interface RefanLine {
  lineId: string
  color: string
  /** Shared centreline basis (stations unchanged), subdivided against both states. */
  vertices: Point[]
  /** Per-segment lane offset under the previous sharing (length vertices - 1). */
  fromOffsets: number[]
  /** Per-segment lane offset under the new sharing. */
  toOffsets: number[]
}

/** Segment→line map with each line's centreline subdivided at a common point set, so a
 * shared corridor yields identical segment keys no matter how each line breaks it up. */
function subdividedSegmentMap(
  lines: Line[],
  geoms: Map<string, LineGeometry>,
  unionPoints: Point[],
): { map: Map<string, string[]>; subByLine: Map<string, LineGeometry> } {
  const map = new Map<string, string[]>()
  const subByLine = new Map<string, LineGeometry>()
  for (const line of lines) {
    const geometry = geoms.get(line.id)
    if (!geometry) continue
    const sub = subdivideAt(geometry, unionPoints)
    subByLine.set(line.id, sub)
    for (let i = 0; i < sub.vertices.length - 1; i++) {
      const key = segmentKey(sub.vertices[i], sub.vertices[i + 1])
      const group = map.get(key)
      if (group) group.push(line.id)
      else map.set(key, [line.id])
    }
  }
  return { map, subByLine }
}

/**
 * For every line whose *lane* changed between two line-list states while its own
 * centreline stayed put (a line was added, removed, hidden, or rerouted elsewhere in the
 * network), the offsets it should slide between as the fan re-forms. Empty when nothing
 * re-lanes, so the caller can skip the animation entirely.
 *
 * Both states are subdivided at the union of all their vertices, so a corridor shared in
 * one state but not the other still lines up segment-for-segment — the two offset arrays
 * share a basis and interpolate cleanly. Only lines present in both states with an
 * unchanged centreline slide; a line that itself moved is left to snap, and a brand-new
 * or just-removed line simply appears or vanishes.
 */
export function buildRefanFrames(
  prevLines: Line[],
  nextLines: Line[],
  stations: Record<string, Station>,
): RefanLine[] {
  const prevGeoms = new Map<string, LineGeometry>()
  for (const line of prevLines) {
    if (!line.visible) continue
    const geometry = routeLine(line, stations)
    if (geometry) prevGeoms.set(line.id, geometry)
  }
  const nextGeoms = new Map<string, LineGeometry>()
  for (const line of nextLines) {
    if (!line.visible) continue
    const geometry = routeLine(line, stations)
    if (geometry) nextGeoms.set(line.id, geometry)
  }
  if (prevGeoms.size === 0 || nextGeoms.size === 0) return []

  const seen = new Set<string>()
  const unionPoints: Point[] = []
  for (const geometry of prevGeoms.values()) {
    for (const point of geometry.vertices) {
      const key = pointKey(point)
      if (!seen.has(key)) {
        seen.add(key)
        unionPoints.push(point)
      }
    }
  }
  for (const geometry of nextGeoms.values()) {
    for (const point of geometry.vertices) {
      const key = pointKey(point)
      if (!seen.has(key)) {
        seen.add(key)
        unionPoints.push(point)
      }
    }
  }

  const prev = subdividedSegmentMap(prevLines, prevGeoms, unionPoints)
  const next = subdividedSegmentMap(nextLines, nextGeoms, unionPoints)

  const frames: RefanLine[] = []
  for (const line of nextLines) {
    const nextSub = next.subByLine.get(line.id)
    const prevSub = prev.subByLine.get(line.id)
    // Present in both, with an identical centreline (same base route subdivided at the
    // same points ⇒ same vertices). Anything else appears, vanishes, or snaps.
    if (!nextSub || !prevSub || nextSub.vertices.length !== prevSub.vertices.length) continue
    let sameCentreline = true
    for (let i = 0; i < nextSub.vertices.length; i++) {
      if (nextSub.vertices[i].x !== prevSub.vertices[i].x || nextSub.vertices[i].y !== prevSub.vertices[i].y) {
        sameCentreline = false
        break
      }
    }
    if (!sameCentreline) continue

    const fromOffsets = computeLaneOffsets(nextSub.vertices, line.id, prev.map)
    const toOffsets = computeLaneOffsets(nextSub.vertices, line.id, next.map)
    let changed = false
    for (let i = 0; i < fromOffsets.length; i++) {
      if (Math.abs(fromOffsets[i] - toOffsets[i]) > 1e-6) {
        changed = true
        break
      }
    }
    if (!changed) continue

    frames.push({ lineId: line.id, color: line.color, vertices: nextSub.vertices, fromOffsets, toOffsets })
  }
  return frames
}
