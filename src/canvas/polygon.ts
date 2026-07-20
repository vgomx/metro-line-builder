import type { Point } from '../types'

function distanceToSegment(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Ray casting: is the point inside this polygon? Used against a park's own outline rather
 * than its bounding box — an irregular shape fills maybe half its box, so testing the box
 * rejected placements that were nowhere near the green and left a third of maps parkless. */
export function insidePolygon(polygon: Point[], p: Point): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** How far a point is from a polygon's outline, ignoring which side it's on. */
export function distanceToOutline(polygon: Point[], p: Point): number {
  let best = Infinity
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    best = Math.min(best, distanceToSegment(polygon[j], polygon[i], p))
  }
  return best
}

/** True area centroid, by the shoelace formula — the balance point of the filled shape. */
function areaCentroid(polygon: Point[]): Point | null {
  let twiceArea = 0
  let x = 0
  let y = 0
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const cross = a.x * b.y - b.x * a.y
    twiceArea += cross
    x += (a.x + b.x) * cross
    y += (a.y + b.y) * cross
  }
  // A degenerate outline — every point collinear, or fewer than three of them — has no
  // centroid to speak of and would divide by zero.
  if (Math.abs(twiceArea) < 1e-9) return null
  return { x: x / (3 * twiceArea), y: y / (3 * twiceArea) }
}

/** How finely the fallback search samples the bounding box. 24 across is about a unit per
 * step on a typical park, which is far below the point at which a label looks off-centre. */
const GRID_STEPS = 24

/**
 * Where a shape's name belongs: the centre of the area, not the average of the corners.
 *
 * Averaging the vertices — which is what this used to do — weights wherever the corners
 * happen to bunch up rather than where the shape actually is. On the irregular parks the
 * generator now draws, that put the name 19 to 25 units off centre, which at park scale is
 * plainly wrong: the label visibly hugged one side.
 *
 * The area centroid is the right answer for any convex shape and for most concave ones. It
 * can fall outside a sufficiently horseshoe-shaped polygon though — nothing stops someone
 * drawing one by hand — and a name floating on the grass outside its own park is a worse
 * failure than a slightly off-centre one. So when the centroid isn't inside the shape, this
 * falls back to the interior point furthest from any edge, which is the roomiest place to put
 * text and is always, by construction, actually inside.
 */
export function polygonLabelAnchor(polygon: Point[]): Point {
  if (polygon.length === 0) return { x: 0, y: 0 }

  const centroid = areaCentroid(polygon)
  if (centroid && insidePolygon(polygon, centroid)) return centroid

  const xs = polygon.map(p => p.x)
  const ys = polygon.map(p => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  let best: Point | null = null
  let bestClearance = -1
  for (let i = 0; i <= GRID_STEPS; i++) {
    for (let j = 0; j <= GRID_STEPS; j++) {
      const candidate = {
        x: minX + ((maxX - minX) * i) / GRID_STEPS,
        y: minY + ((maxY - minY) * j) / GRID_STEPS,
      }
      if (!insidePolygon(polygon, candidate)) continue
      const clearance = distanceToOutline(polygon, candidate)
      if (clearance > bestClearance) {
        bestClearance = clearance
        best = candidate
      }
    }
  }

  // A shape so thin the grid never lands inside it. The centroid, wherever it is, beats
  // returning nothing.
  return best ?? centroid ?? polygon[0]
}
