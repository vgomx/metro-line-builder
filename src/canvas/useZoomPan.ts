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
  // True only while a pointer-drag pan is in flight (not a wheel zoom), so the
  // caller can swap the open-hand cursor for the closed "grabbing" one mid-drag.
  const [panning, setPanning] = useState(false)
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
      .on('start', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        // A drag pan carries a mouse/pointer/touch sourceEvent; a wheel zoom carries
        // a wheel one — only the former should flip the cursor to "grabbing".
        const src = event.sourceEvent as Event | undefined
        if (src && src.type !== 'wheel') setPanning(true)
      })
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        setTransform(event.transform)
      })
      .on('end', () => {
        setPanning(false)
      })

    const selection = select(svg)
    selection.call(zoomBehavior)
    behaviorRef.current = zoomBehavior
    selectionRef.current = selection

    // d3-zoom skips preventDefault on a wheel event that wouldn't change the scale
    // (i.e. already at the scaleExtent limit) — past 400% that lets the gesture fall
    // through as the browser's own pinch/ctrl+wheel zoom, scaling the whole page
    // (panels included) instead of just the canvas. Always claim it ourselves.
    const blockPageZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault()
    }
    svg.addEventListener('wheel', blockPageZoom, { passive: false })

    return () => {
      selection.on('.zoom', null)
      svg.removeEventListener('wheel', blockPageZoom)
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

  /** Eases the viewport to frame a world-space box, centred with a little breathing room.
   * Used to fly to a line when it's picked from the list, so navigation feels deliberate. */
  const frameBounds = useCallback(
    (bounds: { x: number; y: number; width: number; height: number }, paddingPx = 90) => {
      const svg = svgRef.current
      const behavior = behaviorRef.current
      const selection = selectionRef.current
      if (!svg || !behavior || !selection || bounds.width <= 0 || bounds.height <= 0) return
      const rect = svg.getBoundingClientRect()
      const fit = Math.min((rect.width - 2 * paddingPx) / bounds.width, (rect.height - 2 * paddingPx) / bounds.height)
      // Never zoom in past 2× on a short line (it'd fill the screen and lose context), and
      // stay within the behaviour's own scaleExtent so d3 doesn't clamp mid-transition.
      const scale = Math.max(0.25, Math.min(2, fit))
      const tx = rect.width / 2 - scale * (bounds.x + bounds.width / 2)
      const ty = rect.height / 2 - scale * (bounds.y + bounds.height / 2)
      behavior.transform(selection.transition().duration(480), zoomIdentity.translate(tx, ty).scale(scale))
    },
    [svgRef],
  )

  return { transform, zoomIn, zoomOut, spaceHeld, panning, frameBounds }
}
