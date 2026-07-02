import { useRef, useState } from 'react'
import { Button } from 'metro-ds'
import { useMapState } from './state/useMapState'
import { MapCanvas } from './canvas/MapCanvas'
import type { MapCanvasHandle } from './canvas/MapCanvas'
import { TopBar } from './components/TopBar'
import { LeftToolbar } from './components/LeftToolbar'
import { RightPanel } from './components/RightPanel'
import { CanvasOverlay } from './components/CanvasOverlay'
import { exportMapAsJson } from './export'

function App() {
  const {
    state,
    stationList,
    lineList,
    setTool,
    setMapName,
    addStation,
    moveStations,
    renameStation,
    toggleStationTransfer,
    addToDraftLine,
    finishDraftLine,
    cancelDraftLine,
    setSelection,
    clearSelection,
    deleteSelected,
    deleteLine,
    deleteStation,
    renameLine,
    recolorLine,
    toggleLineVisibility,
    checkpoint,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useMapState()

  const mapCanvasRef = useRef<MapCanvasHandle>(null)
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(false)
  const [showTrains, setShowTrains] = useState(false)

  const selectedLine =
    state.selectedLineIds.length === 1 && state.selectedStationIds.length === 0
      ? (state.lines[state.selectedLineIds[0]] ?? null)
      : null
  const selectedStation =
    state.selectedStationIds.length === 1 && state.selectedLineIds.length === 0
      ? (state.stations[state.selectedStationIds[0]] ?? null)
      : null

  const selectionLabel = selectedStation
    ? `Station: ${selectedStation.name}`
    : selectedLine
      ? `Line: ${selectedLine.name}`
      : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100svh' }}>
      <TopBar
        mapName={state.mapName}
        onMapNameChange={setMapName}
        zoom={zoom}
        onZoomIn={() => mapCanvasRef.current?.zoomIn()}
        onZoomOut={() => mapCanvasRef.current?.zoomOut()}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(g => !g)}
        showTrains={showTrains}
        onToggleTrains={() => setShowTrains(t => !t)}
        onExport={() => exportMapAsJson(state.mapName, stationList, lineList)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <LeftToolbar tool={state.tool} onSetTool={setTool} />

        <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <MapCanvas
            ref={mapCanvasRef}
            tool={state.tool}
            stationList={stationList}
            lineList={lineList}
            stations={state.stations}
            selectedStationIds={state.selectedStationIds}
            selectedLineIds={state.selectedLineIds}
            draftLineStationIds={state.draftLineStationIds}
            showGrid={showGrid}
            showTrains={showTrains}
            onAddStation={addStation}
            onMoveStations={moveStations}
            onAddToDraftLine={addToDraftLine}
            onFinishDraftLine={finishDraftLine}
            onCancelDraftLine={cancelDraftLine}
            onSetSelection={setSelection}
            onClearSelection={clearSelection}
            onDeleteSelected={deleteSelected}
            onCheckpoint={checkpoint}
            onUndo={undo}
            onRedo={redo}
            onTransformChange={t => setZoom(t.k)}
          />

          <CanvasOverlay
            lineCount={lineList.length}
            stationCount={stationList.length}
            zoom={zoom}
            selectionLabel={selectionLabel}
          />

          {state.draftLineStationIds.length >= 2 && (
            <div style={{ position: 'absolute', top: 'var(--space-3)', left: '50%', transform: 'translateX(-50%)' }}>
              <Button variant="primary" onClick={finishDraftLine}>
                Finish line ({state.draftLineStationIds.length} stations)
              </Button>
            </div>
          )}
        </main>

        <RightPanel
          lineList={lineList}
          stationList={stationList}
          lines={state.lines}
          stations={state.stations}
          selectedLine={selectedLine}
          selectedStation={selectedStation}
          onSelectLine={id => setSelection([], [id])}
          onSelectStation={id => setSelection([id], [])}
          onToggleLineVisibility={toggleLineVisibility}
          onAddLine={() => setTool('draw-line')}
          onRenameLine={renameLine}
          onRecolorLine={recolorLine}
          onDeleteLine={deleteLine}
          onRenameStation={renameStation}
          onToggleTransfer={toggleStationTransfer}
          onDeleteStation={deleteStation}
        />
      </div>
    </div>
  )
}

export default App
