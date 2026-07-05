import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { ZoomTransform } from 'd3-zoom'
import type { GeoFeature, Line, LineNode, Point, Station, Tool } from '../types'
import { useZoomPan } from './useZoomPan'
import { StationNode } from './StationNode'
import { WaypointNode } from './WaypointNode'
import { LinePath } from './LinePath'
import { GeoFeaturePath } from './GeoFeaturePath'
import { TrainMarker } from './TrainMarker'
import { SnapAnimation } from './SnapAnimation'
import { routeOrthogonal } from './routing'
import { GRID_SIZE, snapToGrid } from '../grid'
import {
  buildSegmentLineMap,
  buildVertexSegmentLineMap,
  closestSegmentIndex,
  computeLaneOffsets,
  resolveLineNodes,
  stationIdsOfLine,
} from './lineNodes'
import { computeLabelPlacement } from './labelPlacement'

export interface MapCanvasHandle {
  zoomIn: () => void
  zoomOut: () => void
}

interface MapCanvasProps {
  tool: Tool
  stationList: Station[]
  lineList: Line[]
  geoFeatureList: GeoFeature[]
  stations: Record<string, Station>
  selectedStationIds: string[]
  selectedLineIds: string[]
  selectedGeoFeatureIds: string[]
  selectedWaypoint: { lineId: string; index: number } | null
  draftLineNodes: LineNode[]
  draftGeoPoints: Point[]
  showGrid: boolean
  showTrains: boolean
  onAddStation: (x: number, y: number) => void
  onMoveStations: (ids: string[], dx: number, dy: number) => void
  onMergeStations: (survivorId: string, mergedId: string) => void
  onAppendDraftLineNode: (node: LineNode) => void
  onInsertDraftLineStation: (x: number, y: number, index: number) => void
  onInsertLineStation: (lineId: string, x: number, y: number, index: number) => void
  onFinishDraftLine: () => void
  onCancelDraftLine: () => void
  onAddGeoPoint: (x: number, y: number) => void
  onFinishGeoFeature: () => void
  onCancelGeoFeature: () => void
  onSetSelection: (stationIds: string[], lineIds: string[], geoFeatureIds: string[]) => void
  onClearSelection: () => void
  onSelectWaypoint: (lineId: string, index: number) => void
  onDeleteWaypoint: (lineId: string, index: number) => void
  onDeleteSelected: () => void
  onCheckpoint: () => void
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

const GRID_EXTENT = 4000
const DRAW_TOOLS: Tool[] = ['add-station', 'draw-line', 'draw-river', 'draw-park']
const RIVER_DRAFT_STROKE = '#60A5FA'
const PARK_DRAFT_STROKE = '#4ADE80'

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  {
    tool,
    stationList,
    lineList,
    geoFeatureList,
    stations,
    selectedStationIds,
    selectedLineIds,
    selectedGeoFeatureIds,
    selectedWaypoint,
    draftLineNodes,
    draftGeoPoints,
    showGrid,
    showTrains,
    onAddStation,
    onMoveStations,
    onMergeStations,
    onAppendDraftLineNode,
    onInsertDraftLineStation,
    onInsertLineStation,
    onFinishDraftLine,
    onCancelDraftLine,
    onAddGeoPoint,
    onFinishGeoFeature,
    onCancelGeoFeature,
    onSetSelection,
    onClearSelection,
    onSelectWaypoint,
    onDeleteWaypoint,
    onDeleteSelected,
    onCheckpoint,
    onUndo,
    onRedo,
    onTransformChange,
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { transform, zoomIn, zoomOut, spaceHeld } = useZoomPan(svgRef, tool === 'pan')
  const [drag, setDrag] = useState<DragState>({ kind: 'none' })
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null)
  const [snapAnimations, setSnapAnimations] = useState<
    { key: string; lineId: string; color: string; from: Point[]; to: Point[] }[]
  >([])
  const snapSessionRef = useRef(0)

  useImperativeHandle(ref, () => ({ zoomIn, zoomOut }), [zoomIn, zoomOut])

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
        else onClearSelection()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedWaypoint) {
          e.preventDefault()
          onDeleteWaypoint(selectedWaypoint.lineId, selectedWaypoint.index)
        } else if (selectedStationIds.length > 0 || selectedLineIds.length > 0 || selectedGeoFeatureIds.length > 0) {
          e.preventDefault()
          onDeleteSelected()
        }
      } else if (e.key === 'Enter') {
        if (draftLineNodes.length >= 2) onFinishDraftLine()
        else if (draftGeoPoints.length >= 2) onFinishGeoFeature()
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
    selectedWaypoint,
    onCancelDraftLine,
    onCancelGeoFeature,
    onClearSelection,
    onDeleteWaypoint,
    onDeleteSelected,
    onFinishDraftLine,
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
    if (tool === 'draw-line' || tool === 'draw-river' || tool === 'draw-park' || tool === 'add-station') {
      const w = toWorld(e.clientX, e.clientY)
      setCursorWorld({ x: snapToGrid(w.x), y: snapToGrid(w.y) })
    }

    if (drag.kind === 'marquee') {
      const { x, y } = toWorld(e.clientX, e.clientY)
      setDrag({ ...drag, x, y })
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
          if (!drag.moved) onCheckpoint()
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

      snapSessionRef.current += 1
      const session = snapSessionRef.current
      const affected = lineList
        .filter(line => line.visible && stationIdsOfLine(line).some(id => id in drag.originalPositions))
        .map(line => {
          const fromPoints = line.nodes
            .map(n => (n.kind === 'station' ? (drag.originalPositions[n.stationId] ?? stations[n.stationId]) : n))
            .filter((p): p is Point => Boolean(p))
          const toPoints = resolveLineNodes(line.nodes, stations)
          return { key: `${session}-${line.id}`, lineId: line.id, color: line.color, from: fromPoints, to: toPoints }
        })
        .filter(a => a.from.length >= 2 && a.to.length >= 2)
      if (affected.length > 0) setSnapAnimations(affected)
    }
    setDrag({ kind: 'none' })
  }

  const handleDoubleClick = () => {
    if (spaceHeld) return
    if (tool === 'draw-line' && draftLineNodes.length >= 2) {
      onFinishDraftLine()
    } else if ((tool === 'draw-river' || tool === 'draw-park') && draftGeoPoints.length >= 2) {
      onFinishGeoFeature()
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

  const labelPlacementByStation: Record<string, ReturnType<typeof computeLabelPlacement>> = {}
  for (const station of stationList) {
    labelPlacementByStation[station.id] = computeLabelPlacement(station.id, lineList, stations)
  }

  const draftLineStationIdSet = new Set(
    draftLineNodes.filter((n): n is Extract<LineNode, { kind: 'station' }> => n.kind === 'station').map(n => n.stationId),
  )

  const draggingStationIdSet = new Set(drag.kind === 'stations' ? drag.ids : [])

  const segmentLineMap = buildSegmentLineMap(lineList, stations)
  // Finer-grained than segmentLineMap (keyed on routed vertices, not raw line nodes)
  // so lines that only share part of a routed path fan out correctly instead of
  // drawing on top of each other. Only the line-path renderer needs this — train
  // animation stays on the coarser map since its stop points are real line nodes.
  const lineRenderSegmentMap = buildVertexSegmentLineMap(lineList, stations)

  const cursor = spaceHeld || tool === 'pan' ? 'grab' : DRAW_TOOLS.includes(tool) ? 'crosshair' : 'default'

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
      style={{ display: 'block', background: 'var(--bg-page)', cursor, userSelect: 'none', WebkitUserSelect: 'none' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setCursorWorld(null)}
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

        {snapAnimations.map(a => (
          <SnapAnimation
            key={a.key}
            color={a.color}
            fromPoints={a.from}
            toPoints={a.to}
            onComplete={() => setSnapAnimations(prev => prev.filter(p => p.key !== a.key))}
          />
        ))}

        {lineList
          .filter(line => line.visible)
          .map(line => (
            <LinePath
              key={line.id}
              line={line}
              stations={stations}
              selected={selectedLineIds.includes(line.id)}
              segmentLineMap={lineRenderSegmentMap}
              onClick={handleLineClick}
            />
          ))}

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
              const trainPoints = resolveLineNodes(line.nodes, stations)
              return (
                <TrainMarker
                  key={line.id}
                  lineId={line.id}
                  color={line.color}
                  pathPoints={trainPoints}
                  stopFlags={line.nodes.map(n => n.kind === 'station')}
                  laneOffsets={computeLaneOffsets(trainPoints, line.id, segmentLineMap)}
                />
              )
            })}

        {stationList.map(station => (
          <StationNode
            key={station.id}
            station={station}
            selected={selectedStationIds.includes(station.id)}
            inDraftLine={draftLineStationIdSet.has(station.id)}
            interchange={(lineCountByStation[station.id] ?? 0) >= 2}
            dragging={draggingStationIdSet.has(station.id)}
            labelPlacement={labelPlacementByStation[station.id]}
            onPointerDown={handleStationPointerDown}
            onClick={handleStationClick}
          />
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

        {/* Hot-spot cue: highlights the grid intersection a draw tool will snap to,
            making precise placement easier to judge before clicking. */}
        {DRAW_TOOLS.includes(tool) && cursorWorld && (
          <g transform={`translate(${cursorWorld.x}, ${cursorWorld.y})`} style={{ pointerEvents: 'none' }}>
            <circle r={10 / transform.k} fill="none" stroke="var(--interactive-primary)" strokeWidth={1.5 / transform.k} opacity={0.9} />
            <circle r={2.5 / transform.k} fill="var(--interactive-primary)" />
          </g>
        )}
      </g>
    </svg>
  )
})
