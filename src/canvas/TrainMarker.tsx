import { useEffect, useRef } from 'react'
import { offsetSegment } from './lineNodes'
import { routeOrthogonal } from './routing'

interface Point {
  x: number
  y: number
}

interface TrainMarkerProps {
  lineId: string
  color: string
  /** Full ordered path the train travels, including pass-through waypoints. */
  pathPoints: Point[]
  /** Parallel to pathPoints — true where the train should dwell (real stations), false for waypoints it just glides through. */
  stopFlags: boolean[]
  /** Parallel to each segment (pathPoints[i]-pathPoints[i+1]) — perpendicular lane
   * offset so a train on a route shared with other lines rides its own line's lane
   * instead of overlapping the others. Dwelling at a station still uses the true
   * (unoffset) position, so parked trains sit at the actual station mark. */
  laneOffsets: number[]
  /** How long the train dwells at each station, in ms. */
  dwellMs?: number
  /** Travel speed in px/ms. */
  speed?: number
}

/**
 * Shuttles a train-shaped marker back and forth along a line, stopping briefly
 * at each station in between (like a real service) instead of gliding straight
 * through. Waypoint nodes shape the route but aren't stops, so the train glides
 * through them without dwelling. Position/rotation are written directly to the
 * DOM each animation frame (bypassing React state) for smooth 60fps motion.
 * Per-segment paths are rebuilt from live positions every frame, so this keeps
 * tracking correctly even while a line's stations are being dragged.
 */
export function TrainMarker({ lineId, color, pathPoints, stopFlags, laneOffsets, dwellMs = 1400, speed = 0.12 }: TrainMarkerProps) {
  const groupRef = useRef<SVGGElement>(null)
  const segmentRefs = useRef<(SVGPathElement | null)[]>([])
  const lastAngleRef = useRef(0)
  // Read fresh every frame instead of closing over the props, so the animation
  // loop below can keep a stable start time (and thus keep playing without a
  // jump) across re-renders that only touch positions — e.g. dragging a
  // station or any unrelated canvas interaction — rather than restarting.
  const pathPointsRef = useRef(pathPoints)
  const stopFlagsRef = useRef(stopFlags)
  const laneOffsetsRef = useRef(laneOffsets)
  pathPointsRef.current = pathPoints
  stopFlagsRef.current = stopFlags
  laneOffsetsRef.current = laneOffsets

  useEffect(() => {
    if (pathPointsRef.current.length < 2) return
    let frameId: number
    const startTime = performance.now()

    const tick = (now: number) => {
      const group = groupRef.current
      const pathPoints = pathPointsRef.current
      const stopFlags = stopFlagsRef.current
      const laneOffsets = laneOffsetsRef.current
      if (!group || pathPoints.length < 2) {
        frameId = requestAnimationFrame(tick)
        return
      }

      // Visits every point forward then back, e.g. [0,1,2,1,0] for a 3-point line —
      // the shared terminus at each end gets two consecutive dwells across the loop
      // seam, reading as a brief layover before reversing. Waypoints (stopFlags=false)
      // get zero dwell, so the train passes through them without pausing.
      const stopSequence: number[] = []
      for (let i = 0; i < pathPoints.length; i++) stopSequence.push(i)
      for (let i = pathPoints.length - 2; i >= 0; i--) stopSequence.push(i)

      const dwellFor = (idx: number) => (stopFlags[idx] ? dwellMs : 0)

      const segmentLengths: number[] = []
      for (let i = 0; i < pathPoints.length - 1; i++) {
        const seg = segmentRefs.current[i]
        if (!seg) {
          segmentLengths.push(0)
          continue
        }
        seg.setAttribute('d', routeOrthogonal(offsetSegment(pathPoints[i], pathPoints[i + 1], laneOffsets[i] ?? 0)))
        segmentLengths.push(seg.getTotalLength())
      }

      const travelDurations: number[] = []
      let cycleDuration = 0
      for (let i = 0; i < stopSequence.length; i++) cycleDuration += dwellFor(stopSequence[i])
      for (let i = 0; i < stopSequence.length - 1; i++) {
        const segIndex = Math.min(stopSequence[i], stopSequence[i + 1])
        const duration = segmentLengths[segIndex] / speed
        travelDurations.push(duration)
        cycleDuration += duration
      }

      let remaining = (now - startTime) % cycleDuration
      let x = pathPoints[stopSequence[0]].x
      let y = pathPoints[stopSequence[0]].y

      for (let i = 0; i < stopSequence.length; i++) {
        const dwell = dwellFor(stopSequence[i])
        if (remaining < dwell) {
          const p = pathPoints[stopSequence[i]]
          x = p.x
          y = p.y
          break
        }
        remaining -= dwell

        if (i < stopSequence.length - 1) {
          const duration = travelDurations[i]
          if (remaining < duration) {
            const from = stopSequence[i]
            const to = stopSequence[i + 1]
            const segIndex = Math.min(from, to)
            const forward = to > from
            const segLength = segmentLengths[segIndex]
            const frac = duration > 0 ? remaining / duration : 0
            const distance = forward ? frac * segLength : (1 - frac) * segLength
            const segPath = segmentRefs.current[segIndex]
            if (segPath) {
              const point = segPath.getPointAtLength(distance)
              x = point.x
              y = point.y

              const eps = 1
              const a = segPath.getPointAtLength(Math.max(0, distance - eps))
              const b = segPath.getPointAtLength(Math.min(segLength, distance + eps))
              let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
              if (!forward) angle += 180
              lastAngleRef.current = angle
            }
            break
          }
          remaining -= duration
        }
      }

      group.setAttribute('transform', `translate(${x}, ${y}) rotate(${lastAngleRef.current})`)
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
    // Intentionally excludes pathPoints/stopFlags: those are read live via refs
    // above so the loop's startTime survives re-renders instead of restarting.
  }, [lineId, dwellMs, speed])

  if (pathPoints.length < 2) return null

  return (
    <>
      {pathPoints.slice(0, -1).map((_, i) => (
        <path
          key={i}
          ref={el => {
            segmentRefs.current[i] = el
          }}
          d=""
          fill="none"
          stroke="none"
          opacity={0}
        />
      ))}
      <g ref={groupRef} style={{ pointerEvents: 'none' }}>
        {/* Body fill matches the canvas surface (not a fixed dark ink token) so the
            capsule reads as a colored-outline cutout against the map in either theme,
            instead of a solid black blob once the canvas itself turns light. */}
        <rect x={-13} y={-3.25} width={26} height={6.5} rx={3.25} fill="var(--bg-page)" stroke={color} strokeWidth={1.4} />
        <line x1={-10.25} y1={-2.15} x2={10.25} y2={-2.15} stroke={color} strokeWidth={0.6} opacity={0.6} strokeLinecap="round" />
        <line x1={-10.25} y1={2.15} x2={10.25} y2={2.15} stroke={color} strokeWidth={0.6} opacity={0.6} strokeLinecap="round" />
        <circle cx={-6} cy={0} r={1.4} fill="none" stroke={color} strokeWidth={0.8} opacity={0.85} />
        <circle cx={0} cy={0} r={1.4} fill="none" stroke={color} strokeWidth={0.8} opacity={0.85} />
        <circle cx={6} cy={0} r={1.4} fill="none" stroke={color} strokeWidth={0.8} opacity={0.85} />
        {/* Headlight accent at the nose end, so the train's facing direction reads at a glance. */}
        <circle cx={11.4} cy={0} r={0.65} fill={color} opacity={0.9} />
      </g>
    </>
  )
}
