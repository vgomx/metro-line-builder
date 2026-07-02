interface Point {
  x: number
  y: number
}

/**
 * Builds an SVG path string that only uses horizontal, vertical, and 45-degree
 * segments (Harry Beck-style schematic routing), instead of freehand straight
 * lines between stations. Station positions stay freeform — this only changes
 * how the path between them is drawn.
 *
 * Each consecutive pair gets one diagonal "elbow" covering the shorter axis
 * distance, followed by a straight segment covering the rest of the longer axis.
 */
export function routeOrthogonal(points: Point[]): string {
  if (points.length < 2) return ''

  const segments = [`M ${points[0].x} ${points[0].y}`]

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1]
    const p2 = points[i]
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)

    if (adx === 0 || ady === 0 || adx === ady) {
      segments.push(`L ${p2.x} ${p2.y}`)
      continue
    }

    const sx = Math.sign(dx)
    const sy = Math.sign(dy)

    if (adx > ady) {
      const elbowX = p1.x + sx * ady
      segments.push(`L ${elbowX} ${p2.y}`)
    } else {
      const elbowY = p1.y + sy * adx
      segments.push(`L ${p2.x} ${elbowY}`)
    }
    segments.push(`L ${p2.x} ${p2.y}`)
  }

  return segments.join(' ')
}
