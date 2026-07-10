import { useEffect, useRef } from 'react'
import type { Point } from '../types'

interface TrainMarkerProps {
  lineId: string
  color: string
  /** Ordered stops along this line's own lane — where the train dwells or turns. */
  stopPoints: Point[]
  /** Parallel to stopPoints — true where the train should dwell (real stations), false for waypoints it glides through. */
  stopFlags: boolean[]
  /** Path `d` for the track between each consecutive pair of stops, already lane-offset and filleted. */
  segmentPaths: string[]
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
 *
 * The track it rides comes in ready-made (see buildLineTrack) as the very geometry
 * LinePath draws, so a train always sits on its own line's lane rather than on a
 * neighbour's rails wherever lines fan out along a shared stretch.
 */
export function TrainMarker({ lineId, color, stopPoints, stopFlags, segmentPaths, dwellMs = 1400, speed = 0.12 }: TrainMarkerProps) {
  const groupRef = useRef<SVGGElement>(null)
  const segmentRefs = useRef<(SVGPathElement | null)[]>([])
  const lastAngleRef = useRef(0)
  // Read fresh every frame instead of closing over the props, so the animation
  // loop below can keep a stable start time (and thus keep playing without a
  // jump) across re-renders that only touch positions — e.g. dragging a
  // station or any unrelated canvas interaction — rather than restarting.
  const stopPointsRef = useRef(stopPoints)
  const stopFlagsRef = useRef(stopFlags)
  const segmentPathsRef = useRef(segmentPaths)
  stopPointsRef.current = stopPoints
  stopFlagsRef.current = stopFlags
  segmentPathsRef.current = segmentPaths

  // The rails only move when a station does. Re-stamping `d` every frame would
  // invalidate each path's cached geometry and force getTotalLength to re-measure
  // it from scratch — the single most expensive thing this loop can do.
  const appliedPathsRef = useRef<string[]>([])
  const segmentLengthsRef = useRef<number[]>([])

  useEffect(() => {
    let frameId: number
    const startTime = performance.now()

    const tick = (now: number) => {
      const group = groupRef.current
      const stopPoints = stopPointsRef.current
      const stopFlags = stopFlagsRef.current
      const segmentPaths = segmentPathsRef.current
      if (!group || stopPoints.length < 2) {
        frameId = requestAnimationFrame(tick)
        return
      }

      // Visits every stop forward then back, e.g. [0,1,2,1,0] for a 3-stop line —
      // the shared terminus at each end gets two consecutive dwells across the loop
      // seam, reading as a brief layover before reversing. Waypoints (stopFlags=false)
      // get zero dwell, so the train passes through them without pausing.
      const stopSequence: number[] = []
      for (let i = 0; i < stopPoints.length; i++) stopSequence.push(i)
      for (let i = stopPoints.length - 2; i >= 0; i--) stopSequence.push(i)

      const dwellFor = (idx: number) => (stopFlags[idx] ? dwellMs : 0)

      const applied = appliedPathsRef.current
      const segmentLengths = segmentLengthsRef.current
      for (let i = 0; i < segmentPaths.length; i++) {
        const seg = segmentRefs.current[i]
        if (!seg || !segmentPaths[i]) {
          segmentLengths[i] = 0
          continue
        }
        if (applied[i] !== segmentPaths[i]) {
          seg.setAttribute('d', segmentPaths[i])
          applied[i] = segmentPaths[i]
          segmentLengths[i] = seg.getTotalLength()
        }
      }

      const travelDurations: number[] = []
      let cycleDuration = 0
      for (let i = 0; i < stopSequence.length; i++) cycleDuration += dwellFor(stopSequence[i])
      for (let i = 0; i < stopSequence.length - 1; i++) {
        const segIndex = Math.min(stopSequence[i], stopSequence[i + 1])
        const duration = (segmentLengths[segIndex] ?? 0) / speed
        travelDurations.push(duration)
        cycleDuration += duration
      }
      if (cycleDuration <= 0) {
        frameId = requestAnimationFrame(tick)
        return
      }

      let remaining = (now - startTime) % cycleDuration
      let x = stopPoints[stopSequence[0]].x
      let y = stopPoints[stopSequence[0]].y

      for (let i = 0; i < stopSequence.length; i++) {
        const dwell = dwellFor(stopSequence[i])
        if (remaining < dwell) {
          const p = stopPoints[stopSequence[i]]
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
            const segLength = segmentLengths[segIndex] ?? 0
            const frac = duration > 0 ? remaining / duration : 0
            const distance = forward ? frac * segLength : (1 - frac) * segLength
            const segPath = segmentRefs.current[segIndex]
            if (segPath && segLength > 0) {
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
    // Intentionally excludes the geometry props: those are read live via refs
    // above so the loop's startTime survives re-renders instead of restarting.
  }, [lineId, dwellMs, speed])

  if (stopPoints.length < 2) return null

  return (
    <>
      {segmentPaths.map((_, i) => (
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
        {/* Capsule body with a colored outline (line color), echoing a real train-car
            silhouette — trim lines and portholes instead of a solid-fill blob. Filled
            with the canvas background, like the station markers, so the car reads as a
            vehicle sitting on the track in either theme rather than a black lozenge. */}
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
