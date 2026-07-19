import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { ZoomTransform } from 'd3-zoom'
import type { GeoFeature, Line, LineNode, Point, PointOfInterest, Station, Tool } from '../types'
import { useZoomPan } from './useZoomPan'
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
  /** Where a symbol dragged in from the palette would land, or null when nothing is over the
   * canvas. Doubles as the "a drop is in flight" flag. */
  const [dropPoint, setDropPoint] = useState<Point | null>(null)
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
    const frames = buildRefanFrames(prevLines, lineList, stations)
    if (frames.length === 0) return
    refanSessionRef.current += 1
    setRefanSession({ key: refanSessionRef.current, lines: frames })
  }, [lineList, stations])

  useImperativeHandle(
    ref,
    () => ({
      zoomIn,
      zoomOut,
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
      fitContent: () => {
        const paths = svgRef.current?.querySelectorAll<SVGGraphicsElement>('path[id^="line-"]')
        if (!paths || paths.length === 0) return
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const path of paths) {
          const b = path.getBBox()
          if (b.width === 0 && b.height === 0) continue
          minX = Math.min(minX, b.x)
          minY = Math.min(minY, b.y)
          maxX = Math.max(maxX, b.x + b.width)
          maxY = Math.max(maxY, b.y + b.height)
        }
        if (minX === Infinity) return
        frameBounds({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
      },
    }),
    [zoomIn, zoomOut, frameBounds],
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
      setCursorWorld({ x: snapToGrid(w.x), y: snapToGrid(w.y) })
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

  const handlePointerUp = () => {
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
      setSnapSession({ key: String(snapSessionRef.current), originalPositions: drag.originalPositions })
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
    if (tool === 'add-poi') onReturnToSelect()
  }

  // Dragging a symbol in from the palette. dragover has to preventDefault on every event or
  // the browser refuses the drop, and the payload itself is unreadable until drop — only the
  // *types* are exposed mid-drag, which is exactly enough to tell our symbols from anything
  // else the user might be dragging across the window.
  const handleDragOver = (e: ReactDragEvent<SVGSVGElement>) => {
    if (!e.dataTransfer.types.includes(POI_DRAG_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const w = toWorld(e.clientX, e.clientY)
    const snapped = { x: snapToPoiGrid(w.x), y: snapToPoiGrid(w.y) }
    // dragover fires continuously; skipping the identical position keeps it from re-rendering
    // the whole canvas between one grid square and the next.
    setDropPoint(prev => (prev && prev.x === snapped.x && prev.y === snapped.y ? prev : snapped))
  }

  const handleDrop = (e: ReactDragEvent<SVGSVGElement>) => {
    const icon = e.dataTransfer.getData(POI_DRAG_MIME)
    setDropPoint(null)
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
  const draftCommittedPath = draftPoints.length >= 2 ? routeOrthogonal(draftPoints) : ''
  const draftCursorPath =
    cursorWorld && draftPoints.length >= 1 ? routeOrthogonal([draftPoints[draftPoints.length - 1], cursorWorld]) : ''

  const draftGeoPreviewPoints = cursorWorld ? [...draftGeoPoints, cursorWorld] : draftGeoPoints
  const draftGeoPath = draftGeoPreviewPoints.length > 1 ? routeOrthogonal(draftGeoPreviewPoints) : ''

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
  for (const line of lineList) {
    for (const id of new Set(stationIdsOfLine(line))) {
      lineCountByStation[id] = (lineCountByStation[id] ?? 0) + 1
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
      width="100%"
      height="100%"
      className={drawingWithMarker ? 'mlb-drawing' : undefined}
      style={{ display: 'block', background: 'var(--bg-page)', cursor, userSelect: 'none', WebkitUserSelect: 'none' }}
      onPointerDown={handleRootPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setCursorWorld(null)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={() => setDropPoint(null)}
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
        <rect
          x={-10000}
          y={-10000}
          width={20000}
          height={20000}
          fill="transparent"
          onPointerDown={handleBackgroundPointerDown}
        />

        {showGrid && (
          <g stroke="var(--border-default)" strokeWidth={1 / transform.k} opacity={0.4}>
            {gridLines}
          </g>
        )}

        {geoFeatureList.map(feature => (
          <GeoFeaturePath
            key={feature.id}
            feature={feature}
            selected={selectedGeoFeatureIds.includes(feature.id)}
            onClick={handleGeoFeatureClick}
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
              style={{ pointerEvents: 'none' }}
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
            opacity={0.55}
            style={{ pointerEvents: 'none' }}
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
        {(dropPoint ?? (DRAW_TOOLS.includes(tool) ? cursorWorld : null)) && (
          <g
            transform={`translate(${(dropPoint ?? cursorWorld)!.x}, ${(dropPoint ?? cursorWorld)!.y})`}
            style={{ pointerEvents: 'none' }}
          >
            <circle r={10 / transform.k} fill="none" stroke="var(--interactive-primary)" strokeWidth={1.5 / transform.k} opacity={0.9} />
            <circle r={2.5 / transform.k} fill="var(--interactive-primary)" />
          </g>
        )}
      </g>
    </svg>
  )
})
