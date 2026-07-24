import { useEffect, useRef } from 'react'
import type { Point } from '../types'
import { buildTimeline, sampleTrain } from './trainMotion'
import type { TrainSample } from './trainMotion'

interface TrainMarkerProps {
  lineId: string
  color: string
  /** Ordered stops along this line's own lane — where the train dwells or turns. */
  stopPoints: Point[]
  /** Parallel to stopPoints — true where the train should dwell (real stations), false for waypoints it glides through. */
  stopFlags: boolean[]
  /** Path `d` for the track between each consecutive pair of stops, already lane-offset and filleted. */
  segmentPaths: string[]
  /** How long the train dwells at each station, in ms. Long enough for a stop to read as a stop:
   * passengers gather under the station's name while the train is in it, and at the old 1400 the
   * whole service felt like it was hurrying between places rather than calling at them. */
  dwellMs?: number
  /** Travel speed in px/ms. */
  speed?: number
  /** Fraction of the full back-and-forth cycle to shift this car by. The two services on a
   * line run at phase 0 and 0.5 — half a cycle apart is a mirror in time, so one is heading
   * out wherever the other is heading back: a train from each direction, passing at the middle. */
  phase?: number
  /** The train being ridden: wears a pulsing ring so it reads as the one under the camera. */
  highlighted?: boolean
  /** Called every frame with the car's live world position and its motion sample. Read through a
   * ref so it never restarts the loop; used to drive the follow-camera and the trip view. */
  onFrame?: (x: number, y: number, sample: TrainSample) => void
  /** When set, an enlarged invisible hit-area lets a click on the moving car start a ride. */
  onSelect?: () => void
}

/**
 * The car's footprint — small enough that two can share a line. Down from 20x5: at that size
 * a single car filled the 5px stroke and read as a lozenge laid over the track; a 3.4px car
 * rides within it as rolling stock.
 */
const CAR_LENGTH = 15
const CAR_HEIGHT = 3.4

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
export function TrainMarker({ lineId, color, stopPoints, stopFlags, segmentPaths, dwellMs = 2200, speed = 0.12, phase = 0, highlighted = false, onFrame, onSelect }: TrainMarkerProps) {
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
  const onFrameRef = useRef(onFrame)
  stopPointsRef.current = stopPoints
  stopFlagsRef.current = stopFlags
  segmentPathsRef.current = segmentPaths
  onFrameRef.current = onFrame

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

      const timeline = buildTimeline({ stopPoints, stopFlags }, segmentLengths, dwellMs, speed)
      const sample = sampleTrain({ stopPoints, stopFlags }, timeline, now - startTime, phase)
      if (!sample) {
        frameId = requestAnimationFrame(tick)
        return
      }

      let x: number
      let y: number
      if (sample.kind === 'dwell') {
        x = stopPoints[sample.stopIndex].x
        y = stopPoints[sample.stopIndex].y
      } else {
        // The pure sample gives the eased position along the segment; only here, with the live
        // path element, does it become a point and a heading.
        const segLength = segmentLengths[sample.segIndex] ?? 0
        const distance = sample.forward ? sample.travelled * segLength : (1 - sample.travelled) * segLength
        const segPath = segmentRefs.current[sample.segIndex]
        if (segPath && segLength > 0) {
          const point = segPath.getPointAtLength(distance)
          x = point.x
          y = point.y

          const eps = 1
          const a = segPath.getPointAtLength(Math.max(0, distance - eps))
          const b = segPath.getPointAtLength(Math.min(segLength, distance + eps))
          let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
          if (!sample.forward) angle += 180
          lastAngleRef.current = angle
        } else {
          x = stopPoints[sample.from].x
          y = stopPoints[sample.from].y
        }
      }

      // Both services ride the centreline; the two just pass through each other where they
      // cross, which reads fine at this size.
      group.setAttribute('transform', `translate(${x}, ${y}) rotate(${lastAngleRef.current})`)
      onFrameRef.current?.(x, y, sample)
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
    // Intentionally excludes the geometry props: those are read live via refs
    // above so the loop's startTime survives re-renders instead of restarting.
  }, [lineId, dwellMs, speed, phase])

  if (stopPoints.length < 2) return null

  return (
    <>
      {segmentPaths.map((_, i) => (
        <path
          key={i}
          data-export="exclude"
          ref={el => {
            segmentRefs.current[i] = el
          }}
          d=""
          fill="none"
          stroke="none"
          opacity={0}
        />
      ))}
      <g ref={groupRef} data-export="exclude" style={{ pointerEvents: 'none' }}>
        {/* The ridden car wears a pulsing halo in its line colour so the eye can hold onto it
            while the camera tracks — and so its twin, hidden during a ride, isn't missed. The
            circle is rotation-symmetric, so the group's heading rotation leaves it be. */}
        {highlighted && (
          <circle className="mlb-train-ring" cx={0} cy={0} r={9} fill="none" stroke={color} strokeWidth={1.5} />
        )}
        {/* An enlarged, invisible target so a click can catch the moving car and start a ride —
            the visible body alone is far too small and fast to hit. */}
        {onSelect && (
          <rect
            x={-13}
            y={-9}
            width={26}
            height={18}
            rx={9}
            fill="transparent"
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={onSelect}
          >
            <title>Ride this train</title>
          </rect>
        )}
        {/* Capsule body with a colored outline (line color), echoing a real train-car
            silhouette — trim lines and portholes instead of a solid-fill blob.

            Body carries a wash of its own line's colour over the canvas rather than the bare
            page, so a car is legible as belonging to a service even where it's crossing a
            junction away from its own track. The mix resolves against whichever page it's on,
            so neither theme needs its own train. */}
        <rect
          x={-CAR_LENGTH / 2}
          y={-CAR_HEIGHT / 2}
          width={CAR_LENGTH}
          height={CAR_HEIGHT}
          rx={CAR_HEIGHT / 2}
          fill={`color-mix(in srgb, ${color} var(--train-tint), var(--bg-page))`}
          stroke={color}
          strokeWidth={1}
        />
        {/* Windows, filled rather than outlined — a ring this small closes into a smudge where
            a dot stays a window. Positions scale with the body so shrinking the car doesn't
            crowd them. */}
        <circle cx={-CAR_LENGTH * 0.23} cy={0} r={0.6} fill={color} opacity={0.75} />
        <circle cx={0} cy={0} r={0.6} fill={color} opacity={0.75} />
        <circle cx={CAR_LENGTH * 0.23} cy={0} r={0.6} fill={color} opacity={0.75} />
        {/* Headlight accent at the nose end, so the train's facing direction reads at a glance. */}
        <circle cx={CAR_LENGTH / 2 - 1} cy={0} r={0.5} fill={color} opacity={0.9} />
      </g>
    </>
  )
}
