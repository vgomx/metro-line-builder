interface Point {
  x: number
  y: number
}

const DEFAULT_CORNER_RADIUS = 10

// Points fed in after a perpendicular-offset (lane fanning) computation land within
// floating-point noise of true H/V/45° alignment rather than exactly on it — without
// this tolerance, buildVertices would insert a spurious near-zero-length elbow right
// next to a real corner, splitting one smooth fillet into two tiny back-to-back ones.
const ALIGNMENT_EPSILON = 1e-6

/**
 * Builds an SVG path string that only uses horizontal, vertical, and 45-degree
 * segments (Harry Beck-style schematic routing), instead of freehand straight
 * lines between stations. Station positions stay freeform — this only changes
 * how the path between them is drawn.
 *
 * Each consecutive pair gets one diagonal "elbow" covering the shorter axis
 * distance, followed by a straight segment covering the rest of the longer axis.
 * Corners are then filleted (Tube-map style) rather than left sharp.
 */
export function routeOrthogonal(points: Point[], closed = false, cornerRadius = DEFAULT_CORNER_RADIUS): string {
  if (points.length < 2) return ''

  const vertices = buildVertices(points, closed)
  return roundedPath(vertices, cornerRadius, closed)
}

function routeVertices(routePoints: Point[]): { vertices: Point[]; isSource: boolean[] } {
  const vertices: Point[] = [routePoints[0]]
  const isSource: boolean[] = [true]

  for (let i = 1; i < routePoints.length; i++) {
    const p1 = routePoints[i - 1]
    const p2 = routePoints[i]
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)

    if (adx < ALIGNMENT_EPSILON || ady < ALIGNMENT_EPSILON || Math.abs(adx - ady) < ALIGNMENT_EPSILON) {
      vertices.push(p2)
      isSource.push(true)
      continue
    }

    const sx = Math.sign(dx)
    const sy = Math.sign(dy)

    if (adx > ady) {
      vertices.push({ x: p1.x + sx * ady, y: p2.y })
    } else {
      vertices.push({ x: p2.x, y: p1.y + sy * adx })
    }
    isSource.push(false)
    vertices.push(p2)
    isSource.push(true)
  }

  return { vertices, isSource }
}

export function buildVertices(points: Point[], closed: boolean): Point[] {
  return routeVertices(closed ? [...points, points[0]] : points).vertices
}

/**
 * buildVertices for an open path, additionally flagging which output vertices are
 * original input points versus elbows the router inserted. Callers that need to
 * locate the input points again on the routed path — the train layer, which has to
 * know where its stops sit along the line's lane — can't recover that afterwards,
 * because an inserted elbow can land exactly on another line's station.
 */
export function buildVerticesTagged(points: Point[]): { vertices: Point[]; isSource: boolean[] } {
  return routeVertices(points)
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function trimTowards(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return from
  const t = distance / len
  return { x: from.x + dx * t, y: from.y + dy * t }
}

/**
 * Walks a vertex list (straight segments only) and rounds each interior
 * corner with a quadratic-bezier fillet, sized to the shorter of the two
 * adjacent segments so short hops near a station never overshoot.
 */
function roundedPath(rawVertices: Point[], cornerRadius: number, closed: boolean): string {
  const pts: Point[] = []
  for (const p of rawVertices) {
    const last = pts[pts.length - 1]
    if (!last || last.x !== p.x || last.y !== p.y) pts.push(p)
  }

  const n = pts.length
  if (n < 2) return ''

  if (n === 2 || cornerRadius <= 0) {
    const d = `M ${pts[0].x} ${pts[0].y} L ${pts[n - 1].x} ${pts[n - 1].y}`
    return closed ? `${d} Z` : d
  }

  const segments = [`M ${pts[0].x} ${pts[0].y}`]

  for (let i = 1; i < n - 1; i++) {
    const prev = pts[i - 1]
    const cur = pts[i]
    const next = pts[i + 1]
    const r = Math.min(cornerRadius, dist(prev, cur) / 2, dist(cur, next) / 2)
    const trimIn = trimTowards(cur, prev, r)
    const trimOut = trimTowards(cur, next, r)
    segments.push(`L ${trimIn.x} ${trimIn.y}`)
    segments.push(`Q ${cur.x} ${cur.y} ${trimOut.x} ${trimOut.y}`)
  }

  segments.push(`L ${pts[n - 1].x} ${pts[n - 1].y}`)
  if (closed) segments.push('Z')

  return segments.join(' ')
}
