import { useRef, useState } from 'react'
import { Button, Toast } from 'metro-ds'
import { useMapState } from './state/useMapState'
import { MapCanvas } from './canvas/MapCanvas'
import type { MapCanvasHandle } from './canvas/MapCanvas'
import { TopBar } from './components/TopBar'
import { LeftToolbar } from './components/LeftToolbar'
import { RightPanel } from './components/RightPanel'
import { CanvasOverlay } from './components/CanvasOverlay'
import { CanvasLegend } from './components/CanvasLegend'
import { LineAnnouncer } from './components/LineAnnouncer'
import { exportMapAsJson, pickMapFile } from './export'
import { stationIdsOfLine } from './canvas/lineNodes'
import { useTheme } from './useTheme'

function App() {
  const {
    state,
    stationList,
    lineList,
    geoFeatureList,
    companyList,
    snapshot,
    setTool,
    setMapName,
    setAuthorityName,
    loadMap,
    addCompany,
    renameCompany,
    setCompanyType,
    deleteCompany,
    setLineCompany,
    addStation,
    moveStations,
    mergeStations,
    renameStation,
    toggleStationTransfer,
    appendDraftLineNode,
    insertDraftLineStation,
    insertLineStation,
    startExtendLine,
    finishDraftLine,
    cancelDraftLine,
    addGeoPoint,
    startExtendGeoFeature,
    finishGeoFeature,
    cancelGeoFeature,
    deleteGeoFeature,
    renameGeoFeature,
    setSelection,
    clearSelection,
    selectWaypoint,
    deleteWaypoint,
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
  const { theme, toggleTheme } = useTheme()
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [showTrains, setShowTrains] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)

  const handleOpen = () => {
    pickMapFile(
      data => {
        const ok = loadMap(data)
        setToast(
          ok
            ? { message: 'Map opened. Press Ctrl+Z to undo.', variant: 'success' }
            : { message: "That file doesn't look like a metro map.", variant: 'error' },
        )
      },
      message => setToast({ message, variant: 'error' }),
    )
  }

  // Company selection lives outside the reducer's station/line/geo selection (companies
  // aren't canvas entities), so canvas selection and company selection stay mutually
  // exclusive by clearing the other side whenever one is set.
  const handleSetSelection = (stationIds: string[], lineIds: string[], geoFeatureIds: string[]) => {
    setSelectedCompanyId(null)
    setSelection(stationIds, lineIds, geoFeatureIds)
  }
  const handleClearSelection = () => {
    setSelectedCompanyId(null)
    clearSelection()
  }
  const handleSelectCompany = (companyId: string) => {
    clearSelection()
    setSelectedCompanyId(companyId)
  }

  const selectedLine =
    state.selectedLineIds.length === 1 && state.selectedStationIds.length === 0 && state.selectedGeoFeatureIds.length === 0
      ? (state.lines[state.selectedLineIds[0]] ?? null)
      : null
  const selectedStation =
    state.selectedStationIds.length === 1 && state.selectedLineIds.length === 0 && state.selectedGeoFeatureIds.length === 0
      ? (state.stations[state.selectedStationIds[0]] ?? null)
      : null
  const selectedGeoFeature =
    state.selectedGeoFeatureIds.length === 1 && state.selectedStationIds.length === 0 && state.selectedLineIds.length === 0
      ? (state.geoFeatures[state.selectedGeoFeatureIds[0]] ?? null)
      : null
  const selectedCompany = selectedCompanyId ? (state.companies[selectedCompanyId] ?? null) : null

  const authorityDisplayName = state.authorityName || `${state.mapName.trim() || 'Untitled Map'} Transit Authority`

  // Line selection gets its own bottom-center LED announcer (below) instead of the
  // plain text pill used for station/geo selections.
  const selectionLabel = selectedStation
    ? `Station: ${selectedStation.name}`
    : selectedGeoFeature
      ? `${selectedGeoFeature.type === 'river' ? 'River' : 'Park'}: ${selectedGeoFeature.name}`
      : null

  const geoDraftLabel = state.tool === 'draw-river' ? 'river' : state.tool === 'draw-park' ? 'park' : null
  const geoMinPoints = state.tool === 'draw-park' ? 3 : 2

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
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpen={handleOpen}
        onExport={() => exportMapAsJson(snapshot)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <LeftToolbar tool={state.tool} onSetTool={setTool} theme={theme} />

        <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <MapCanvas
            ref={mapCanvasRef}
            tool={state.tool}
            stationList={stationList}
            lineList={lineList}
            geoFeatureList={geoFeatureList}
            stations={state.stations}
            selectedStationIds={state.selectedStationIds}
            selectedLineIds={state.selectedLineIds}
            selectedGeoFeatureIds={state.selectedGeoFeatureIds}
            selectedWaypoint={state.selectedWaypoint}
            draftLineNodes={state.draftLineNodes}
            draftGeoPoints={state.draftGeoPoints}
            showGrid={showGrid}
            showTrains={showTrains}
            onAddStation={addStation}
            onMoveStations={moveStations}
            onMergeStations={mergeStations}
            onAppendDraftLineNode={appendDraftLineNode}
            onInsertDraftLineStation={insertDraftLineStation}
            onInsertLineStation={insertLineStation}
            onFinishDraftLine={finishDraftLine}
            onCancelDraftLine={cancelDraftLine}
            onAddGeoPoint={addGeoPoint}
            onFinishGeoFeature={finishGeoFeature}
            onCancelGeoFeature={cancelGeoFeature}
            onSetSelection={handleSetSelection}
            onClearSelection={handleClearSelection}
            onSelectWaypoint={selectWaypoint}
            onDeleteWaypoint={deleteWaypoint}
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

          <CanvasLegend mapName={state.mapName} authorityName={state.authorityName} />

          {selectedLine && (
            <LineAnnouncer
              key={selectedLine.id}
              line={selectedLine}
              scrollText={(() => {
                const ids = stationIdsOfLine(selectedLine)
                const terminus = ids.length > 0 ? state.stations[ids[ids.length - 1]]?.name : null
                return terminus ? `${selectedLine.name}  •  TO ${terminus}` : selectedLine.name
              })()}
            />
          )}

          {state.tool === 'draw-line' && state.draftLineNodes.length === 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'var(--space-3)',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--ink-900)',
                color: 'var(--ink-0)',
                borderRadius: 'var(--radius-lg)',
                padding: '5px 12px',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
              }}
            >
              Click a station or the canvas to start drawing a line
            </div>
          )}

          {state.draftLineNodes.length >= 2 && (
            <div style={{ position: 'absolute', top: 'var(--space-3)', left: '50%', transform: 'translateX(-50%)' }}>
              <Button variant="primary" onClick={finishDraftLine}>
                {state.draftLineId
                  ? `Update line (${state.draftLineNodes.length} points)`
                  : `Finish line (${state.draftLineNodes.length} points)`}
              </Button>
            </div>
          )}

          {geoDraftLabel && state.draftGeoPoints.length >= geoMinPoints && (
            <div style={{ position: 'absolute', top: 'var(--space-3)', left: '50%', transform: 'translateX(-50%)' }}>
              <Button variant="primary" onClick={finishGeoFeature}>
                Finish {geoDraftLabel} ({state.draftGeoPoints.length} points)
              </Button>
            </div>
          )}

          {toast && (
            <div style={{ position: 'absolute', bottom: 'var(--space-3)', right: 'var(--space-3)' }}>
              <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />
            </div>
          )}
        </main>

        <RightPanel
          mapName={state.mapName}
          authorityName={state.authorityName}
          authorityDisplayName={authorityDisplayName}
          lineList={lineList}
          stationList={stationList}
          geoFeatureList={geoFeatureList}
          companyList={companyList}
          lines={state.lines}
          stations={state.stations}
          selectedLine={selectedLine}
          selectedStation={selectedStation}
          selectedGeoFeature={selectedGeoFeature}
          selectedCompany={selectedCompany}
          onSelectLine={id => {
            handleSetSelection([], [id], [])
            // Fly to the line only when picked from the list; a click on the canvas
            // leaves the viewport alone (the line is already where the user is looking).
            mapCanvasRef.current?.frameLine(id)
          }}
          onSelectStation={id => handleSetSelection([id], [], [])}
          onSelectGeoFeature={id => handleSetSelection([], [], [id])}
          onSelectCompany={handleSelectCompany}
          onToggleLineVisibility={toggleLineVisibility}
          onAddLine={() => setTool('draw-line')}
          onAddRiver={() => setTool('draw-river')}
          onAddPark={() => setTool('draw-park')}
          onAddCompany={addCompany}
          onSetAuthorityName={setAuthorityName}
          onRenameLine={renameLine}
          onRecolorLine={recolorLine}
          onSetLineCompany={setLineCompany}
          onExtendLine={startExtendLine}
          onDeleteLine={deleteLine}
          onRenameStation={renameStation}
          onToggleTransfer={toggleStationTransfer}
          onDeleteStation={deleteStation}
          onRenameGeoFeature={renameGeoFeature}
          onExtendGeoFeature={startExtendGeoFeature}
          onDeleteGeoFeature={deleteGeoFeature}
          onRenameCompany={renameCompany}
          onSetCompanyType={setCompanyType}
          onDeleteCompany={deleteCompany}
        />
      </div>
    </div>
  )
}

export default App
