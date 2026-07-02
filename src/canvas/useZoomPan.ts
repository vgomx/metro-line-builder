import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import type { D3ZoomEvent, ZoomTransform } from 'd3-zoom'

/**
 * Wheel always zooms (d3-zoom default). Drag-to-pan is deliberately restricted to the
 * middle mouse button or space-held-left-drag, so plain left-drag stays free for
 * marquee-select / station-dragging in the caller.
 */
export function useZoomPan(svgRef: RefObject<SVGSVGElement | null>) {
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const spaceHeldRef = useRef(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeldRef.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeldRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4])
      .filter((event: Event) => {
        if (event.type === 'wheel') return true
        if (event instanceof MouseEvent) {
          return event.button === 1 || spaceHeldRef.current
        }
        return true
      })
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        setTransform(event.transform)
      })

    const selection = select(svg)
    selection.call(zoomBehavior)

    return () => {
      selection.on('.zoom', null)
    }
  }, [svgRef])

  return transform
}
