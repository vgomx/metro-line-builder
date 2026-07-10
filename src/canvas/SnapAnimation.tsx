import { useEffect, useRef } from 'react'
import type { Line, Point, Station } from '../types'
import { buildLinePath, buildNetworkGeometry } from './lineNodes'

interface SnapAnimationProps {
  /** Lines touched by the drag — each springs along on its own ghost stroke. */
  affectedLines: Line[]
  /** Every visible line, so shared-lane offsets can be recomputed as stations move. */
  lineList: Line[]
  /** Station positions as they sit now, settled, after the drag. */
  stations: Record<string, Station>
  /** Where each dragged station sat before the drag began. */
  originalPositions: Record<string, Point>
  onComplete: () => void
}

const DURATION_MS = 550

/** Overshoots past 1 then settles — the "spring" in the snap. */
function easeOutElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3
  if (t <= 0) return 0
  if (t >= 1) return 1
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}

/**
 * Shapes every affected line at a given point in the spring.
 *
 * The eased factor is applied to the dragged *station positions*, and the routed
 * path is then re-derived from those — rather than lerping between the line's
 * finished pre- and post-drag vertex lists. Those lists routinely differ in
 * length: routeOrthogonal only inserts a 45° elbow when a segment isn't axis
 * aligned, so a station crossing an alignment boundary makes an elbow appear or
 * vanish. Point-wise blending can't survive that (it used to bail out and skip
 * the animation entirely, which read as an instant, bounce-less snap).
 *
 * Re-deriving also means the ghost runs through the very same pipeline as
 * LinePath, so at rest it lands exactly on the real stroke instead of near it.
 */
function buildFramePaths(
  eased: number,
  { affectedLines, lineList, stations, originalPositions }: Omit<SnapAnimationProps, 'onComplete'>,
): string[] {
  const frameStations: Record<string, Station> = { ...stations }
  for (const id of Object.keys(originalPositions)) {
    const settled = stations[id]
    if (!settled) continue
    const origin = originalPositions[id]
    frameStations[id] = {
      ...settled,
      x: origin.x + (settled.x - origin.x) * eased,
      y: origin.y + (settled.y - origin.y) * eased,
    }
  }

  const network = buildNetworkGeometry(lineList, frameStations)
  return affectedLines.map(line => {
    const geometry = network.byLine.get(line.id)
    return geometry ? buildLinePath(geometry, line.id, network.segmentLineMap) : ''
  })
}

/**
 * Plays once: whips each affected line's pre-drag shape into its settled post-drag
 * shape with a springy overshoot, so finishing a station move reads as a deliberate
 * snap rather than the drag's reference ghost just vanishing. The real LinePath is
 * already sitting at the destination underneath, so this only needs to run until it
 * catches up, then unmount.
 */
export function SnapAnimation(props: SnapAnimationProps) {
  const { affectedLines, onComplete } = props
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Read live through a ref so the loop keeps one stable start time across the
  // re-renders a drag or unrelated canvas interaction triggers, instead of restarting.
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    let frameId: number
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      const paths = buildFramePaths(easeOutElastic(t), propsRef.current)
      paths.forEach((d, i) => {
        if (d) pathRefs.current[i]?.setAttribute('d', d)
      })
      if (t < 1) frameId = requestAnimationFrame(tick)
      else onCompleteRef.current()
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
    // Mounted fresh per drag (keyed by snap session); props are read live via the ref.
  }, [])

  const initial = buildFramePaths(0, props)

  return (
    <>
      {affectedLines.map((line, i) => (
        <path
          key={line.id}
          ref={el => {
            pathRefs.current[i] = el
          }}
          d={initial[i]}
          fill="none"
          stroke={line.color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: 'none' }}
        />
      ))}
    </>
  )
}
