import { useEffect, useRef } from 'react'

interface TrainMarkerProps {
  lineId: string
  color: string
  /** Time in ms to travel the full line one-way before reversing (ping-pong). */
  durationMs?: number
}

/**
 * Walks a marker back and forth along the line's <path id={lineId}> using
 * path.getPointAtLength(), written directly to the DOM each animation frame
 * (bypassing React state) so this stays smooth regardless of render cost
 * elsewhere in the app. Reads path length fresh every frame so it keeps
 * tracking correctly even while stations are being dragged live.
 */
export function TrainMarker({ lineId, color, durationMs = 7000 }: TrainMarkerProps) {
  const groupRef = useRef<SVGGElement>(null)

  useEffect(() => {
    let frameId: number
    const startTime = performance.now()

    const tick = (now: number) => {
      const path = document.getElementById(lineId) as SVGPathElement | null
      const group = groupRef.current
      if (path && group) {
        const totalLength = path.getTotalLength()
        if (totalLength > 0) {
          const cycle = durationMs * 2
          const elapsed = (now - startTime) % cycle
          const t = elapsed <= durationMs ? elapsed / durationMs : 2 - elapsed / durationMs
          const point = path.getPointAtLength(t * totalLength)
          group.setAttribute('transform', `translate(${point.x}, ${point.y})`)
          group.style.display = ''
        } else {
          group.style.display = 'none'
        }
      }
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [lineId, durationMs])

  return (
    <g ref={groupRef} style={{ pointerEvents: 'none' }}>
      <circle r={6} fill={color} stroke="var(--ink-0)" strokeWidth={2} />
    </g>
  )
}
