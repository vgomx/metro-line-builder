import { useEffect, useRef } from 'react'
import type { RefanLine } from './lineNodes'
import { offsetPolylineIndexed } from './lineNodes'
import { routeOrthogonal } from './routing'

interface RefanAnimationProps {
  lines: RefanLine[]
  onComplete: () => void
}

const DURATION_MS = 460

/** Calm settle — no overshoot, so parallel lanes never cross as they slide apart. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function pathForOffsets(line: RefanLine, offsets: number[]): string {
  return routeOrthogonal(offsetPolylineIndexed(line.vertices, offsets).points)
}

/**
 * Slides each affected line from its old lane to its new one when the shared-corridor
 * layout changes — a line joining or leaving a corridor makes its neighbours fan out (or
 * back together) rather than teleporting. The offsets are interpolated and the path is
 * re-derived each frame (not two finished shapes blended), so lane-change ramps grow and
 * shrink smoothly and corners stay clean throughout. The real LinePath renders the settled
 * result underneath; these ghosts stand in for the re-laning lines until they catch up.
 */
export function RefanAnimation({ lines, onComplete }: RefanAnimationProps) {
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const linesRef = useRef(lines)
  linesRef.current = lines

  useEffect(() => {
    let frameId: number
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      const eased = easeOutCubic(t)
      linesRef.current.forEach((line, i) => {
        const offsets = line.fromOffsets.map((from, k) => from + (line.toOffsets[k] - from) * eased)
        pathRefs.current[i]?.setAttribute('d', pathForOffsets(line, offsets))
      })
      if (t < 1) frameId = requestAnimationFrame(tick)
      else onCompleteRef.current()
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
    // Mounted fresh per re-fan (keyed by session); lines are read live via the ref.
  }, [])

  return (
    <>
      {lines.map((line, i) => (
        <path
          key={line.lineId}
          ref={el => {
            pathRefs.current[i] = el
          }}
          d={pathForOffsets(line, line.fromOffsets)}
          fill="none"
          stroke={line.color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
          style={{ pointerEvents: 'none' }}
        />
      ))}
    </>
  )
}
