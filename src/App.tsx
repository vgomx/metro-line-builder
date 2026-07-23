import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Toast } from 'metro-ds'
import { hasSavedMap, useMapState } from './state/useMapState'
import { planJourney } from './journey'
import { MapCanvas } from './canvas/MapCanvas'
import type { MapCanvasHandle } from './canvas/MapCanvas'
import type { RideProgress } from './canvas/trainMotion'
import { TopBar } from './components/TopBar'
import { LeftToolbar, LEFT_TOOLBAR_WIDTH } from './components/LeftToolbar'
import { RightPanel, RIGHT_PANEL_WIDTH } from './components/RightPanel'
import { CanvasStats, SelectionLabel } from './components/CanvasOverlay'
import { PoiPicker } from './components/PoiPicker'
import { DraftFinishHint } from './components/DraftFinishHint'
import { WelcomeDialog } from './components/WelcomeDialog'
import { OpenMapDialog } from './components/OpenMapDialog'
import type { LibrarySummary } from './state/mapLibrary'
import {
  adoptMapId,
  currentMapId,
  forgetMap,
  loadFromLibrary,
  rememberMap,
  startNewMapId,
  summarizeLibrary,
} from './state/mapLibrary'
import { DeleteStationsDialog } from './components/DeleteStationsDialog'
import { CanvasLegend } from './components/CanvasLegend'
import { LineAnnouncer } from './components/LineAnnouncer'
import { NotificationBanner } from './components/NotificationBanner'
import { exportMapAsJson, pickMapFile } from './export'
import { exportMapAsImage } from './exportImage'
import type { ImageFormat } from './exportImage'
import { exclusiveStationIds, stationIdsOfLine } from './canvas/lineNodes'
import { geoTypeOfTool, MIN_GEO_POINTS } from './geoDraft'
import { useTheme } from './useTheme'
import { useSound } from './useSound'
import { useNotifications } from './state/useNotifications'
import { useMapNotifications } from './state/useMapNotifications'
import { useScore } from './state/useScore'
import { useScoreEvents } from './state/useScoreEvents'
import { ScoreBadge } from './components/ScoreBadge'
import { playSequence, playSound } from './sound'
import type { SoundName } from './sound'
import type { Line, LineKind, Tool } from './types'
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
/** With the panel put away, the map has that whole side back — framing and the centred canvas
 * chrome both have to know, or they keep dodging something that isn't there. */
const CANVAS_INSETS_NO_PANEL = { ...CANVAS_INSETS, right: FLOAT_GAP }

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
    clearMap,
    addCompany,
    renameCompany,
    setCompanyType,
    setCompanySymbol,
    deleteCompany,
    setLineCompany,
    addStation,
    moveStations,
    mergeStations,
    addStationToLine,
    renameStation,
    toggleStationTransfer,
    toggleStationMain,
    appendDraftLineNode,
    insertDraftLineStation,
    insertLineStation,
    startExtendLine,
    finishDraftLine,
    popDraftLineNode,
    popDraftGeoPoint,
    cancelDraftLine,
    addGeoPoint,
    startExtendGeoFeature,
    finishGeoFeature,
    cancelGeoFeature,
    deleteGeoFeature,
    renameGeoFeature,
    addPoi,
    movePois,
    moveGeoFeature,
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
    reorderLine,
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
  // Where a planned journey starts and ends. Deliberately not part of the map's own state: it
  // describes a question the reader is asking, not anything about the city, so it isn't saved,
  // isn't undoable, and doesn't belong in a snapshot.
  const [journeyFromId, setJourneyFromId] = useState<string | null>(null)
  const [journeyToId, setJourneyToId] = useState<string | null>(null)

  // The type the next drawn line will be. Set by which section's "Add" button started the draw —
  // "Add rail line" pins it to rail — and reset to metro on any tool change, so a line drawn via
  // the keyboard or toolbar (not the rail section) is metro. It lives here rather than in the map
  // because it is an intent about the next edit, not a fact about the map.
  const [pendingLineKind, setPendingLineKind] = useState<LineKind>('metro')
  // The mode the next placed station takes — chosen from the Add-station tool's picker. Its own
  // mode only shows while it has no lines; the picker just seeds that.
  const [pendingStationMode, setPendingStationMode] = useState<LineKind>('metro')

  /**
   * Whether the journey tool is up.
   *
   * The chosen stations outlive it, so coming back resumes where you left off — but the map's
   * highlight does not. A dimmed network and a glowing route with no panel explaining them is a
   * state the interface has stopped accounting for, and it reads as the map being stuck.
   */
  const planningJourney = state.tool === 'plan-journey'

  // Planned once and shared: the panel lists the itinerary and the canvas draws it, and two
  // separate calls could drift apart the moment either input changed.
  const journey = useMemo(
    () => (journeyFromId && journeyToId ? planJourney(journeyFromId, journeyToId, lineList, state.stations) : null),
    [journeyFromId, journeyToId, lineList, state.stations],
  )


  /**
   * A click on a station while the journey tool is up.
   *
   * The first sets the start, the second the end. After that a click begins again from the
   * station just clicked, which is the question a reader actually asks next — "and from here?" —
   * and saves clearing the pair by hand. Clicking the current start again clears it, so there's
   * a way to undo a misclick without leaving the tool.
   */
  const handleJourneyPick = (stationId: string) => {
    playSound('tool')
    if (stationId === journeyFromId) {
      setJourneyFromId(journeyToId)
      setJourneyToId(null)
      return
    }
    if (stationId === journeyToId) {
      setJourneyToId(null)
      return
    }
    if (!journeyFromId) setJourneyFromId(stationId)
    else if (!journeyToId) setJourneyToId(stationId)
    else {
      setJourneyFromId(stationId)
      setJourneyToId(null)
    }
  }

  const { theme, toggleTheme } = useTheme()
  const { soundEnabled, toggleSound } = useSound()
  // The Gazette: a running feed of the map's big moments (see useMapNotifications for what earns
  // a headline). `suppress` keeps a whole-map move — load, undo/redo, generate — from reading as
  // a burst of separate events.
  const notifications = useNotifications()
  const { suppress: suppressNotifications } = useMapNotifications(state, notifications.announce)
  // The Approval score rides the same event detection, but keeps its own tally and history.
  const score = useScore()
  const { suppress: suppressScore } = useScoreEvents(state, score.award)
  // Load, undo/redo and generate move the whole map at once — neither the Gazette nor the score
  // should treat that as a burst of things the user built, so both detectors are silenced first.
  const suppressEvents = useCallback(
    (reason: 'silent' | 'foundation') => {
      suppressNotifications(reason)
      suppressScore()
    },
    [suppressNotifications, suppressScore],
  )
  const handleUndo = useCallback(() => {
    suppressEvents('silent')
    undo()
  }, [undo, suppressEvents])
  const handleRedo = useCallback(() => {
    suppressEvents('silent')
    redo()
  }, [redo, suppressEvents])
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [showTrains, setShowTrains] = useState(false)
  // The line whose train the viewport is riding, plus its live position along the route, or null
  // when no ride is on. One object so the camera, the trip view, and the announcer all read the
  // same source. `trainsBeforeRide` remembers whether trains were showing, to put the toggle back.
  const [ride, setRide] = useState<RideProgress | null>(null)
  const trainsBeforeRideRef = useRef(false)
  // Open by default, except where it would cover half the map: the rail and the panel come
  // to 372px, which is most of a 768px tablet held in portrait. The toggle in the top bar is
  // the way back. The threshold is the same 900px the tablet styles use — a laptop window at
  // 1000px has room for both and shouldn't be treated as a tablet.
  const [showPanel, setShowPanel] = useState(() => typeof window === 'undefined' || window.innerWidth >= 900)
  // The palette symbol a finger is carrying. Cleared whenever the tool is put down, so it
  // can't survive into a later visit to the palette and place something unasked.
  const [armedPoi, setArmedPoi] = useState<string | null>(null)
  const [openDialog, setOpenDialog] = useState(false)
  const [exporting, setExporting] = useState(false)
  // Read fresh each time the dialog opens rather than kept in step continuously: it's a
  // dozen deserialised maps, and nothing outside the dialog looks at it.
  const [library, setLibrary] = useState<LibrarySummary[]>([])
  // Which map is on the canvas. A ref rather than state because nothing renders from it —
  // it's the key the autosave files under, and re-rendering the app to change a filing label
  // would be work for nothing.
  // Lazily, once: useRef evaluates its argument on every render, and currentMapId reads
  // localStorage — a synchronous disk read per render to answer a question that can't change.
  const mapId = useRef<string | null>(null)
  if (mapId.current === null) mapId.current = currentMapId()
  // Bumped each time a rename is asked for. A counter rather than a boolean because asking
  // twice for the same station has to focus the field twice.
  const [renameToken, setRenameToken] = useState(0)
  // Asked once, on the first visit this browser has ever had. Read at mount, before the
  // persistence effect writes anything — a beat later there would be a saved map either way.
  const [showWelcome, setShowWelcome] = useState(() => !hasSavedMap())
  // Whether there's anything on the canvas worth warning about before replacing it.
  const hasContent =
    state.stationOrder.length > 0 || state.lineOrder.length > 0 || state.geoFeatureOrder.length > 0 || state.poiOrder.length > 0
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  // Set while the Delete key is waiting on an answer about the stations its lines alone serve.
  const [pendingDelete, setPendingDelete] = useState<{ title: string; total: number; atRisk: string[] } | null>(null)

  const handleImportFile = () => {
    setOpenDialog(false)
    pickMapFile(
      data => {
        // A file is a different map from the one it replaces, whatever it's called.
        mapId.current = startNewMapId()
        suppressEvents('silent')
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
  const handleWelcomeGenerate = () => {
    setShowWelcome(false)
    playSound('generate')
    mapId.current = startNewMapId()
    suppressEvents('foundation')
    generateMap()
    // Same two frames the Surprise button waits: React has to commit the new line paths and
    // the browser has to lay out the fresh SVG before there's anything to frame.
    requestAnimationFrame(() => requestAnimationFrame(() => mapCanvasRef.current?.fitContent()))
  }

  // The library entry follows the map as it's worked on. Debounced, because this serialises
  // and re-writes the whole list, and the alternative is doing that on every dragged station.
  useEffect(() => {
    const timer = window.setTimeout(() => rememberMap(mapId.current!, snapshot), 800)
    return () => window.clearTimeout(timer)
  }, [snapshot])

  /**
   * Draw the map as a picture.
   *
   * The selection and the active tool are cleared first, and two frames are allowed to pass,
   * because both put things on the canvas that belong to the editor rather than to the map —
   * a selection ring, a half-drawn line, the placement marker. Clearing them is cheaper and
   * more honest than teaching the exporter to recognise each one.
   */
  const handleExportImage = async (format: ImageFormat) => {
    if (exporting) return
    handleClearSelection()
    handleSetTool('select')
    setExporting(true)
    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const svg = mapCanvasRef.current?.svgElement()
      if (!svg) throw new Error('The canvas has gone missing.')
      await exportMapAsImage(svg, state.mapName, format)
      setToast({ message: `Saved as ${format.toUpperCase()}.`, variant: 'success' })
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "The map couldn't be exported.",
        variant: 'error',
      })
    } finally {
      setExporting(false)
    }
  }

  const handleSurprise = () => {
    playSound('generate')
    // The city about to be replaced keeps its place in the library under its own id; the new
    // one gets a new identity, so the two are two maps rather than one map that changed.
    mapId.current = startNewMapId()
    suppressEvents('foundation')
    generateMap()
    setToast({ message: SURPRISE_LINES[Math.floor(Math.random() * SURPRISE_LINES.length)], variant: 'success' })
    // Frame the new city once React has committed the fresh line paths (two frames is
    // enough for the commit + the browser's layout of the new SVG geometry).
    requestAnimationFrame(() => requestAnimationFrame(() => mapCanvasRef.current?.fitContent()))
  }

  // Company selection lives outside the reducer's station/line/geo selection (companies
  // aren't canvas entities), so canvas selection and company selection stay mutually
  // exclusive by clearing the other side whenever one is set.
  /**
   * Delete, from the canvas. The same question the Inspector's button asks, asked here too —
   * a line deleted by keyboard leaves the same stations behind as one deleted by button, and
   * having only one of the two offer to tidy up would be arbitrary.
   *
   * Stations already in the selection are going regardless, so they're not what the question
   * is about; if nothing else is at stake, the delete just happens.
   */
  const handleDeleteSelected = () => {
    const doomed = state.selectedLineIds.map(id => state.lines[id]).filter((l): l is Line => Boolean(l))
    const surviving = lineList.filter(line => !state.selectedLineIds.includes(line.id))
    const atRisk = exclusiveStationIds(doomed, surviving).filter(id => !state.selectedStationIds.includes(id))
    if (atRisk.length === 0) {
      playSound('remove')
      deleteSelected(false)
      return
    }
    const served = new Set(doomed.flatMap(line => stationIdsOfLine(line)))
    setPendingDelete({
      title: doomed.length === 1 ? `Delete ${doomed[0].name.trim() || `Line ${doomed[0].number}`}?` : `Delete ${doomed.length} lines?`,
      total: served.size,
      atRisk: atRisk.map(id => state.stations[id]?.name ?? id),
    })
  }

  const resolvePendingDelete = (withStations: boolean) => {
    setPendingDelete(null)
    playSound('remove')
    deleteSelected(withStations)
  }

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
  // The arrival chime marks arriving at a line, not hopping between them: clicking down a list of
  // lines would otherwise machine-gun the ding-dong. So it sounds only when no line was selected
  // before this one — the first pick, not the ones that just move the selection along.
  const chimeIfEnteringLine = () => {
    if (state.selectedLineIds.length === 0) playSequence('lineSelect')
  }

  // Start riding a line's train: trains have to be on the map to be ridden, the panel has to be
  // open to show the trip, and the line has to be the selection so its Properties (the trip view)
  // are what's on screen. The ding-dong doubles as the "boarding" cue.
  const startRide = (lineId: string) => {
    playSequence('lineSelect')
    trainsBeforeRideRef.current = showTrains
    setShowTrains(true)
    setShowPanel(true)
    handleSetSelection([], [lineId], [])
    setRide({ lineId, nextStationId: null, direction: 1, atStation: false, msToNextStation: 0 })
  }
  const stopRide = useCallback(() => {
    setRide(null)
    // Leave the map as we found it: if trains weren't showing before the ride, hide them again.
    if (!trainsBeforeRideRef.current) setShowTrains(false)
  }, [])
  // Each stop the train reaches (or sets out from) updates the trip view; an arrival also rings
  // the chime, the same announcement a real platform makes.
  const handleRideProgress = useCallback((progress: RideProgress) => {
    setRide(progress)
    // A short arrival note, not the half-second lineSelect chime: stops can arrive a second apart
    // on a short hop, and the long one stacked into a drone.
    if (progress.atStation) playSound('arrive')
  }, [])
  // A ride belongs to exactly one selected line. The moment the selection moves off it — picking
  // another line, clearing, deleting the line — the ride ends rather than tracking a train the
  // panel no longer describes.
  useEffect(() => {
    if (!ride) return
    const stillRiding = state.selectedLineIds.length === 1 && state.selectedLineIds[0] === ride.lineId
    if (!stillRiding) stopRide()
  }, [ride, state.selectedLineIds, stopRide])

  /**
   * Bring the whole journey into view once it has one.
   *
   * Keyed on the pair of stations rather than on the journey object, so the camera moves when the
   * question changes and stays put otherwise — re-planning the same trip because a line was
   * recoloured shouldn't yank the map back, and neither should a re-render while someone is
   * panning around the route they just asked for.
   *
   * Only while the tool is up, and never over a ride: the ride camera is tracking a train frame by
   * frame, and two things steering the viewport at once is a fight the rider loses.
   */
  const framedJourneyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!planningJourney || !journey || ride) {
      // Forget it once the journey is gone, so coming back to the same pair frames it again.
      if (!journey) framedJourneyRef.current = null
      return
    }
    const key = `${journeyFromId}>${journeyToId}`
    if (framedJourneyRef.current === key) return
    framedJourneyRef.current = key
    const stops = journey.legs.flatMap(leg => leg.stationIds)
    // The same two frames every other framing call in this file waits for. Starting a d3
    // transition from inside a commit means its first tick lands back in React while the commit
    // is still unwinding, which showed up as an intermittent "maximum update depth" — and the
    // route's own highlight needs to be laid out before there's anything to frame anyway.
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => mapCanvasRef.current?.frameStations(stops))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [planningJourney, journey, ride, journeyFromId, journeyToId])

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
      // Putting the landmark tool down puts the symbol down with it.
      if (tool !== 'add-poi') setArmedPoi(null)
      // Entering the pen from anywhere but the rail section means a metro line; the rail section
      // overrides this straight after, so the last writer (rail) wins.
      setPendingLineKind('metro')
    },
    [setTool],
  )

  // Draw a new line of a given type: pin the pending kind, then drop into the pen. Order matters —
  // handleSetTool resets the kind to metro, so rail is set after it.
  const handleAddLine = useCallback(
    (kind: LineKind) => {
      handleSetTool('draw-line')
      setPendingLineKind(kind)
    },
    [handleSetTool],
  )

  // Finish the drawn line as whatever the pending kind is. The reducer stamps the kind and picks
  // the line's number from that kind's own 1..N.
  const handleFinishDraftLine = useCallback(() => finishDraftLine(pendingLineKind), [finishDraftLine, pendingLineKind])

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

  const insets = showPanel ? CANVAS_INSETS : CANVAS_INSETS_NO_PANEL

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

  /**
   * What the drawing tool in hand is drafting, or null if it isn't one. Both kinds answer the
   * same four questions — how to start, how many points before it's finishable, what the
   * button says, and what finishing calls — so the chrome asks them once rather than existing
   * twice with rivers and parks getting the poorer half.
   */
  const geoType = geoTypeOfTool(state.tool)
  const draft =
    state.tool === 'draw-line'
      ? {
          points: state.draftLineNodes.length,
          minimum: 2,
          startHint: 'Click a station or the canvas to start drawing a line · Esc to put the pen down',
          finishLabel: state.draftLineId
            ? `Update line (${state.draftLineNodes.length} points)`
            : `Finish line (${state.draftLineNodes.length} points)`,
          onFinish: handleFinishDraftLine,
        }
      : geoType
        ? {
            points: state.draftGeoPoints.length,
            minimum: MIN_GEO_POINTS[geoType],
            startHint: `Click the canvas to start drawing a ${geoType} · Esc to put the pen down`,
            finishLabel: `Finish ${geoType} (${state.draftGeoPoints.length} points)`,
            onFinish: finishGeoFeature,
          }
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
        onToggleGrid={withSound('toggle', () => setShowGrid(g => !g))}
        showTrains={showTrains}
        onToggleTrains={withSound('toggle', () => setShowTrains(t => !t))}
        showPanel={showPanel}
        onTogglePanel={withSound('toggle', () => setShowPanel(p => !p))}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        theme={theme}
        onToggleTheme={withSound('toggle', toggleTheme)}
        onOpen={() => {
          setLibrary(summarizeLibrary())
          setOpenDialog(true)
        }}
        onExport={() => exportMapAsJson(snapshot)}
        onExportImage={handleExportImage}
        exporting={exporting}
        onSurprise={handleSurprise}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        notifications={notifications}
      />

      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
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
            viewportInsets={insets}
            onAddStation={withSound('station', (x: number, y: number) => addStation(x, y, pendingStationMode))}
            onMoveStations={moveStations}
            onMergeStations={withSound('lineDone', mergeStations)}
            onAppendDraftLineNode={withSound('node', appendDraftLineNode)}
            onInsertDraftLineStation={withSound('station', insertDraftLineStation)}
            onInsertLineStation={withSound('station', insertLineStation)}
            onFinishDraftLine={withSound('lineDone', handleFinishDraftLine)}
            onPopDraftPoint={withSound('remove', () => (state.draftLineNodes.length > 0 ? popDraftLineNode() : popDraftGeoPoint()))}
            onCancelDraftLine={cancelDraftLine}
            onAddGeoPoint={withSound('node', addGeoPoint)}
            onAddPoi={(x: number, y: number, icon: string) => addPoi(x, y, icon, openMojiLabel(icon))}
            armedPoiIcon={armedPoi}
            onPoiLand={() => playSound('drop')}
            onMovePois={movePois}
            onMoveGeoFeature={moveGeoFeature}
            journeyFromId={planningJourney ? journeyFromId : null}
            journeyToId={planningJourney ? journeyToId : null}
            onJourneyPick={handleJourneyPick}
            journeyLegs={planningJourney ? journey?.legs ?? null : null}
            onReturnToSelect={() => handleSetTool('select')}
            onFinishGeoFeature={withSound('lineDone', finishGeoFeature)}
            onCancelGeoFeature={cancelGeoFeature}
            onSetSelection={handleSetSelection}
            onClearSelection={handleClearSelection}
            onSelectWaypoint={selectWaypoint}
            onDeleteWaypoint={withSound('remove', deleteWaypoint)}
            onDeleteSelected={handleDeleteSelected}
            onRenameRequest={(kind, id) => {
              if (kind === 'station') handleSetSelection([id], [], [])
              else if (kind === 'poi') handleSetSelection([], [], [], [id])
              else handleSetSelection([], [], [id])
              // The field can't be typed into behind a closed panel, so asking to rename
              // opens it.
              setShowPanel(true)
              setRenameToken(t => t + 1)
            }}
            onCheckpoint={checkpoint}
            onStationGrab={() => playSound('grab')}
            onLineReroute={() => playSound('reroute')}
            onLineSnap={() => playSound('snap')}
            onLineSelected={chimeIfEnteringLine}
            onDetent={() => playSound('detent')}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onTransformChange={t => setZoom(t.k)}
            ridingLineId={ride?.lineId ?? null}
            onRideLine={startRide}
            onStopRide={stopRide}
            onRideProgress={handleRideProgress}
          />

          {/* The authority mark sits at the foot of the left edge now — it reads as the map's
              own nameplate, so it lives with the map rather than under the panel. */}
          <div style={{ position: 'absolute', bottom: 'var(--space-3)', left: 'var(--space-3)', pointerEvents: 'none', zIndex: 10 }}>
            <CanvasLegend mapName={state.mapName} authorityName={state.authorityName} />
          </div>

          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: insets.left,
              right: insets.right,
              // Click-through so the canvas underneath still gets the pointer; each child
              // that needs a pointer (buttons, the toast, the line chip) opts back in.
              pointerEvents: 'none',
            }}
          >
            <NotificationBanner items={notifications.bannerItems} cityName={state.mapName} onDismiss={notifications.dismiss} />

            {selectionLabel && <SelectionLabel label={selectionLabel} />}

            {selectedLine && (
              <LineAnnouncer
                key={selectedLine.id}
                line={selectedLine}
                riding={ride?.lineId === selectedLine.id}
                onStopRide={stopRide}
                scrollText={(() => {
                  const ids = stationIdsOfLine(selectedLine)
                  // Like a real destination sign, the LED shows where this service is bound, not
                  // the next stop — so it holds steady the whole ride and only re-scrolls when the
                  // train reverses at a terminus and its destination genuinely changes. (The live
                  // next-stop lives in the trip view.) Rewriting it per departure made the marquee
                  // blank and restart at every station.
                  const riding = ride?.lineId === selectedLine.id
                  const terminusId = riding && ride.direction === -1 ? ids[0] : ids[ids.length - 1]
                  const terminus = terminusId ? state.stations[terminusId]?.name : null
                  return terminus ? `${selectedLine.name}  •  TO ${terminus}` : selectedLine.name
                })()}
              />
            )}

            {/* Everything the line-drawing tool has to say, stacked in one column so the
                button and the hint beneath it can't land on top of each other. */}
            {/* Everything a drawing tool has to say, in one column so the button and the
                hints beneath it can't land on top of each other. Lines and geography share it:
                they are drawn the same way, finished the same way, and were equally silent
                about both. */}
            {draft && (
              <div
                style={{
                  position: 'absolute',
                  top: 'var(--space-3)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--gap-sm)',
                }}
              >
                {draft.points === 0 && (
                  <div
                    style={{
                      background: 'var(--ink-900)',
                      color: 'var(--ink-0)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '5px 12px',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {draft.startHint}
                  </div>
                )}

                {draft.points >= draft.minimum && (
                  <div style={{ pointerEvents: 'auto' }}>
                    <Button variant="primary" onClick={draft.onFinish}>
                      {draft.finishLabel}
                    </Button>
                  </div>
                )}

                <DraftFinishHint active={draft.points >= draft.minimum} />
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

        {pendingDelete && (
          <DeleteStationsDialog
            open
            title={pendingDelete.title}
            totalStationCount={pendingDelete.total}
            atRisk={pendingDelete.atRisk}
            onCancel={() => setPendingDelete(null)}
            onKeep={() => resolvePendingDelete(false)}
            onDeleteAll={() => resolvePendingDelete(true)}
          />
        )}

        <OpenMapDialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          maps={library}
          currentId={mapId.current}
          onOpenMap={id => {
            const saved = loadFromLibrary(id)
            if (!saved) {
              setToast({ message: "That map isn't on this device any more.", variant: 'error' })
              return
            }
            setOpenDialog(false)
            // The map being left is already filed under its own id by the effect above, so
            // switching is only a matter of adopting the other one's.
            adoptMapId(id)
            mapId.current = id
            suppressEvents('silent')
            loadMap(saved)
            requestAnimationFrame(() => requestAnimationFrame(() => mapCanvasRef.current?.fitContent()))
          }}
          onForgetMap={id => {
            forgetMap(id)
            setLibrary(summarizeLibrary())
          }}
          onImportFile={handleImportFile}
        />

        <WelcomeDialog
          open={showWelcome}
          theme={theme}
          // On first run the canvas underneath is already blank, so "blank canvas" only has
          // to get out of the way. Reopened over a finished map it has to mean it — otherwise
          // the slot that says "empty grid" would quietly do nothing.
          returning={hasContent}
          onDismiss={() => setShowWelcome(false)}
          onGenerate={handleWelcomeGenerate}
          onBlank={() => {
            setShowWelcome(false)
            if (hasContent) {
              suppressEvents('silent')
              clearMap()
            }
          }}
        />

        <LeftToolbar
          tool={state.tool}
          onSetTool={handleSetTool}
          lineKind={pendingLineKind}
          onLineKind={setPendingLineKind}
          stationMode={pendingStationMode}
          onStationMode={setPendingStationMode}
          theme={theme}
          onStartOver={() => setShowWelcome(true)}
        />

        {state.tool === 'add-poi' && (
          <PoiPicker
            scale={zoom}
            armedIcon={armedPoi}
            onArm={setArmedPoi}
            onPlacementBegin={icon => mapCanvasRef.current?.beginPoiPreview(icon)}
            onPlacementMove={(x, y, over) =>
              over ? mapCanvasRef.current?.movePoiPreview(x, y) : mapCanvasRef.current?.hidePoiPreview()
            }
            onPlacementEnd={(icon, x, y, over) => {
              if (over) mapCanvasRef.current?.dropPoiAtClient(icon, x, y)
              mapCanvasRef.current?.endPoiPreview()
            }}
            onPlaceByKeyboard={icon => {
              const centre = mapCanvasRef.current?.viewportCentre()
              if (!centre) return
              playSound('drop')
              addPoi(centre.x, centre.y, icon, openMojiLabel(icon))
            }}
          />
        )}

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
            // Bottom-aligned so the authority mark keeps its corner when the panel is put
            // away. With the panel there it flexes to fill and this changes nothing.
            justifyContent: 'flex-end',
            gap: FLOAT_GAP,
            pointerEvents: 'none',
            zIndex: 10,
            }}
        >
          {/* Kept mounted whether it's shown or not, because something has to be on screen to
              slide off it — a panel that unmounts can only vanish. It travels its own width
              plus the margin it floats by, which puts it fully past the right edge.

              The authority mark below doesn't move with it: it reads as part of the map
              rather than as chrome on top, and putting the panel away is a request to see the
              map. */}
          <div
            className="mlb-panel-slide"
            data-open={showPanel}
            aria-hidden={!showPanel}
            style={{ flex: 1, minHeight: 0, display: 'flex', pointerEvents: showPanel ? 'auto' : 'none' }}
          >
            <RightPanel
              journeyMode={planningJourney}
              journeyFromId={journeyFromId}
              journeyToId={journeyToId}
              onSetJourneyFrom={setJourneyFromId}
              onSetJourneyTo={setJourneyToId}
              onSwapJourney={() => {
                setJourneyFromId(journeyToId)
                setJourneyToId(journeyFromId)
              }}
              onExitJourney={() => handleSetTool('select')}
              journey={journey}
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
              ride={ride}
              onRideLine={startRide}
              onStopRide={stopRide}
              onSelectLine={id => {
                chimeIfEnteringLine()
                handleSetSelection([], [id], [])
                // Fly to the line only when picked from the list; a click on the canvas
                // leaves the viewport alone (the line is already where the user is looking).
                mapCanvasRef.current?.frameLine(id)
              }}
              onSelectStation={withSound('tool', (id: string) => handleSetSelection([id], [], []))}
              onSelectGeoFeature={withSound('tool', (id: string) => handleSetSelection([], [], [id]))}
              onSelectCompany={handleSelectCompany}
              onReorderLine={reorderLine}
              onToggleLineVisibility={withSound('toggle', toggleLineVisibility)}
              onAddLine={handleAddLine}
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
              focusNameToken={renameToken}
            onAddStationToLine={withSound('lineDone', addStationToLine)}
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
          </div>

          {/* Beneath the panel: the score badge on the left, the map stats on the right, kept
              inside the panel's own width. The badge never gives (it's the score); if a long
              tally leaves no room, the stats is what yields, rather than the row spilling over
              the map. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--gap-sm)', minWidth: 0, pointerEvents: 'none' }}>
            <ScoreBadge api={score} />
            <CanvasStats lineCount={lineList.length} stationCount={stationList.length} zoom={zoom} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
