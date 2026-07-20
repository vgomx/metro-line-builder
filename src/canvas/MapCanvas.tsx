import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { ZoomTransform } from 'd3-zoom'
import type { GeoFeature, Line, LineNode, Point, PointOfInterest, Station, Tool } from '../types'
import { useZoomPan } from './useZoomPan'
import { useReducedMotion } from '../useReducedMotion'
import type { ViewportInsets } from './useZoomPan'
import { StationNode } from './StationNode'
import { PoiNode } from './PoiNode'
import { WaypointNode } from './WaypointNode'
import { LinePath } from './LinePath'
import { GeoFeaturePath } from './GeoFeaturePath'
import { TrainMarker } from './TrainMarker'
import { SnapAnimation } from './SnapAnimation'
import { RefanAnimation } from './RefanAnimation'
import { routeOrthogonal } from './routing'
import { GRID_SIZE, snapToGrid, snapToPoiGrid } from '../grid'
import { minGeoPointsForTool } from '../geoDraft'
import {
  buildLineTrack,
  buildNetworkGeometry,
  distanceToPolyline,
  buildRefanFrames,
  closestSegmentIndex,
  resolveLineNodes,
  stationIdsOfLine,
} from './lineNodes'
import type { RefanLine } from './lineNodes'
import { computeLabelPlacements } from './labelPlacement'
import { openMojiUrl, POI_DRAG_MIME } from '../openmoji'
import { useAppearance } from './useAppearance'
import { useExit } from './useExit'
import { buildLinePath } from './lineNodes'

export interface MapCanvasHandle {
  zoomIn: () => void
  zoomOut: () => void
  /** Eases the viewport to frame a line — used when a line is picked from the list. */
  frameLine: (lineId: string) => void
  /** Eases the viewport to frame every line — used after generating a fresh map. */
  fitContent: () => void
  /** The grid point at the middle of what's on screen. The palette places there when a symbol
   * is chosen by keyboard, since there's no pointer to say where. */
  viewportCentre: () => Point
  /** The canvas element itself, for the image exporter to clone and resolve. */
  svgElement: () => SVGSVGElement | null
}

interface MapCanvasProps {
  tool: Tool
  stationList: Station[]
  lineList: Line[]
  geoFeatureList: GeoFeature[]
  poiList: PointOfInterest[]
  stations: Record<string, Station>
  selectedStationIds: string[]
  selectedLineIds: string[]
  selectedGeoFeatureIds: string[]
  selectedPoiIds: string[]
  selectedWaypoint: { lineId: string; index: number } | null
  draftLineNodes: LineNode[]
  draftGeoPoints: Point[]
  showGrid: boolean
  showTrains: boolean
  /** Edges covered by the floating toolbar and panel, so framing centres on what's visible. */
  viewportInsets: ViewportInsets
  onAddStation: (x: number, y: number) => void
  onMoveStations: (ids: string[], dx: number, dy: number) => void
  onMergeStations: (survivorId: string, mergedId: string) => void
  onAppendDraftLineNode: (node: LineNode) => void
  onInsertDraftLineStation: (x: number, y: number, index: number) => void
  onInsertLineStation: (lineId: string, x: number, y: number, index: number) => void
  onFinishDraftLine: () => void
  /** Take back the last point of whichever draft is in progress. */
  onPopDraftPoint: () => void
  onCancelDraftLine: () => void
  onAddGeoPoint: (x: number, y: number) => void
  /** A symbol has been dropped on the map — the icon comes from the drag itself. */
  onAddPoi: (x: number, y: number, icon: string) => void
  /** A palette symbol waiting to be put down by tapping the map, or null. Touch only: a
   * finger can't drag one in, so it picks first and places second. */
  armedPoiIcon: string | null
  /** A landmark has come to rest, whether newly dropped or moved. Fires once per landing. */
  onPoiLand?: () => void
  /** Put the drawing tool down and go back to select — a click on the canvas with the
   * point-of-interest palette up, or Escape with nothing drafted. */
  onReturnToSelect: () => void
  onMovePois: (ids: string[], dx: number, dy: number) => void
  onFinishGeoFeature: () => void
  onCancelGeoFeature: () => void
  onSetSelection: (stationIds: string[], lineIds: string[], geoFeatureIds: string[], poiIds?: string[]) => void
  onClearSelection: () => void
  onSelectWaypoint: (lineId: string, index: number) => void
  onDeleteWaypoint: (lineId: string, index: number) => void
  onDeleteSelected: () => void
  /** Something on the map was double-clicked — the caller selects it and opens its name for
   * editing. One prop for all three kinds, since the response is identical for each. */
  onRenameRequest: (kind: 'station' | 'poi' | 'geo', id: string) => void
  onCheckpoint: () => void
  /** A station has been picked up — fires on every grab, before anything moves. */
  onStationGrab?: () => void
  /** A drag has pulled a line into a new shape. Fires once per drag, the first time the
   * route actually gives, not per frame. */
  onLineReroute?: () => void
  /** A dropped line is springing into its new shape — fires as the elastic snap begins. */
  onLineSnap?: () => void
  onUndo: () => void
  onRedo: () => void
  onTransformChange?: (transform: ZoomTransform) => void
}

function safeSetPointerCapture(target: Element, pointerId: number) {
  try {
    target.setPointerCapture(pointerId)
  } catch {
    // Capture is a robustness nicety (keeps drags alive if the pointer leaves the
    // element); the onPointerMove handler on the svg root still tracks the drag
    // without it, so a failure here shouldn't block selection/drag state.
  }
}

type DragState =
  | { kind: 'none' }
  | { kind: 'marquee'; startX: number; startY: number; x: number; y: number; union: boolean }
  | {
      kind: 'stations'
      ids: string[]
      anchorId: string
      startAnchorX: number
      startAnchorY: number
      startPointerX: number
      startPointerY: number
      moved: boolean
      originalPositions: Record<string, Point>
    }
  | {
      kind: 'pois'
      ids: string[]
      anchorId: string
      startAnchorX: number
      startAnchorY: number
      startPointerX: number
      startPointerY: number
      moved: boolean
    }

const GRID_EXTENT = 4000
const DRAW_TOOLS: Tool[] = ['add-station', 'draw-line', 'draw-river', 'draw-park']
/** How long a deleted line spends coming apart, and how long its ghost is held for. The
 * hold outlasts the animation so the final frame isn't clipped. A line that's merely been
 * switched off keeps the old quick fade — see the ghost renderer. */
/** How long the ground ripple under a dropped landmark lasts, and how long the marker takes
 * to settle into it. */
const IMPACT_MS = 520
const SETTLE_MS = 340
/** A station's ripple: shorter than a landmark's, because it's a nudge rather than an event. */
const STATION_RIPPLE_MS = 380
/** How long a deleted landmark takes to come apart, and how long its ghost is held. */
const CRUMBLE_MS = 380
const POI_EXIT_HOLD_MS = 440
const LINE_SHATTER_MS = 620
const LINE_EXIT_HOLD_MS = 700
/** Softer than the 10 a committed route gets. A draft is a sketch — the hard elbow reads as a
 * decision already made, and rounding it says the shape is still being felt out. It's also
 * clamped to half the shorter neighbouring segment, so on tight zig-zags it quietly gives way
 * rather than distorting the route. */
/** How near the snapped point has to be to a route before the station tool offers to join it.
 * Under half a cell: any further and the station would be created beside the line rather than
 * on it, and promising a junction there would be a lie. */
const STATION_JOIN_REACH = 14
/** Softer than a committed route's 10, but not by as much as it was: at 18 the line visibly
 * firmed up the moment it stopped being a draft, which read as a glitch rather than as a
 * decision settling. */
const DRAFT_CORNER_RADIUS = 12
const RIVER_DRAFT_STROKE = '#60A5FA'
const PARK_DRAFT_STROKE = '#4ADE80'

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  {
    tool,
    stationList,
    lineList,
    geoFeatureList,
    poiList,
    stations,
    selectedStationIds,
    selectedLineIds,
    selectedGeoFeatureIds,
    selectedPoiIds,
    selectedWaypoint,
    draftLineNodes,
    draftGeoPoints,
    showGrid,
    showTrains,
    viewportInsets,
    onAddStation,
    onMoveStations,
    onMergeStations,
    onAppendDraftLineNode,
    onInsertDraftLineStation,
    onInsertLineStation,
    onFinishDraftLine,
    onPopDraftPoint,
    onCancelDraftLine,
    onAddGeoPoint,
    onAddPoi,
    armedPoiIcon,
    onMovePois,
    onReturnToSelect,
    onPoiLand,
    onFinishGeoFeature,
    onCancelGeoFeature,
    onSetSelection,
    onClearSelection,
    onSelectWaypoint,
    onDeleteWaypoint,
    onDeleteSelected,
    onRenameRequest,
    onCheckpoint,
    onStationGrab,
    onLineReroute,
    onLineSnap,
    onUndo,
    onRedo,
    onTransformChange,
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { transform, zoomIn, zoomOut, spaceHeld, panning, frameBounds } = useZoomPan(
    svgRef,
    tool === 'pan',
    viewportInsets,
  )
  const [drag, setDrag] = useState<DragState>({ kind: 'none' })
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null)
  /** The last landing, kept only long enough for the ripple to play out. Keyed so two drops in
   * quick succession restart the animation rather than sharing one that's already running. */
  const [impact, setImpact] = useState<{ key: number; points: Point[]; soft: boolean } | null>(null)
  const impactSeq = useRef(0)
  /** Landmarks that have just been put down after a move, so their marker settles the way a
   * freshly dropped one does. New arrivals come from useAppearance instead — they have no
   * previous position to have been moved from. */
  const [settlingPoiIds, setSettlingPoiIds] = useState<Set<string>>(() => new Set())
  /** Stations that have just been put down after a drag, so the marker settles the way a
   * landmark does. Added stations come from useAppearance instead — they have no previous
   * position to have been moved from. */
  const [settlingStationIds, setSettlingStationIds] = useState<Set<string>>(() => new Set())

  /**
   * Ring out from every point something landed on, and say so once. Shared by the two ways a
   * landmark arrives — dragged in from the palette, or picked up and put down again — because
   * they're the same gesture as far as the map is concerned, and only the sound and the
   * marker's own animation differ between them.
   */
  const showImpact = (points: Point[], soft: boolean) => {
    if (points.length === 0) return
    impactSeq.current += 1
    const key = impactSeq.current
    setImpact({ key, points, soft })
    window.setTimeout(() => setImpact(prev => (prev?.key === key ? null : prev)), soft ? STATION_RIPPLE_MS : IMPACT_MS)
  }

  const announceLanding = (points: Point[], settled: string[] = []) => {
    if (points.length === 0) return
    showImpact(points, false)
    if (settled.length > 0) {
      setSettlingPoiIds(new Set(settled))
      window.setTimeout(() => setSettlingPoiIds(new Set()), SETTLE_MS)
    }
    onPoiLand?.()
  }
  // One session per completed drag; the ghost re-derives each affected line's shape
  // per frame from the interpolated station positions, so it needs only the origins.
  const reducedMotion = useReducedMotion()
  const [snapSession, setSnapSession] = useState<{ key: string; originalPositions: Record<string, Point> } | null>(null)
  const snapSessionRef = useRef(0)

  // When the shared-corridor layout changes (a line added, removed, hidden, or rerouted),
  // the other lines slide into their new lanes instead of teleporting. Detected by diffing
  // the previous line list against the current one while stations sit still.
  const [refanSession, setRefanSession] = useState<{ key: number; lines: RefanLine[] } | null>(null)
  const refanSessionRef = useRef(0)
  const prevLineListRef = useRef<Line[] | null>(null)

  useEffect(() => {
    const prevLines = prevLineListRef.current
    prevLineListRef.current = lineList
    // First render, or an unrelated re-render that didn't touch the line list — a station
    // drag keeps lineList's identity, so those fall through to the snap animation instead.
    if (!prevLines || prevLines === lineList) return
    // Both of these tween geometry frame by frame in JavaScript, so the stylesheet's
    // reduced-motion rule can't touch them. Skipping the session lands the new arrangement
    // immediately, which is where the tween was going anyway.
    if (reducedMotion) return
    const frames = buildRefanFrames(prevLines, lineList, stations)
    if (frames.length === 0) return
    refanSessionRef.current += 1
    setRefanSession({ key: refanSessionRef.current, lines: frames })
  }, [lineList, stations, reducedMotion])

  useImperativeHandle(
    ref,
    () => ({
      zoomIn,
      zoomOut,
      svgElement: () => svgRef.current,
      frameLine: (lineId: string) => {
        // The line's rendered stroke already lives in world space (the pan/zoom transform
        // is on an ancestor group), so its own bbox is the world box to frame.
        const el = document.getElementById(lineId) as unknown as SVGGraphicsElement | null
        if (!el || typeof el.getBBox !== 'function') return
        let box: DOMRect
        try {
          box = el.getBBox()
        } catch {
          return
        }
        if (box.width === 0 && box.height === 0) return
        frameBounds({ x: box.x, y: box.y, width: box.width, height: box.height })
      },
      viewportCentre: () => {
        const rect = svgRef.current?.getBoundingClientRect()
        if (!rect) return { x: 0, y: 0 }
        // The middle of the *visible* map, not of the svg: the toolbar and panel cover a good
        // slice of it, and dropping a landmark under the panel would be dropping it out of
        // sight.
        const screenX = viewportInsets.left + (rect.width - viewportInsets.left - viewportInsets.right) / 2
        const screenY = viewportInsets.top + (rect.height - viewportInsets.top - viewportInsets.bottom) / 2
        return {
          x: snapToPoiGrid((screenX - transform.x) / transform.k),
          y: snapToPoiGrid((screenY - transform.y) / transform.k),
        }
      },
      fitContent: () => {
        // Measured from the data rather than from the rendered paths. The paths are only the
        // routes: they know nothing of the station names hanging off them, the river running
        // past, the parks, or the landmarks — so framing on them alone left a generated map's
        // scenery outside the view. Reading the map itself also takes the DOM's timing out of
        // it, which is the other thing that made this occasionally frame the wrong rectangle.
        const xs: number[] = []
        const ys: number[] = []
        const note = (p: Point) => {
          xs.push(p.x)
          ys.push(p.y)
        }
        stationList.forEach(note)
        poiList.forEach(note)
        // Parks count; rivers don't. A river is drawn to run off the edge of the map the way
        // geography does, so framing it whole pushes the network small into the middle of a
        // lot of water. Letting it bleed is what it's for.
        for (const feature of geoFeatureList) if (feature.type !== 'river') feature.points.forEach(note)
        for (const line of lineList) resolveLineNodes(line.nodes, stations).forEach(note)
        if (xs.length === 0) return
        // Room for what hangs off a point: a station's name card, a landmark's label.
        const margin = 52
        const minX = Math.min(...xs) - margin
        const minY = Math.min(...ys) - margin
        frameBounds({ x: minX, y: minY, width: Math.max(...xs) + margin - minX, height: Math.max(...ys) + margin - minY })
      },
    }),
    [zoomIn, zoomOut, frameBounds, stationList, poiList, geoFeatureList, lineList, stations, transform, viewportInsets],
  )

  useEffect(() => {
    onTransformChange?.(transform)
  }, [transform, onTransformChange])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.key === 'Escape') {
        if (draftLineNodes.length > 0) onCancelDraftLine()
        else if (draftGeoPoints.length > 0) onCancelGeoFeature()
        // Nothing drafted, so Escape backs out of the tool itself rather than doing nothing
        // visible. A drawing tool you can't put down with the key that means "stop" is the
        // same trap as a draft you can't finish.
        else if (DRAW_TOOLS.includes(tool) || tool === 'add-poi') onReturnToSelect()
        else onClearSelection()
      } else if (e.key === 'Backspace' && (draftLineNodes.length > 0 || draftGeoPoints.length > 0)) {
        // While something is being drawn, Backspace walks it back a point at a time. It's the
        // pen-tool gesture from every drawing app, and until now the only way out of a
        // misplaced point was Escape and starting the whole route again.
        e.preventDefault()
        onPopDraftPoint()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWaypoint) {
          e.preventDefault()
          onDeleteWaypoint(selectedWaypoint.lineId, selectedWaypoint.index)
        } else if (
          selectedStationIds.length > 0 ||
          selectedLineIds.length > 0 ||
          selectedGeoFeatureIds.length > 0 ||
          selectedPoiIds.length > 0
        ) {
          e.preventDefault()
          onDeleteSelected()
        }
      } else if (e.key === 'Enter') {
        // Against the tool's own minimum, not a flat two. A park needs three points, and
        // finishing one on two reached a reducer that silently threw the draft away.
        const geoMinimum = minGeoPointsForTool(tool)
        if (draftLineNodes.length >= 2) onFinishDraftLine()
        else if (geoMinimum !== null && draftGeoPoints.length >= geoMinimum) onFinishGeoFeature()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) onRedo()
        else onUndo()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        onRedo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    draftLineNodes,
    draftGeoPoints,
    selectedStationIds,
    selectedLineIds,
    selectedGeoFeatureIds,
    selectedPoiIds,
    selectedWaypoint,
    tool,
    onCancelDraftLine,
    onCancelGeoFeature,
    onClearSelection,
    onReturnToSelect,
    onDeleteWaypoint,
    onDeleteSelected,
    onFinishDraftLine,
    onPopDraftPoint,
    onFinishGeoFeature,
    onUndo,
    onRedo,
  ])

  const toWorld = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const screenX = clientX - rect.left
    const screenY = clientY - rect.top
    return {
      x: (screenX - transform.x) / transform.k,
      y: (screenY - transform.y) / transform.k,
    }
  }

  const handleBackgroundPointerDown = (e: ReactPointerEvent<SVGRectElement>) => {
    if (e.button !== 0) return
    if (spaceHeld) return // space-held drag is pan-only; let useZoomPan's own drag handle it
    if (tool === 'add-station') {
      const { x, y } = toWorld(e.clientX, e.clientY)
      onAddStation(snapToGrid(x), snapToGrid(y))
      return
    }
    if (tool === 'draw-line') {
      const { x, y } = toWorld(e.clientX, e.clientY)
      // A real, draggable station rather than a bare waypoint — otherwise there'd be
      // nothing to grab if the user tries to reposition this new end/start later.
      onInsertDraftLineStation(snapToGrid(x), snapToGrid(y), draftLineNodes.length)
      return
    }
    if (tool === 'draw-river' || tool === 'draw-park') {
      const { x, y } = toWorld(e.clientX, e.clientY)
      onAddGeoPoint(snapToGrid(x), snapToGrid(y))
      return
    }
    if (tool === 'select') {
      const { x, y } = toWorld(e.clientX, e.clientY)
      safeSetPointerCapture(e.target as Element, e.pointerId)
      setDrag({ kind: 'marquee', startX: x, startY: y, x, y, union: e.shiftKey })
    }
  }

  const handleStationPointerDown = (e: ReactPointerEvent<SVGGElement>, station: Station) => {
    if (e.button !== 0) return
    if (spaceHeld) return // space-held drag is pan-only, even when starting on a station
    if (tool !== 'select') return
    e.stopPropagation()

    if (e.shiftKey) {
      const isSelected = selectedStationIds.includes(station.id)
      const nextIds = isSelected
        ? selectedStationIds.filter(id => id !== station.id)
        : [...selectedStationIds, station.id]
      onSetSelection(nextIds, [], [])
      return
    }

    // Past the shift-click branch above, so this is a real pick-up rather than a
    // selection toggle.
    onStationGrab?.()
    safeSetPointerCapture(e.target as Element, e.pointerId)
    const ids = selectedStationIds.includes(station.id) ? selectedStationIds : [station.id]
    if (!selectedStationIds.includes(station.id)) {
      onSetSelection([station.id], [], [])
    }
    const pointerWorld = toWorld(e.clientX, e.clientY)
    const originalPositions: Record<string, Point> = {}
    for (const id of ids) {
      const s = stations[id]
      if (s) originalPositions[id] = { x: s.x, y: s.y }
    }
    setDrag({
      kind: 'stations',
      ids,
      anchorId: station.id,
      startAnchorX: station.x,
      startAnchorY: station.y,
      startPointerX: pointerWorld.x,
      startPointerY: pointerWorld.y,
      moved: false,
      originalPositions,
    })
  }

  const handlePoiPointerDown = (e: ReactPointerEvent<SVGGElement>, poi: PointOfInterest) => {
    if (e.button !== 0) return
    if (spaceHeld) return
    if (tool !== 'select') return
    e.stopPropagation()

    if (e.shiftKey) {
      const nextIds = selectedPoiIds.includes(poi.id)
        ? selectedPoiIds.filter(id => id !== poi.id)
        : [...selectedPoiIds, poi.id]
      onSetSelection([], [], [], nextIds)
      return
    }

    onStationGrab?.()
    safeSetPointerCapture(e.target as Element, e.pointerId)
    const ids = selectedPoiIds.includes(poi.id) ? selectedPoiIds : [poi.id]
    if (!selectedPoiIds.includes(poi.id)) onSetSelection([], [], [], [poi.id])
    const pointerWorld = toWorld(e.clientX, e.clientY)
    setDrag({
      kind: 'pois',
      ids,
      anchorId: poi.id,
      startAnchorX: poi.x,
      startAnchorY: poi.y,
      startPointerX: pointerWorld.x,
      startPointerY: pointerWorld.y,
      moved: false,
    })
  }

  const handleStationClick = (station: Station) => {
    if (spaceHeld) return
    if (tool === 'draw-line') {
      onAppendDraftLineNode({ kind: 'station', stationId: station.id })
    }
  }

  const handleLineClick = (line: Line, e: ReactMouseEvent<SVGPathElement>) => {
    if (spaceHeld) return
    if (tool === 'select') {
      onSetSelection([], [line.id], [])
      return
    }
    if (tool === 'add-station') {
      const { x, y } = toWorld(e.clientX, e.clientY)
      const snapped = { x: snapToGrid(x), y: snapToGrid(y) }
      const points = resolveLineNodes(line.nodes, stations)
      const index = closestSegmentIndex(points, snapped)
      onInsertLineStation(line.id, snapped.x, snapped.y, index + 1)
    }
  }

  const handleGeoFeatureClick = (feature: GeoFeature) => {
    if (spaceHeld) return
    if (tool !== 'select') return
    onSetSelection([], [], [feature.id])
  }

  const handleWaypointClick = (e: ReactMouseEvent<SVGRectElement>, lineId: string, index: number) => {
    if (spaceHeld) return
    if (tool !== 'select') return
    e.stopPropagation()
    onSelectWaypoint(lineId, index)
  }

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (DRAW_TOOLS.includes(tool)) {
      const w = toWorld(e.clientX, e.clientY)
      const snapped = { x: snapToGrid(w.x), y: snapToGrid(w.y) }
      // Only when the grid point itself changes. A fresh object every pointermove would
      // re-render the canvas on every pixel of travel, and — now that the marker is keyed by
      // its position — could restart the settle animation while standing still.
      setCursorWorld(prev => (prev && prev.x === snapped.x && prev.y === snapped.y ? prev : snapped))
    }

    if (drag.kind === 'marquee') {
      const { x, y } = toWorld(e.clientX, e.clientY)
      setDrag({ ...drag, x, y })
    } else if (drag.kind === 'pois') {
      const pointerWorld = toWorld(e.clientX, e.clientY)
      const targetX = snapToPoiGrid(drag.startAnchorX + (pointerWorld.x - drag.startPointerX))
      const targetY = snapToPoiGrid(drag.startAnchorY + (pointerWorld.y - drag.startPointerY))
      const anchor = poiList.find(p => p.id === drag.anchorId)
      if (anchor) {
        const dx = targetX - anchor.x
        const dy = targetY - anchor.y
        if (dx !== 0 || dy !== 0) {
          // A landmark shapes no route, so there's nothing to reroute or spring — but the
          // move still has to be one undo, hence the checkpoint at the first budge.
          if (!drag.moved) onCheckpoint()
          onMovePois(drag.ids, dx, dy)
          setDrag({ ...drag, moved: true })
        }
      }
    } else if (drag.kind === 'stations') {
      const pointerWorld = toWorld(e.clientX, e.clientY)
      const rawX = drag.startAnchorX + (pointerWorld.x - drag.startPointerX)
      const rawY = drag.startAnchorY + (pointerWorld.y - drag.startPointerY)
      const targetX = snapToGrid(rawX)
      const targetY = snapToGrid(rawY)
      const anchor = stations[drag.anchorId]
      if (anchor) {
        const dx = targetX - anchor.x
        const dy = targetY - anchor.y
        if (dx !== 0 || dy !== 0) {
          if (!drag.moved) {
            onCheckpoint()
            // Only a station some line runs through can reshape a route; dragging a station
            // that sits on no line moves a marker and nothing else.
            const reshapesALine = lineList.some(line =>
              line.nodes.some(n => n.kind === 'station' && drag.ids.includes(n.stationId)),
            )
            if (reshapesALine) onLineReroute?.()
          }
          onMoveStations(drag.ids, dx, dy)
          setDrag({ ...drag, moved: true })
        }
      }
    }
  }

  const handlePointerUp = (e?: ReactPointerEvent<SVGSVGElement>) => {
    // A finger has no hover, so pointerleave never comes and the placement marker stayed
    // parked wherever it was last tapped — a marker sitting on the map with nothing under it.
    if (e?.pointerType === 'touch') setCursorWorld(null)

    if (drag.kind === 'marquee') {
      const minX = Math.min(drag.startX, drag.x)
      const maxX = Math.max(drag.startX, drag.x)
      const minY = Math.min(drag.startY, drag.y)
      const maxY = Math.max(drag.startY, drag.y)
      const movedEnough = maxX - minX > 3 || maxY - minY > 3

      if (movedEnough) {
        const hitIds = stationList
          .filter(s => s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY)
          .map(s => s.id)
        const ids = drag.union ? Array.from(new Set([...selectedStationIds, ...hitIds])) : hitIds
        onSetSelection(ids, [], [])
      } else if (!drag.union) {
        onClearSelection()
      }
    } else if (drag.kind === 'pois') {
      // Only a landmark that actually shifted has landed anywhere. A pick-up that put it back
      // where it started is a selection, and ringing the ground for it would be a lie.
      if (drag.moved) {
        const moved = drag.ids.map(id => poiList.find(poi => poi.id === id)).filter((p): p is PointOfInterest => Boolean(p))
        announceLanding(moved.map(poi => ({ x: poi.x, y: poi.y })), moved.map(poi => poi.id))
      }
    } else if (drag.kind === 'stations' && !drag.moved) {
      // plain click on an already-selected station: keep single selection
    } else if (drag.kind === 'stations' && drag.moved) {
      // Dropping a station exactly onto another (stationary) one merges them into a
      // single shared station instead of leaving two markers silently stacked.
      for (const draggedId of drag.ids) {
        const draggedStation = stations[draggedId]
        if (!draggedStation) continue
        const target = stationList.find(
          s => !drag.ids.includes(s.id) && s.x === draggedStation.x && s.y === draggedStation.y,
        )
        if (target) onMergeStations(target.id, draggedId)
      }

      // Where each dragged station came to rest. The landmark's ripple, dialled down: a
      // station moves constantly while a map is being drawn, so it gets a nudge rather than
      // the ceremony a landmark gets.
      showImpact(
        drag.ids.map(id => stations[id]).filter((s): s is Station => Boolean(s)).map(s => ({ x: s.x, y: s.y })),
        true,
      )
      setSettlingStationIds(new Set(drag.ids))
      window.setTimeout(() => setSettlingStationIds(new Set()), SETTLE_MS)

      snapSessionRef.current += 1
      if (!reducedMotion) setSnapSession({ key: String(snapSessionRef.current), originalPositions: drag.originalPositions })
      // Same gate as the reroute: only a line the drag actually reshaped has a spring to
      // play, so a lone station settling back makes no sound.
      if (lineList.some(line => line.nodes.some(n => n.kind === 'station' && drag.ids.includes(n.stationId)))) {
        onLineSnap?.()
      }
    }
    setDrag({ kind: 'none' })
  }

  // The point-of-interest palette covers a good slice of the map, and once the landmarks are
  // down there's nothing left to pick from it. A click on the canvas is the natural way to say
  // so: the tool goes back to select and the panel leaves with it. On the root rather than the
  // background rect so a click that lands on a station or a line dismisses it too — with the
  // tool up, neither of those does anything else. Space-held panning is exempt: that's
  // navigation, and it would be a poor reward for looking around.
  const handleRootPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || spaceHeld) return
    if (tool !== 'add-poi') return

    // A symbol picked out of the palette is waiting for somewhere to go, so the tap is that
    // answer rather than a dismissal. The symbol stays armed afterwards: landmarks arrive in
    // groups, and re-picking the same one from a scrolled palette between every placement
    // would be the slowest part of the tool.
    if (armedPoiIcon) {
      const { x, y } = toWorld(e.clientX, e.clientY)
      const landed = { x: snapToPoiGrid(x), y: snapToPoiGrid(y) }
      onAddPoi(landed.x, landed.y, armedPoiIcon)
      announceLanding([landed])
      return
    }
    onReturnToSelect()
  }

  // Dragging a symbol in from the palette. dragover has to preventDefault on every event or
  // the browser refuses the drop, and the payload itself is unreadable until drop — only the
  // *types* are exposed mid-drag, which is exactly enough to tell our symbols from anything
  // else the user might be dragging across the window.
  const handleDragOver = (e: ReactDragEvent<SVGSVGElement>) => {
    if (!e.dataTransfer.types.includes(POI_DRAG_MIME)) return
    // Only to accept the drop: without preventDefault on every dragover the browser refuses it.
    // Nothing is drawn under the pointer while a symbol is in flight — the tile the drag
    // carries is already the landmark at its real size, and a marker behind it was a second
    // opinion about a position the tile was giving anyway.
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: ReactDragEvent<SVGSVGElement>) => {
    const icon = e.dataTransfer.getData(POI_DRAG_MIME)
    if (!icon) return
    e.preventDefault()
    const { x, y } = toWorld(e.clientX, e.clientY)
    const landed = { x: snapToPoiGrid(x), y: snapToPoiGrid(y) }
    onAddPoi(landed.x, landed.y, icon)
    announceLanding([landed])
  }

  const handleDoubleClick = () => {
    if (spaceHeld) return
    if (tool === 'draw-line' && draftLineNodes.length >= 2) {
      onFinishDraftLine()
    } else {
      const geoMinimum = minGeoPointsForTool(tool)
      if (geoMinimum !== null && draftGeoPoints.length >= geoMinimum) onFinishGeoFeature()
    }
  }

  const handleDraftPathClick = (e: ReactMouseEvent<SVGPathElement>) => {
    if (spaceHeld) return
    if (tool !== 'draw-line') return
    e.stopPropagation()
    const { x, y } = toWorld(e.clientX, e.clientY)
    const snapped = { x: snapToGrid(x), y: snapToGrid(y) }
    const index = closestSegmentIndex(draftPoints, snapped)
    onInsertDraftLineStation(snapped.x, snapped.y, index + 1)
  }

  // Split into the already-committed portion (clickable to insert a station mid-route)
  // and a separate rubber-band segment to the live cursor (preview only, not clickable).
  const draftPoints = resolveLineNodes(draftLineNodes, stations)
  const draftCommittedPath = draftPoints.length >= 2 ? routeOrthogonal(draftPoints, false, DRAFT_CORNER_RADIUS) : ''
  const draftCursorPath =
    cursorWorld && draftPoints.length >= 1
      ? routeOrthogonal([draftPoints[draftPoints.length - 1], cursorWorld], false, DRAFT_CORNER_RADIUS)
      : ''

  const draftGeoPreviewPoints = cursorWorld ? [...draftGeoPoints, cursorWorld] : draftGeoPoints
  const draftGeoPath =
    draftGeoPreviewPoints.length > 1 ? routeOrthogonal(draftGeoPreviewPoints, false, DRAFT_CORNER_RADIUS) : ''

  const snapLines = snapSession
    ? lineList.filter(
        line => line.visible && stationIdsOfLine(line).some(id => id in snapSession.originalPositions),
      )
    : []

  // Lines currently sliding to new lanes are drawn by the re-fan overlay instead of their
  // own static path, so the two don't both paint a few pixels apart during the transition.
  const refanningIds = refanSession ? new Set(refanSession.lines.map(l => l.lineId)) : null

  const ghostLines =
    drag.kind === 'stations' && drag.moved
      ? lineList
          .filter(line => line.visible && stationIdsOfLine(line).some(id => id in drag.originalPositions))
          .map(line => {
            const points = line.nodes
              .map(n => (n.kind === 'station' ? (drag.originalPositions[n.stationId] ?? stations[n.stationId]) : n))
              .filter((p): p is Point => Boolean(p))
            return { id: line.id, color: line.color, d: points.length >= 2 ? routeOrthogonal(points) : '' }
          })
          .filter(g => g.d)
      : []

  const lineCountByStation: Record<string, number> = {}
  // The colour of the last line seen at each station. Only read where the count is 1, so
  // "last" is also "only" — an interchange keeps black, which is what makes black mean
  // interchange rather than merely meaning station.
  const lineColorByStation: Record<string, string> = {}
  for (const line of lineList) {
    for (const id of new Set(stationIdsOfLine(line))) {
      lineCountByStation[id] = (lineCountByStation[id] ?? 0) + 1
      if (line.visible) lineColorByStation[id] = line.color
    }
  }

  // One pass for the whole map rather than a decision per station: a label has to know where
  // its neighbours landed to keep off them.
  const labelPlacementByStation = computeLabelPlacements(
    stationList,
    lineList,
    stations,
    new Set(stationList.filter(s => (lineCountByStation[s.id] ?? 0) >= 2).map(s => s.id)),
  )

  // One routing pass for the whole network: it subdivides every line's segments against
  // the others so shared corridors fan out, and both the line renderer and the train
  // layer read their lane geometry from it rather than each deriving their own.
  const network = buildNetworkGeometry(lineList, stations)

  // Enter animations: a line sketches itself on when it first appears (drawn, or every
  // line on load); a station pops in when added (but not the ones already there on load).
  const revealingLineIds = useAppearance(
    lineList.filter(line => line.visible).map(line => line.id),
    640,
    true,
  )
  const poppingStationIds = useAppearance(
    stationList.map(station => station.id),
    340,
    false,
  )
  const landingPoiIds = useAppearance(
    poiList.map(poi => poi.id),
    340,
    false,
  )

  // Exit animations: a removed station shrinks and fades from its last position; a removed
  // (or hidden) line fades from its last shape. Ghosts carry that final geometry so the
  // deletion animates instead of blinking out.
  const exitingStations = useExit(
    new Map(
      stationList.map(station => [
        station.id,
        { x: station.x, y: station.y, interchange: (lineCountByStation[station.id] ?? 0) >= 2 || station.transfer },
      ]),
    ),
    260,
  )
  const exitingLines = useExit(
    new Map(
      lineList
        .filter(line => line.visible)
        .map(line => {
          const geometry = network.byLine.get(line.id)
          return [line.id, { color: line.color, d: geometry ? buildLinePath(geometry, line.id, network.segmentLineMap) : '' }]
        }),
    ),
    LINE_EXIT_HOLD_MS,
  )

  const exitingPois = useExit(
    new Map(poiList.map(poi => [poi.id, { x: poi.x, y: poi.y, icon: poi.icon }])),
    POI_EXIT_HOLD_MS,
  )

  const draftLineStationIdSet = new Set(
    draftLineNodes.filter((n): n is Extract<LineNode, { kind: 'station' }> => n.kind === 'station').map(n => n.stationId),
  )

  const draggingStationIdSet = new Set(drag.kind === 'stations' ? drag.ids : [])

  // A station in hand comes first: it's the most specific thing in flight, and the closed
  // hand has to hold for the whole drag. Set on the svg as well as the marker because a
  // quick drag outruns its own station — the pointer ends up over bare canvas, and without
  // this the cursor would flick back to an arrow while the station is still being carried.
  /**
   * While a draw tool is up, the snap marker *is* the pointer.
   *
   * A crosshair promises precision the tool doesn't want: every click lands on the nearest
   * grid point whatever the pixel under the cursor, so showing both left the user lining up
   * two things when only one of them decided anything. Hiding the system cursor leaves the
   * marker alone on the grid point that will actually be used.
   *
   * Only once the marker exists, though — before the first pointermove there's nothing on the
   * canvas to aim with, and a pointer that is simply gone would be worse than a wrong one.
   */
  const drawingWithMarker = DRAW_TOOLS.includes(tool) && cursorWorld !== null && !spaceHeld
  const cursor =
    drag.kind === 'stations' || drag.kind === 'pois'
      ? 'grabbing'
      : spaceHeld || tool === 'pan'
        ? panning
          ? 'grabbing'
          : 'grab'
        : drawingWithMarker
          ? 'none'
          : DRAW_TOOLS.includes(tool)
            ? 'crosshair'
            : 'default'

  /**
   * The line the station tool would join, if the pointer is over one.
   *
   * Clicking a line with this tool inserts a stop into it rather than dropping a loose
   * station, and nothing said so — the marker looked identical over bare canvas and over a
   * route. Where it would join, the marker becomes a swell in the line's own colour: the shape
   * a station makes, in the colour of the line about to gain one.
   */
  /**
   * The station the pen would join, if the pointer is on one.
   *
   * Clicking an existing station while drawing runs the line through it rather than creating
   * another stop there — the same silent difference the station tool had, and the marker was
   * as mute about it. Over a station it becomes a ring around that station instead of a point
   * on the grid: the click won't make anything new, so the marker stops promising a new thing.
   */
  const connectTarget =
    tool === 'draw-line' && cursorWorld
      ? (stationList.find(station => station.x === cursorWorld.x && station.y === cursorWorld.y) ?? null)
      : null

  const joinTarget = (() => {
    if (tool !== 'add-station' || !cursorWorld) return null
    for (const line of lineList) {
      if (!line.visible) continue
      const geometry = network.byLine.get(line.id)
      if (!geometry) continue
      if (distanceToPolyline(geometry.vertices, cursorWorld) <= STATION_JOIN_REACH) return line
    }
    return null
  })()

  const gridLines = []
  if (showGrid) {
    for (let x = -GRID_EXTENT; x <= GRID_EXTENT; x += GRID_SIZE) {
      gridLines.push(<line key={`v${x}`} x1={x} y1={-GRID_EXTENT} x2={x} y2={GRID_EXTENT} />)
    }
    for (let y = -GRID_EXTENT; y <= GRID_EXTENT; y += GRID_SIZE) {
      gridLines.push(<line key={`h${y}`} x1={-GRID_EXTENT} y1={y} x2={GRID_EXTENT} y2={y} />)
    }
  }

  return (
    <svg
      ref={svgRef}
      // Marks this element as the map for the window-level gesture blocker in main.tsx,
      // which has to let Safari's pinch through here and nowhere else.
      data-map-canvas=""
      width="100%"
      height="100%"
      className={drawingWithMarker ? 'mlb-drawing' : undefined}
      style={{
        display: 'block',
        background: 'var(--bg-page)',
        cursor,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        // Without this the browser claims touch gestures for its own scroll and zoom before
        // d3 or the tool handlers see them, so on a tablet the canvas mostly moved the page.
        touchAction: 'none',
      }}
      onPointerDown={handleRootPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setCursorWorld(null)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDoubleClick={handleDoubleClick}
    >
      <defs>
        {/* Drag shadow for StationNode. A real SVG filter (not CSS drop-shadow())
            because Safari doesn't reliably render CSS filters on SVG content. The
            wide region keeps the blur from being clipped at the filter bounds. */}
        <filter id="station-drag-shadow" x="-100%" y="-100%" width="300%" height="300%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.35" />
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.25" />
        </filter>
      </defs>
      <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
        {/* The surface that catches a click on empty space. Marked as scaffolding for the
            image exporter, which would otherwise measure the map as 20000 units across. */}
        <rect
          data-export="exclude"
          x={-10000}
          y={-10000}
          width={20000}
          height={20000}
          fill="transparent"
          onPointerDown={handleBackgroundPointerDown}
        />

        {showGrid && (
          <g data-export="exclude" stroke="var(--border-default)" strokeWidth={1 / transform.k} opacity={0.4}>
            {gridLines}
          </g>
        )}

        {geoFeatureList.map(feature => (
          <GeoFeaturePath
            key={feature.id}
            feature={feature}
            selected={selectedGeoFeatureIds.includes(feature.id)}
            onClick={handleGeoFeatureClick}
            onDoubleClick={f => tool === 'select' && onRenameRequest('geo', f.id)}
          />
        ))}

        {ghostLines.map(g => (
          <path
            key={`ghost-${g.id}`}
            d={g.d}
            fill="none"
            stroke={g.color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2 12"
            opacity={0.25}
            style={{ pointerEvents: 'none' }}
          />
        ))}

        {snapSession && snapLines.length > 0 && (
          <SnapAnimation
            key={snapSession.key}
            affectedLines={snapLines}
            lineList={lineList}
            stations={stations}
            originalPositions={snapSession.originalPositions}
            onComplete={() => setSnapSession(prev => (prev?.key === snapSession.key ? null : prev))}
          />
        )}

        {lineList
          .filter(line => line.visible)
          .map(line => {
            const geometry = network.byLine.get(line.id)
            if (!geometry) return null
            if (refanningIds?.has(line.id)) return null // drawn by the re-fan overlay meanwhile
            return (
              <LinePath
                key={line.id}
                line={line}
                geometry={geometry}
                selected={selectedLineIds.includes(line.id)}
                revealing={revealingLineIds.has(line.id)}
                segmentLineMap={network.segmentLineMap}
                onClick={handleLineClick}
              />
            )
          })}

        {refanSession && (
          <RefanAnimation
            key={refanSession.key}
            lines={refanSession.lines}
            onComplete={() => setRefanSession(prev => (prev?.key === refanSession.key ? null : prev))}
          />
        )}

        {/* A line leaves the map for one of two reasons, and they shouldn't look alike: a
            deleted line comes apart, while one that's merely been switched off fades, because
            it's still there to be switched back on. The ghost carries its id, so which of the
            two happened is just "does this line still exist". */}
        {exitingLines.map(ghost => {
          if (!ghost.data.d) return null
          const switchedOff = lineList.some(line => line.id === ghost.id)
          return (
            <path
              key={ghost.key}
              d={ghost.data.d}
              // Normalised length, so the fragments the stroke breaks into are the same
              // fraction of the route whatever its length — a short branch and a cross-city
              // line come apart into the same number of pieces rather than one shattering
              // into dust while the other snaps in half.
              pathLength={1}
              fill="none"
              stroke={ghost.data.color}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
              style={{
                pointerEvents: 'none',
                animation: switchedOff
                  ? 'mlb-line-exit 240ms ease forwards'
                  : `mlb-line-shatter ${LINE_SHATTER_MS}ms cubic-bezier(0.3, 0.5, 0.5, 1) forwards`,
              }}
            />
          )
        })}

        {/* Bare waypoints on a selected line get a small marker so a stray or
            unwanted route-shaping point can be selected and deleted — stations
            already support this, waypoints otherwise have nothing to click. */}
        {tool === 'select' &&
          lineList
            .filter(line => line.visible && selectedLineIds.includes(line.id))
            .map(line => (
              <g key={`waypoints-${line.id}`}>
                {line.nodes.map((node, index) =>
                  node.kind === 'point' ? (
                    <WaypointNode
                      key={index}
                      x={node.x}
                      y={node.y}
                      color={line.color}
                      selected={selectedWaypoint?.lineId === line.id && selectedWaypoint?.index === index}
                      onClick={e => handleWaypointClick(e, line.id, index)}
                    />
                  ) : null,
                )}
              </g>
            ))}

        {draftCommittedPath && (
          <>
            {/* Wider transparent hit target makes it easy to click the thin dashed line to insert a station mid-route. */}
            <path
              d={draftCommittedPath}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              onClick={handleDraftPathClick}
              style={{ cursor: 'copy' }}
            />
            <path
              d={draftCommittedPath}
              fill="none"
              stroke="var(--brand-400)"
              strokeWidth={3}
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pointerEvents: 'none', animation: 'mlb-draft-flow 600ms linear infinite' }}
            />
          </>
        )}

        {draftCursorPath && (
          <path
            d={draftCursorPath}
            fill="none"
            stroke="var(--brand-400)"
            strokeWidth={3}
            strokeDasharray="2 5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.55}
            style={{ pointerEvents: 'none', animation: 'mlb-draft-tip-flow 420ms linear infinite' }}
          />
        )}

        {draftGeoPath && (
          <path
            d={draftGeoPath}
            fill="none"
            stroke={tool === 'draw-park' ? PARK_DRAFT_STROKE : RIVER_DRAFT_STROKE}
            strokeWidth={4}
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        )}

        {/* Trains are a property of the live map rather than of the map — a still image of one
            frozen between stops reads as a mistake. */}
        {showTrains &&
          lineList
            .filter(line => line.visible && stationIdsOfLine(line).length >= 2)
            .map(line => {
              // Same lane geometry LinePath draws, so the train rides its own rails.
              const geometry = network.byLine.get(line.id)
              const track = geometry ? buildLineTrack(geometry, line.id, network.segmentLineMap) : null
              if (!track) return null
              // Two services per line, half a cycle apart: one running each way, meeting and
              // passing in the middle.
              return [0, 0.5].map(phase => (
                <TrainMarker
                  key={`${line.id}-${phase}`}
                  lineId={line.id}
                  color={line.color}
                  stopPoints={track.stopPoints}
                  stopFlags={track.stopFlags}
                  segmentPaths={track.segmentPaths}
                  phase={phase}
                />
              ))
            })}

        {stationList.map(station => (
          <StationNode
            key={station.id}
            station={station}
            selected={selectedStationIds.includes(station.id)}
            inDraftLine={draftLineStationIdSet.has(station.id)}
            interchange={(lineCountByStation[station.id] ?? 0) >= 2}
            lineColor={lineCountByStation[station.id] === 1 ? lineColorByStation[station.id] : undefined}
            dragging={draggingStationIdSet.has(station.id)}
            landing={
              poppingStationIds.has(station.id)
                ? 'appear'
                : settlingStationIds.has(station.id)
                  ? 'settle'
                  : undefined
            }
            labelPlacement={labelPlacementByStation[station.id]}
            onPointerDown={handleStationPointerDown}
            onClick={handleStationClick}
            onDoubleClick={s => tool === 'select' && onRenameRequest('station', s.id)}
          />
        ))}

        {/* The air a landing landmark shoves aside. Drawn before the markers so the rings
            spread out from under the one that just arrived rather than over it. */}
        {impact && (
          <g key={impact.key} style={{ pointerEvents: 'none' }}>
            {impact.points.map((point, index) => (
              <g key={index} transform={`translate(${point.x}, ${point.y})`}>
                {(impact.soft ? [0] : [0, 90]).map(delay => (
                  <g
                    key={delay}
                    style={{
                      transformBox: 'fill-box',
                      transformOrigin: 'center',
                      animation: impact.soft
                        ? `mlb-station-ripple ${STATION_RIPPLE_MS}ms cubic-bezier(0.2, 0.6, 0.3, 1) both`
                        : `mlb-poi-impact ${IMPACT_MS - delay}ms cubic-bezier(0.2, 0.6, 0.3, 1) ${delay}ms both`,
                    }}
                  >
                    <circle
                      r={impact.soft ? 9 : 13}
                      fill="none"
                      stroke="var(--text-primary)"
                      strokeWidth={impact.soft ? 1.5 : 2}
                    />
                  </g>
                ))}
              </g>
            ))}
          </g>
        )}

        {poiList.map(poi => (
          <PoiNode
            key={poi.id}
            poi={poi}
            selected={selectedPoiIds.includes(poi.id)}
            dragging={drag.kind === 'pois' && drag.ids.includes(poi.id)}
            landing={landingPoiIds.has(poi.id) ? 'appear' : settlingPoiIds.has(poi.id) ? 'settle' : undefined}
            onPointerDown={handlePoiPointerDown}
            onDoubleClick={p => tool === 'select' && onRenameRequest('poi', p.id)}
          />
        ))}

        {/* A deleted landmark comes apart where it stood, the impact rings running backwards
            into it as it goes. */}
        {exitingPois.map(ghost => {
          const href = openMojiUrl(ghost.data.icon)
          return (
            <g key={ghost.key} transform={`translate(${ghost.data.x}, ${ghost.data.y})`} style={{ pointerEvents: 'none' }}>
              <g
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  animation: `mlb-poi-collapse ${CRUMBLE_MS}ms cubic-bezier(0.4, 0, 0.4, 1) both`,
                }}
              >
                <circle r={13} fill="none" stroke="var(--text-primary)" strokeWidth={2} />
              </g>
              <g
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  animation: `mlb-poi-crumble ${CRUMBLE_MS}ms cubic-bezier(0.5, -0.2, 0.7, 1) both`,
                }}
              >
                <rect
                  x={-14}
                  y={-14}
                  width={28}
                  height={28}
                  rx={6}
                  fill="var(--bg-surface)"
                  stroke="var(--border-subtle)"
                  strokeWidth={1}
                  opacity={0.92}
                />
                {href && <image href={href} x={-13} y={-13} width={26} height={26} />}
              </g>
            </g>
          )
        })}

        {/* Deleted stations shrink and fade from where they were. */}
        {exitingStations.map(ghost => (
          <g key={ghost.key} transform={`translate(${ghost.data.x}, ${ghost.data.y})`} style={{ pointerEvents: 'none' }}>
            <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'mlb-station-exit 240ms ease forwards' }}>
              {ghost.data.interchange ? (
                <>
                  <circle r={10} fill="var(--bg-page)" stroke="var(--text-primary)" strokeWidth={3.5} />
                  <circle r={5.5} fill="none" stroke="var(--text-primary)" strokeWidth={1.25} />
                </>
              ) : (
                <circle r={6.5} fill="var(--bg-page)" stroke="var(--text-primary)" strokeWidth={2.5} />
              )}
            </g>
          </g>
        ))}

        {drag.kind === 'marquee' && (
          <rect
            x={Math.min(drag.startX, drag.x)}
            y={Math.min(drag.startY, drag.y)}
            width={Math.abs(drag.x - drag.startX)}
            height={Math.abs(drag.y - drag.startY)}
            fill="rgba(18,85,180,0.08)"
            stroke="var(--brand-500)"
            strokeWidth={1 / transform.k}
          />
        )}

        {/* The marker standing in for the pointer: the grid point a click will actually use.
            Sized against the zoom so it stays the same size on screen however far the map is
            scaled, which is what a cursor does. */}
        {DRAW_TOOLS.includes(tool) && cursorWorld && (
          // Keyed by the grid point, so arriving somewhere new remounts the marker and replays
          // the settle. Moving the pointer within one cell changes nothing and animates
          // nothing — the motion belongs to the snap, not to the mouse.
          <g
            key={`${cursorWorld.x},${cursorWorld.y}`}
            transform={`translate(${cursorWorld.x}, ${cursorWorld.y})`}
            style={{ pointerEvents: 'none' }}
          >
            <g className="mlb-snap-in">
              {connectTarget ? (
                <circle
                  className="mlb-snap-ring"
                  r={14 / transform.k}
                  fill="none"
                  stroke="var(--interactive-primary)"
                  strokeWidth={2 / transform.k}
                  strokeDasharray={`${5 / transform.k} ${3.5 / transform.k}`}
                />
              ) : joinTarget ? (
                <>
                  <circle className="mlb-station-preview" r={13 / transform.k} fill={joinTarget.color} />
                  <circle
                    r={6.5 / transform.k}
                    fill="var(--bg-page)"
                    stroke="var(--text-primary)"
                    strokeWidth={2.5 / transform.k}
                    opacity={0.85}
                  />
                </>
              ) : (
                <>
                  <circle
                    className="mlb-snap-ring"
                    r={10 / transform.k}
                    fill="none"
                    stroke="var(--interactive-primary)"
                    strokeWidth={1.5 / transform.k}
                  />
                  <circle className="mlb-snap-dot" r={2.5 / transform.k} fill="var(--interactive-primary)" />
                </>
              )}
            </g>
          </g>
        )}
      </g>
    </svg>
  )
})
