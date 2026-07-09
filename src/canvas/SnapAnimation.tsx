import { useEffect, useRef } from 'react'
import type { Point } from '../types'
import { roundVertices } from './routing'

interface SnapAnimationProps {
  color: string
  fromPoints: Point[]
  toPoints: Point[]
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
 * Plays once: whips a line's pre-drag shape into its settled post-drag shape with
 * a springy overshoot, so finishing a station move reads as a deliberate snap
 * rather than the drag's reference ghost just vanishing. The real LinePath is
 * already sitting at the destination underneath, so this only needs to run until
 * it catches up, then unmount.
 */
export function SnapAnimation({ color, fromPoints, toPoints, onComplete }: SnapAnimationProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (fromPoints.length !== toPoints.length) {
      onCompleteRef.current()
      return
    }
    let frameId: number
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      const eased = easeOutElastic(t)
      const points = fromPoints.map((p, i) => ({
        x: p.x + (toPoints[i].x - p.x) * eased,
        y: p.y + (toPoints[i].y - p.y) * eased,
      }))
      pathRef.current?.setAttribute('d', roundVertices(points))
      if (t < 1) {
        frameId = requestAnimationFrame(tick)
      } else {
        onCompleteRef.current()
      }
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [fromPoints, toPoints])

  return (
    <path
      ref={pathRef}
      d={roundVertices(fromPoints)}
      fill="none"
      stroke={color}
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ pointerEvents: 'none' }}
    />
  )
}
