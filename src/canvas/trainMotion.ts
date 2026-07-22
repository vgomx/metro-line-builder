import type { Point } from '../types'

/**
 * The one source of truth for where a train is at a given moment.
 *
 * TrainMarker used to keep this math inlined in its animation loop and write the result
 * straight to the DOM, so nothing outside that loop could tell where a train was — which is
 * exactly what "follow a train" and a live trip view both need. The timing lives here now as
 * pure functions: the marker still turns a sample into pixels (it owns the path elements that
 * measure the curve), but the camera and the right panel can read the same sample to centre on
 * a car or light up its next stop.
 */

/** What the panel and the chime need to know about a ride — updated only when it changes, not
 * every frame. Direction is in station order: +1 heads toward the last station, -1 toward the first. */
export interface RideProgress {
  lineId: string
  /** The station the train is pulling into or sitting at, or null between-stops with none resolved. */
  nextStationId: string | null
  direction: 1 | -1
  /** True while dwelling at a station, false while running between them. */
  atStation: boolean
}

export interface TrainGeometry {
  /** Ordered stops along the lane — where the train dwells or turns. */
  stopPoints: Point[]
  /** Parallel to stopPoints: true at real stations (dwell), false at waypoints (glide through). */
  stopFlags: boolean[]
}

export interface TrainTimeline {
  /** Visits every stop forward then back, e.g. [0,1,2,1,0] — the shape of one full service cycle. */
  stopSequence: number[]
  /** Travel time for each hop between consecutive sequence entries, in ms. */
  travelDurations: number[]
  /** Total time for the whole out-and-back loop, in ms. */
  cycleDuration: number
  /** How long the train dwells at each real station, in ms. */
  dwellMs: number
}

/** Every stop out then back, so the train shuttles rather than teleporting to the start. */
export function buildStopSequence(count: number): number[] {
  const sequence: number[] = []
  for (let i = 0; i < count; i++) sequence.push(i)
  for (let i = count - 2; i >= 0; i--) sequence.push(i)
  return sequence
}

/**
 * Turn measured segment lengths into a timeline. Segment lengths come from the caller because
 * only it (with the live path elements) can measure the filleted curve; everything downstream
 * of that measurement is pure.
 */
export function buildTimeline(
  geometry: TrainGeometry,
  segmentLengths: number[],
  dwellMs: number,
  speed: number,
): TrainTimeline {
  const { stopPoints, stopFlags } = geometry
  const stopSequence = buildStopSequence(stopPoints.length)
  const dwellFor = (idx: number) => (stopFlags[idx] ? dwellMs : 0)

  let cycleDuration = 0
  for (const idx of stopSequence) cycleDuration += dwellFor(idx)

  const travelDurations: number[] = []
  for (let i = 0; i < stopSequence.length - 1; i++) {
    const segIndex = Math.min(stopSequence[i], stopSequence[i + 1])
    const duration = (segmentLengths[segIndex] ?? 0) / speed
    travelDurations.push(duration)
    cycleDuration += duration
  }

  return { stopSequence, travelDurations, cycleDuration, dwellMs }
}

/**
 * Accelerate away from a station and decelerate into one, but glide through waypoints at speed.
 * easeIn ends and easeOut begins at the same rate, so a waypoint between two segments is crossed
 * with continuous speed — no lurch. `frac` is raw progress along the segment (0..1), the return
 * is how far along it the train actually is.
 */
export function easedTravel(frac: number, departingStation: boolean, arrivingStation: boolean): number {
  if (departingStation && arrivingStation) {
    return frac < 0.5 ? 2 * frac * frac : 1 - (-2 * frac + 2) ** 2 / 2
  }
  if (departingStation) return frac * frac
  if (arrivingStation) return frac * (2 - frac)
  return frac
}

export type TrainSample =
  | {
      kind: 'dwell'
      /** Index into stopPoints where the train is sitting (always a real station). */
      stopIndex: number
      /** Movement sense of the leg it will next set out on: +1 toward higher indices, -1 toward lower. */
      direction: 1 | -1
      /** The real-station stopPoints index the train is arriving at / sitting at (== stopIndex here). */
      nextStationStop: number
    }
  | {
      kind: 'travel'
      /** Segment index (== min(from, to)) whose path the caller measures for pixel position. */
      segIndex: number
      from: number
      to: number
      /** True when travelling in increasing-index order along the segment path. */
      forward: boolean
      /** Eased position along the segment in forward orientation, 0..1. */
      travelled: number
      direction: 1 | -1
      /** The next real-station stopPoints index the train will dwell at (skips waypoints). */
      nextStationStop: number
    }

/** The next real station at or after sequence position `seqPos`, following the cycle's wrap. */
function nextStationStopFrom(stopSequence: number[], stopFlags: boolean[], seqPos: number): number {
  for (let step = 0; step < stopSequence.length; step++) {
    const idx = stopSequence[(seqPos + step) % stopSequence.length]
    if (stopFlags[idx]) return idx
  }
  return stopSequence[seqPos]
}

/**
 * Where the train is at `elapsedMs` into its life, shifted by `phase` (a fraction of the cycle;
 * a line's two services run at 0 and 0.5 so they pass going opposite ways). Returns a discrete
 * locator — the caller converts a `travel` sample to x/y with the segment's path element.
 */
export function sampleTrain(
  geometry: TrainGeometry,
  timeline: TrainTimeline,
  elapsedMs: number,
  phase: number,
): TrainSample | null {
  const { stopFlags } = geometry
  const { stopSequence, travelDurations, cycleDuration, dwellMs } = timeline
  if (cycleDuration <= 0 || stopSequence.length < 2) return null

  const dwellAt = (seqPos: number) => (stopFlags[stopSequence[seqPos]] ? dwellMs : 0)

  let remaining = (((elapsedMs + phase * cycleDuration) % cycleDuration) + cycleDuration) % cycleDuration

  for (let i = 0; i < stopSequence.length; i++) {
    const dwell = dwellAt(i)
    const legSign: 1 | -1 = directionAt(stopSequence, i)
    if (remaining < dwell) {
      const stopIndex = stopSequence[i]
      return { kind: 'dwell', stopIndex, direction: legSign, nextStationStop: stopIndex }
    }
    remaining -= dwell

    if (i < stopSequence.length - 1) {
      const duration = travelDurations[i]
      if (remaining < duration) {
        const from = stopSequence[i]
        const to = stopSequence[i + 1]
        const segIndex = Math.min(from, to)
        const forward = to > from
        const frac = duration > 0 ? remaining / duration : 0
        const travelled = easedTravel(frac, stopFlags[from], stopFlags[to])
        const nextStationStop = nextStationStopFrom(stopSequence, stopFlags, i + 1)
        return { kind: 'travel', segIndex, from, to, forward, travelled, direction: legSign, nextStationStop }
      }
      remaining -= duration
    }
  }

  // Numerical fallback: sit at the sequence's first stop.
  return { kind: 'dwell', stopIndex: stopSequence[0], direction: 1, nextStationStop: stopSequence[0] }
}

/** Sign of the leg leaving sequence position `seqPos` (wrapping at the seam). */
function directionAt(stopSequence: number[], seqPos: number): 1 | -1 {
  const here = stopSequence[seqPos]
  const next = stopSequence[(seqPos + 1) % stopSequence.length]
  return next >= here ? 1 : -1
}
