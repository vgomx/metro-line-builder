import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { select } from 'd3-selection'
import type { Selection } from 'd3-selection'
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom'
import type { D3ZoomEvent, ZoomBehavior, ZoomTransform } from 'd3-zoom'
import 'd3-transition'

const ZOOM_STEP = 1.2

/** Edges of the svg hidden behind floating chrome. The svg runs the full width of the
 * window, so its geometric centre isn't the centre of what the user can actually see. */
export interface ViewportInsets {
  left: number
  right: number
  top: number
  bottom: number
}

const NO_INSETS: ViewportInsets = { left: 0, right: 0, top: 0, bottom: 0 }

/**
 * Wheel always zooms (d3-zoom default). Drag-to-pan is restricted to the middle
 * mouse button, space-held-left-drag, or (when panMode is true, i.e. the Hand
 * tool is active) plain left-drag — otherwise left-drag stays free for
 * marquee-select / station-dragging in the caller.
 */
export function useZoomPan(
  svgRef: RefObject<SVGSVGElement | null>,
  panMode: boolean,
  insets: ViewportInsets = NO_INSETS,
) {
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)
  const [spaceHeld, setSpaceHeld] = useState(false)
  // True only while a pointer-drag pan is in flight (not a wheel zoom), so the
  // caller can swap the open-hand cursor for the closed "grabbing" one mid-drag.
  const [panning, setPanning] = useState(false)
  const spaceHeldRef = useRef(false)
  const panModeRef = useRef(panMode)
  panModeRef.current = panMode
  // Read through a ref so a fresh insets object each render doesn't re-create frameBounds
  // (and with it the callers' fitContent/frameLine handles) on every render.
  const insetsRef = useRef(insets)
  insetsRef.current = insets

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
        // A plain wheel is a two-finger trackpad scroll (or mouse wheel) — that pans, via
        // the separate handler below. Only a pinch, which the trackpad reports as
        // ctrl+wheel, is left to d3 to turn into a zoom.
        if (event.type === 'wheel') return (event as WheelEvent).ctrlKey
        if (event instanceof MouseEvent) {
          return event.button === 1 || spaceHeldRef.current || panModeRef.current
        }
        // Touch. One finger is the tool's — drawing a line, dragging a station, sweeping a
        // marquee — and letting d3 have it too meant every one of those gestures panned the
        // canvas underneath itself at the same time. Two fingers are unambiguous: nothing
        // else in the app wants them, so they pan and pinch-zoom. The hand tool still claims
        // a single finger, which is the whole reason it exists on a tablet.
        if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
          return panModeRef.current || event.touches.length >= 2
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

    // Two-finger trackpad scroll (a plain wheel) pans the canvas, matching how design
    // tools behave. A pinch arrives as ctrl+wheel and is left to d3 to zoom (above).
    // translateBy moves in the pre-scale coordinate space, so divide screen delta by k;
    // line/page delta modes are normalised to pixels first.
    const panOnWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return
      e.preventDefault()
      const k = zoomTransform(svg).k || 1
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? svg.clientHeight : 1
      zoomBehavior.translateBy(selection, (-e.deltaX * unit) / k, (-e.deltaY * unit) / k)
    }
    svg.addEventListener('wheel', panOnWheel, { passive: false })

    return () => {
      selection.on('.zoom', null)
      svg.removeEventListener('wheel', blockPageZoom)
      svg.removeEventListener('wheel', panOnWheel)
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
   * Used to fly to a line when it's picked from the list, so navigation feels deliberate.
   * Fits and centres within the *uncovered* part of the svg, so nothing lands behind the
   * floating toolbar or panel. */
  const frameBounds = useCallback(
    (bounds: { x: number; y: number; width: number; height: number }, paddingPx = 90) => {
      const svg = svgRef.current
      const behavior = behaviorRef.current
      const selection = selectionRef.current
      if (!svg || !behavior || !selection || bounds.width <= 0 || bounds.height <= 0) return
      const rect = svg.getBoundingClientRect()
      const { left, right, top, bottom } = insetsRef.current
      // A narrow window can leave less room than the chrome takes up; keep the visible box
      // positive so the fit below can't come out negative and flip the map inside out.
      const visibleWidth = Math.max(1, rect.width - left - right)
      const visibleHeight = Math.max(1, rect.height - top - bottom)
      // Same guard for the padding: on a small visible box, shrink the breathing room
      // rather than let it eat the whole thing.
      const padding = Math.min(paddingPx, visibleWidth / 4, visibleHeight / 4)
      const fit = Math.min((visibleWidth - 2 * padding) / bounds.width, (visibleHeight - 2 * padding) / bounds.height)
      // Never zoom in past 2× on a short line (it'd fill the screen and lose context), and
      // stay within the behaviour's own scaleExtent so d3 doesn't clamp mid-transition.
      const scale = Math.max(0.25, Math.min(2, fit))
      const tx = left + visibleWidth / 2 - scale * (bounds.x + bounds.width / 2)
      const ty = top + visibleHeight / 2 - scale * (bounds.y + bounds.height / 2)
      behavior.transform(selection.transition().duration(480), zoomIdentity.translate(tx, ty).scale(scale))
    },
    [svgRef],
  )

  return { transform, zoomIn, zoomOut, spaceHeld, panning, frameBounds }
}
