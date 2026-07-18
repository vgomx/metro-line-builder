import { useCallback, useRef, useState } from 'react'
import { Button, Toast } from 'metro-ds'
import { useMapState } from './state/useMapState'
import { MapCanvas } from './canvas/MapCanvas'
import type { MapCanvasHandle } from './canvas/MapCanvas'
import { TopBar } from './components/TopBar'
import { LeftToolbar, LEFT_TOOLBAR_WIDTH } from './components/LeftToolbar'
import { RightPanel, RIGHT_PANEL_WIDTH } from './components/RightPanel'
import { CanvasStats, SelectionLabel } from './components/CanvasOverlay'
import { PoiPicker } from './components/PoiPicker'
import { CanvasLegend } from './components/CanvasLegend'
import { LineAnnouncer } from './components/LineAnnouncer'
import { exportMapAsJson, pickMapFile } from './export'
import { stationIdsOfLine } from './canvas/lineNodes'
import { useTheme } from './useTheme'
import { useSound } from './useSound'
import { playSound } from './sound'
import type { SoundName } from './sound'
import type { Tool } from './types'
import { openMojiLabel } from './openmoji'

// The canvas runs edge to edge underneath the floating toolbar and panel, so the parts of
// it they cover aren't usable space. These insets keep the two things that care in sync:
// the layer the centred canvas chrome (draft buttons, LED sign, toast) is anchored to, and
// the framing maths, which centres on what's actually visible rather than on the svg.
// FLOAT_GAP mirrors --space-3, the margin the panels float by; framing needs it as a number.
const FLOAT_GAP = 12
const CANVAS_INSETS = {
  left: FLOAT_GAP * 2 + LEFT_TOOLBAR_WIDTH,
  right: FLOAT_GAP * 2 + RIGHT_PANEL_WIDTH,
  top: FLOAT_GAP,
  bottom: FLOAT_GAP,
}

function App() {
  const {
    state,
    stationList,
    lineList,
    geoFeatureList,
    companyList,
    poiList,
    snapshot,
    setTool,
    setMapName,
    setAuthorityName,
    loadMap,
    generateMap,
    addCompany,
    renameCompany,
    setCompanyType,
    setCompanySymbol,
    deleteCompany,
    setLineCompany,
    addStation,
    moveStations,
    mergeStations,
    renameStation,
    toggleStationTransfer,
    toggleStationMain,
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
    addPoi,
    movePois,
    renamePoi,
    setPoiIcon,
    deletePoi,
    setSelection,
    clearSelection,
    selectWaypoint,
    deleteWaypoint,
    deleteSelected,
    deleteLine,
    deleteStation,
    renameLine,
    setLineNumber,
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
  const { soundEnabled, toggleSound } = useSound()
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
            : { message: "Hmm, that doesn't look like a metro map I recognise.", variant: 'error' },
        )
      },
      message => setToast({ message, variant: 'error' }),
    )
  }

  const SURPRISE_LINES = [
    'A brand-new city, fresh off the drawing board. Ctrl+Z to change your mind.',
    'One metropolis, conjured from thin air. Undo if it displeases you.',
    'Behold — a transit network nobody asked for. Ctrl+Z to un-behold it.',
    'A whole new city. The commuters are already grumbling.',
  ]
  const handleSurprise = () => {
    playSound('generate')
    generateMap()
    setToast({ message: SURPRISE_LINES[Math.floor(Math.random() * SURPRISE_LINES.length)], variant: 'success' })
    // Frame the new city once React has committed the fresh line paths (two frames is
    // enough for the commit + the browser's layout of the new SVG geometry).
    requestAnimationFrame(() => requestAnimationFrame(() => mapCanvasRef.current?.fitContent()))
  }

  // Company selection lives outside the reducer's station/line/geo selection (companies
  // aren't canvas entities), so canvas selection and company selection stay mutually
  // exclusive by clearing the other side whenever one is set.
  const handleSetSelection = (stationIds: string[], lineIds: string[], geoFeatureIds: string[], poiIds: string[] = []) => {
    setSelectedCompanyId(null)
    setSelection(stationIds, lineIds, geoFeatureIds, poiIds)
  }
  const handleClearSelection = () => {
    setSelectedCompanyId(null)
    clearSelection()
  }
  const handleSelectCompany = (companyId: string) => {
    playSound('tool')
    clearSelection()
    setSelectedCompanyId(companyId)
  }

  // Sound is a presentation concern, so it's attached to the callbacks here at the
  // interaction layer rather than fired from the reducer — the state layer stays unaware
  // the app makes any noise, and every path that reaches an action (canvas click, list
  // click, keyboard shortcut) already funnels through these props.
  const withSound = <Args extends unknown[]>(name: SoundName, run: (...args: Args) => void) => {
    return (...args: Args) => {
      playSound(name)
      run(...args)
    }
  }
  // Stable identity: LeftToolbar keys its keyboard-shortcut listener off this, and a fresh
  // function each render would have it re-subscribing on every one.
  const handleSetTool = useCallback(
    (tool: Tool) => {
      playSound('tool')
      setTool(tool)
    },
    [setTool],
  )

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
  const selectedPoi =
    state.selectedPoiIds.length === 1 ? (state.pointsOfInterest[state.selectedPoiIds[0]] ?? null) : null
  const selectedCompany = selectedCompanyId ? (state.companies[selectedCompanyId] ?? null) : null

  const authorityDisplayName = state.authorityName || `${state.mapName.trim() || 'Untitled Map'} Transit Authority`

  // Line selection gets its own bottom-center LED announcer (below) instead of the
  // plain text pill used for station/geo selections.
  const selectionLabel = selectedStation
    ? `Station: ${selectedStation.name}`
    : selectedPoi
      ? `Point of interest: ${selectedPoi.name}`
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
        onToggleGrid={withSound('toggle', () => setShowGrid(g => !g))}
        showTrains={showTrains}
        onToggleTrains={withSound('toggle', () => setShowTrains(t => !t))}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        theme={theme}
        onToggleTheme={withSound('toggle', toggleTheme)}
        onOpen={handleOpen}
        onExport={() => exportMapAsJson(snapshot)}
        onSurprise={handleSurprise}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <main style={{ position: 'absolute', inset: 0 }}>
          <MapCanvas
            ref={mapCanvasRef}
            tool={state.tool}
            stationList={stationList}
            lineList={lineList}
            geoFeatureList={geoFeatureList}
            poiList={poiList}
            stations={state.stations}
            selectedStationIds={state.selectedStationIds}
            selectedLineIds={state.selectedLineIds}
            selectedGeoFeatureIds={state.selectedGeoFeatureIds}
            selectedPoiIds={state.selectedPoiIds}
            selectedWaypoint={state.selectedWaypoint}
            draftLineNodes={state.draftLineNodes}
            draftGeoPoints={state.draftGeoPoints}
            showGrid={showGrid}
            showTrains={showTrains}
            viewportInsets={CANVAS_INSETS}
            onAddStation={withSound('station', addStation)}
            onMoveStations={moveStations}
            onMergeStations={withSound('lineDone', mergeStations)}
            onAppendDraftLineNode={withSound('node', appendDraftLineNode)}
            onInsertDraftLineStation={withSound('station', insertDraftLineStation)}
            onInsertLineStation={withSound('station', insertLineStation)}
            onFinishDraftLine={withSound('lineDone', finishDraftLine)}
            onCancelDraftLine={cancelDraftLine}
            onAddGeoPoint={withSound('node', addGeoPoint)}
            onAddPoi={withSound('station', (x: number, y: number, icon: string) => addPoi(x, y, icon, openMojiLabel(icon)))}
            onMovePois={movePois}
            onExitPoiTool={() => handleSetTool('select')}
            onFinishGeoFeature={withSound('lineDone', finishGeoFeature)}
            onCancelGeoFeature={cancelGeoFeature}
            onSetSelection={handleSetSelection}
            onClearSelection={handleClearSelection}
            onSelectWaypoint={selectWaypoint}
            onDeleteWaypoint={withSound('remove', deleteWaypoint)}
            onDeleteSelected={withSound('remove', deleteSelected)}
            onCheckpoint={checkpoint}
            onStationGrab={() => playSound('grab')}
            onLineReroute={() => playSound('reroute')}
            onLineSnap={() => playSound('snap')}
            onUndo={undo}
            onRedo={redo}
            onTransformChange={t => setZoom(t.k)}
          />

          <CanvasStats lineCount={lineList.length} stationCount={stationList.length} zoom={zoom} />

          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: CANVAS_INSETS.left,
              right: CANVAS_INSETS.right,
              // Click-through so the canvas underneath still gets the pointer; each child
              // that needs a pointer (buttons, the toast, the line chip) opts back in.
              pointerEvents: 'none',
            }}
          >
            {selectionLabel && <SelectionLabel label={selectionLabel} />}

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
              <div
                style={{
                  position: 'absolute',
                  top: 'var(--space-3)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'auto',
                }}
              >
                <Button variant="primary" onClick={finishDraftLine}>
                  {state.draftLineId
                    ? `Update line (${state.draftLineNodes.length} points)`
                    : `Finish line (${state.draftLineNodes.length} points)`}
                </Button>
              </div>
            )}

            {geoDraftLabel && state.draftGeoPoints.length >= geoMinPoints && (
              <div
                style={{
                  position: 'absolute',
                  top: 'var(--space-3)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'auto',
                }}
              >
                <Button variant="primary" onClick={finishGeoFeature}>
                  Finish {geoDraftLabel} ({state.draftGeoPoints.length} points)
                </Button>
              </div>
            )}

            {toast && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'var(--space-3)',
                  right: 'var(--space-3)',
                  pointerEvents: 'auto',
                }}
              >
                <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />
              </div>
            )}
          </div>
        </main>

        <LeftToolbar tool={state.tool} onSetTool={handleSetTool} theme={theme} />

        {state.tool === 'add-poi' && <PoiPicker />}

        {/* Right-hand column: the panel flexes to fill it, leaving the authority mark
            seated beneath. Click-through so the gap between them, and the canvas showing
            through beside the mark, still belong to the map. */}
        <div
          style={{
            position: 'absolute',
            top: FLOAT_GAP,
            right: FLOAT_GAP,
            bottom: FLOAT_GAP,
            width: RIGHT_PANEL_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            gap: FLOAT_GAP,
            pointerEvents: 'none',
            zIndex: 10,
            }}
        >
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
            selectedPoi={selectedPoi}
            poiList={poiList}
            selectedCompany={selectedCompany}
            onSelectLine={id => {
              playSound('tool')
              handleSetSelection([], [id], [])
              // Fly to the line only when picked from the list; a click on the canvas
              // leaves the viewport alone (the line is already where the user is looking).
              mapCanvasRef.current?.frameLine(id)
            }}
            onSelectStation={withSound('tool', (id: string) => handleSetSelection([id], [], []))}
            onSelectGeoFeature={withSound('tool', (id: string) => handleSetSelection([], [], [id]))}
            onSelectCompany={handleSelectCompany}
            onToggleLineVisibility={withSound('toggle', toggleLineVisibility)}
            onAddLine={() => handleSetTool('draw-line')}
            onAddRiver={() => handleSetTool('draw-river')}
            onAddPark={() => handleSetTool('draw-park')}
            onAddPoi={() => handleSetTool('add-poi')}
            onSelectPoi={withSound('tool', (id: string) => handleSetSelection([], [], [], [id]))}
            onRenamePoi={renamePoi}
            onSetPoiIcon={withSound('toggle', setPoiIcon)}
            onDeletePoi={withSound('remove', deletePoi)}
            onAddCompany={withSound('station', addCompany)}
            onSetAuthorityName={setAuthorityName}
            onRenameLine={renameLine}
            onSetLineNumber={setLineNumber}
            onRecolorLine={recolorLine}
            onSetLineCompany={setLineCompany}
            onExtendLine={startExtendLine}
            onDeleteLine={withSound('remove', (lineId: string, withStations: boolean) => deleteLine(lineId, withStations))}
            onRenameStation={renameStation}
            onToggleTransfer={withSound('toggle', toggleStationTransfer)}
            onToggleMain={withSound('toggle', toggleStationMain)}
            onDeleteStation={withSound('remove', deleteStation)}
            onRenameGeoFeature={renameGeoFeature}
            onExtendGeoFeature={startExtendGeoFeature}
            onDeleteGeoFeature={withSound('remove', deleteGeoFeature)}
            onRenameCompany={renameCompany}
            onSetCompanyType={setCompanyType}
            onSetCompanySymbol={withSound('toggle', setCompanySymbol)}
            onDeleteCompany={withSound('remove', deleteCompany)}
          />

          <CanvasLegend mapName={state.mapName} authorityName={state.authorityName} />
        </div>
      </div>
    </div>
  )
}

export default App
