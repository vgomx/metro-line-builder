import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Line, Station, Tool } from '../types'
import { useZoomPan } from './useZoomPan'
import { StationNode } from './StationNode'
import { LinePath } from './LinePath'
import { routeOrthogonal } from './routing'

interface MapCanvasProps {
  tool: Tool
  stationList: Station[]
  lineList: Line[]
  stations: Record<string, Station>
  selectedStationIds: string[]
  selectedLineIds: string[]
  draftLineStationIds: string[]
  onAddStation: (x: number, y: number) => void
  onMoveStations: (ids: string[], dx: number, dy: number) => void
  onAddToDraftLine: (stationId: string) => void
  onFinishDraftLine: () => void
  onCancelDraftLine: () => void
  onSetSelection: (stationIds: string[], lineIds: string[]) => void
  onClearSelection: () => void
  onDeleteSelected: () => void
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
  | { kind: 'marquee'; startX: number; startY: number; x: number; y: number }
  | { kind: 'stations'; ids: string[]; lastX: number; lastY: number; moved: boolean }

export function MapCanvas({
  tool,
  stationList,
  lineList,
  stations,
  selectedStationIds,
  selectedLineIds,
  draftLineStationIds,
  onAddStation,
  onMoveStations,
  onAddToDraftLine,
  onFinishDraftLine,
  onCancelDraftLine,
  onSetSelection,
  onClearSelection,
  onDeleteSelected,
}: MapCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const transform = useZoomPan(svgRef)
  const [drag, setDrag] = useState<DragState>({ kind: 'none' })
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.key === 'Escape') {
        if (draftLineStationIds.length > 0) onCancelDraftLine()
        else onClearSelection()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedStationIds.length > 0 || selectedLineIds.length > 0) {
          e.preventDefault()
          onDeleteSelected()
        }
      } else if (e.key === 'Enter') {
        if (draftLineStationIds.length >= 2) onFinishDraftLine()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [draftLineStationIds, selectedStationIds, selectedLineIds, onCancelDraftLine, onClearSelection, onDeleteSelected, onFinishDraftLine])

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
    if (tool === 'add-station') {
      const { x, y } = toWorld(e.clientX, e.clientY)
      onAddStation(x, y)
      return
    }
    if (tool === 'select') {
      const { x, y } = toWorld(e.clientX, e.clientY)
      safeSetPointerCapture(e.target as Element, e.pointerId)
      setDrag({ kind: 'marquee', startX: x, startY: y, x, y })
    }
  }

  const handleStationPointerDown = (e: ReactPointerEvent<SVGGElement>, station: Station) => {
    if (e.button !== 0) return
    if (tool === 'draw-line') return
    if (tool !== 'select') return
    e.stopPropagation()
    safeSetPointerCapture(e.target as Element, e.pointerId)
    const ids = selectedStationIds.includes(station.id) ? selectedStationIds : [station.id]
    if (!selectedStationIds.includes(station.id)) {
      onSetSelection([station.id], [])
    }
    setDrag({ kind: 'stations', ids, lastX: e.clientX, lastY: e.clientY, moved: false })
  }

  const handleStationClick = (station: Station) => {
    if (tool === 'draw-line') {
      onAddToDraftLine(station.id)
    }
  }

  const handleLineClick = (line: Line) => {
    if (tool !== 'select') return
    onSetSelection([], [line.id])
  }

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (tool === 'draw-line') {
      setCursorWorld(toWorld(e.clientX, e.clientY))
    }

    if (drag.kind === 'marquee') {
      const { x, y } = toWorld(e.clientX, e.clientY)
      setDrag({ ...drag, x, y })
    } else if (drag.kind === 'stations') {
      const dx = (e.clientX - drag.lastX) / transform.k
      const dy = (e.clientY - drag.lastY) / transform.k
      if (dx !== 0 || dy !== 0) {
        onMoveStations(drag.ids, dx, dy)
        setDrag({ ...drag, lastX: e.clientX, lastY: e.clientY, moved: true })
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
        const ids = stationList
          .filter(s => s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY)
          .map(s => s.id)
        onSetSelection(ids, [])
      } else {
        onClearSelection()
      }
    } else if (drag.kind === 'stations' && !drag.moved) {
      // plain click on an already-selected station: keep single selection
    }
    setDrag({ kind: 'none' })
  }

  const handleDoubleClick = () => {
    if (tool === 'draw-line' && draftLineStationIds.length >= 2) {
      onFinishDraftLine()
    }
  }

  const draftPoints = draftLineStationIds.map(id => stations[id]).filter(Boolean) as Station[]
  const draftPreviewPoints = cursorWorld ? [...draftPoints, cursorWorld] : draftPoints
  const draftPath = draftPreviewPoints.length > 0 ? routeOrthogonal(draftPreviewPoints) : ''

  const cursor = tool === 'add-station' ? 'crosshair' : tool === 'draw-line' ? 'crosshair' : 'default'

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ display: 'block', background: 'var(--bg-page)', cursor }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
        <rect
          x={-10000}
          y={-10000}
          width={20000}
          height={20000}
          fill="transparent"
          onPointerDown={handleBackgroundPointerDown}
        />

        {lineList.map(line => (
          <LinePath
            key={line.id}
            line={line}
            stations={stations}
            selected={selectedLineIds.includes(line.id)}
            onClick={handleLineClick}
          />
        ))}

        {draftPath && (
          <path d={draftPath} fill="none" stroke="var(--brand-400)" strokeWidth={3} strokeDasharray="6 4" />
        )}

        {stationList.map(station => (
          <StationNode
            key={station.id}
            station={station}
            selected={selectedStationIds.includes(station.id)}
            inDraftLine={draftLineStationIds.includes(station.id)}
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
      </g>
    </svg>
  )
}
