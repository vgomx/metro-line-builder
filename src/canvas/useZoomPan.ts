import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { select } from 'd3-selection'
import type { Selection } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import type { D3ZoomEvent, ZoomBehavior, ZoomTransform } from 'd3-zoom'
import 'd3-transition'

const ZOOM_STEP = 1.2

/**
 * Wheel always zooms (d3-zoom default). Drag-to-pan is restricted to the middle
 * mouse button, space-held-left-drag, or (when panMode is true, i.e. the Hand
 * tool is active) plain left-drag — otherwise left-drag stays free for
 * marquee-select / station-dragging in the caller.
 */
export function useZoomPan(svgRef: RefObject<SVGSVGElement | null>, panMode: boolean) {
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const spaceHeldRef = useRef(false)
  const panModeRef = useRef(panMode)
  panModeRef.current = panMode

  const behaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const selectionRef = useRef<Selection<SVGSVGElement, unknown, null, undefined> | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      e.preventDefault() // stop the page from scrolling on every auto-repeat while held
      if (!spaceHeldRef.current) {
        spaceHeldRef.current = true
        setSpaceHeld(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      spaceHeldRef.current = false
      setSpaceHeld(false)
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
          return event.button === 1 || spaceHeldRef.current || panModeRef.current
        }
        return true
      })
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        setTransform(event.transform)
      })

    const selection = select(svg)
    selection.call(zoomBehavior)
    behaviorRef.current = zoomBehavior
    selectionRef.current = selection

    return () => {
      selection.on('.zoom', null)
      behaviorRef.current = null
      selectionRef.current = null
    }
  }, [svgRef])

  const zoomBy = useCallback((factor: number) => {
    const behavior = behaviorRef.current
    const selection = selectionRef.current
    if (!behavior || !selection) return
    behavior.scaleBy(selection.transition().duration(150), factor)
  }, [])

  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy])
  const zoomOut = useCallback(() => zoomBy(1 / ZOOM_STEP), [zoomBy])

  return { transform, zoomIn, zoomOut, spaceHeld }
}
