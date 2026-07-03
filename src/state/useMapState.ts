import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { Company, CompanyType, GeoFeature, GeoFeatureType, Line, LineNode, Point, Station, Tool } from '../types'
import { nextLineColor } from '../lineColors'
import { snapToGrid } from '../grid'
import { sameNode } from '../canvas/lineNodes'

interface DataSnapshot {
  mapName: string
  /** Custom Local Transport Authority name; empty string means it's synced to (derived from) mapName. */
  authorityName: string
  stations: Record<string, Station>
  stationOrder: string[]
  lines: Record<string, Line>
  lineOrder: string[]
  geoFeatures: Record<string, GeoFeature>
  geoFeatureOrder: string[]
  companies: Record<string, Company>
  companyOrder: string[]
  nextStationNumber: number
  nextLineNumber: number
  nextGeoFeatureNumber: number
  nextCompanyNumber: number
}

interface MapState extends DataSnapshot {
  tool: Tool
  selectedStationIds: string[]
  selectedLineIds: string[]
  selectedGeoFeatureIds: string[]
  draftLineNodes: LineNode[]
  /** Set while the draft line is extending an existing line (vs. drafting a new one). */
  draftLineId: string | null
  draftGeoPoints: Point[]
  past: DataSnapshot[]
  future: DataSnapshot[]
}

type Action =
  | { type: 'setTool'; tool: Tool }
  | { type: 'setMapName'; name: string }
  | { type: 'setAuthorityName'; name: string }
  | { type: 'addCompany' }
  | { type: 'renameCompany'; companyId: string; name: string }
  | { type: 'setCompanyType'; companyId: string; companyType: CompanyType }
  | { type: 'deleteCompany'; companyId: string }
  | { type: 'setLineCompany'; lineId: string; companyId: string | null }
  | { type: 'addStation'; x: number; y: number }
  | { type: 'moveStations'; ids: string[]; dx: number; dy: number }
  | { type: 'renameStation'; stationId: string; name: string }
  | { type: 'toggleStationTransfer'; stationId: string }
  | { type: 'appendDraftLineNode'; node: LineNode }
  | { type: 'insertDraftLineStation'; x: number; y: number; index: number }
  | { type: 'insertLineStation'; lineId: string; x: number; y: number; index: number }
  | { type: 'startExtendLine'; lineId: string }
  | { type: 'finishDraftLine' }
  | { type: 'cancelDraftLine' }
  | { type: 'addGeoPoint'; x: number; y: number }
  | { type: 'finishGeoFeature' }
  | { type: 'cancelGeoFeature' }
  | { type: 'deleteGeoFeature'; geoFeatureId: string }
  | { type: 'renameGeoFeature'; geoFeatureId: string; name: string }
  | { type: 'setSelection'; stationIds: string[]; lineIds: string[]; geoFeatureIds: string[] }
  | { type: 'clearSelection' }
  | { type: 'deleteSelected' }
  | { type: 'deleteLine'; lineId: string }
  | { type: 'deleteStation'; stationId: string }
  | { type: 'renameLine'; lineId: string; name: string }
  | { type: 'recolorLine'; lineId: string; color: string }
  | { type: 'toggleLineVisibility'; lineId: string }
  | { type: 'checkpoint' }
  | { type: 'undo' }
  | { type: 'redo' }

const MAX_HISTORY = 50

const GEO_FEATURE_LABEL: Record<GeoFeatureType, string> = {
  river: 'River',
  park: 'Park',
}

const MIN_GEO_POINTS: Record<GeoFeatureType, number> = {
  river: 2,
  park: 3,
}

// Actions that mutate map content get a history entry pushed before they run, so
// they're individually undoable. Ephemeral UI state (tool, selection, in-progress
// draft line) and moveStations (fired continuously during a drag — the caller
// dispatches an explicit 'checkpoint' once at drag-start instead) are excluded.
const RECORDABLE_ACTIONS = new Set<Action['type']>([
  'setMapName',
  'setAuthorityName',
  'addCompany',
  'renameCompany',
  'setCompanyType',
  'deleteCompany',
  'setLineCompany',
  'addStation',
  'insertDraftLineStation',
  'insertLineStation',
  'renameStation',
  'toggleStationTransfer',
  'finishDraftLine',
  'finishGeoFeature',
  'deleteGeoFeature',
  'renameGeoFeature',
  'renameLine',
  'recolorLine',
  'toggleLineVisibility',
  'deleteLine',
  'deleteStation',
  'deleteSelected',
])

function snapshotOf(state: DataSnapshot): DataSnapshot {
  return {
    mapName: state.mapName,
    authorityName: state.authorityName,
    stations: state.stations,
    stationOrder: state.stationOrder,
    lines: state.lines,
    lineOrder: state.lineOrder,
    geoFeatures: state.geoFeatures,
    geoFeatureOrder: state.geoFeatureOrder,
    companies: state.companies,
    companyOrder: state.companyOrder,
    nextStationNumber: state.nextStationNumber,
    nextLineNumber: state.nextLineNumber,
    nextGeoFeatureNumber: state.nextGeoFeatureNumber,
    nextCompanyNumber: state.nextCompanyNumber,
  }
}

function pushHistory(state: MapState): MapState {
  return {
    ...state,
    past: [...state.past, snapshotOf(state)].slice(-MAX_HISTORY),
    future: [],
  }
}

const emptyState: MapState = {
  mapName: 'Untitled Map',
  authorityName: '',
  stations: {},
  stationOrder: [],
  lines: {},
  lineOrder: [],
  geoFeatures: {},
  geoFeatureOrder: [],
  companies: {},
  companyOrder: [],
  tool: 'select',
  selectedStationIds: [],
  selectedLineIds: [],
  selectedGeoFeatureIds: [],
  draftLineNodes: [],
  draftLineId: null,
  draftGeoPoints: [],
  nextStationNumber: 1,
  nextLineNumber: 1,
  nextGeoFeatureNumber: 1,
  nextCompanyNumber: 1,
  past: [],
  future: [],
}

const STORAGE_KEY = 'metro-line-builder:map'

function loadPersisted(): DataSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DataSnapshot
    // Backfill fields added after earlier saves.
    for (const line of Object.values(parsed.lines ?? {})) {
      if (line.visible === undefined) line.visible = true
      if (line.companyId === undefined) line.companyId = null
      // Older saves stored a line as a flat station-id sequence; convert to nodes.
      const legacy = line as unknown as { stationIds?: string[] }
      if (!line.nodes && legacy.stationIds) {
        line.nodes = legacy.stationIds.map(stationId => ({ kind: 'station', stationId }))
        delete legacy.stationIds
      }
    }
    if (!parsed.geoFeatures) parsed.geoFeatures = {}
    if (!parsed.geoFeatureOrder) parsed.geoFeatureOrder = []
    if (!parsed.nextGeoFeatureNumber) parsed.nextGeoFeatureNumber = 1
    if (!parsed.companies) parsed.companies = {}
    if (!parsed.companyOrder) parsed.companyOrder = []
    if (!parsed.nextCompanyNumber) parsed.nextCompanyNumber = 1
    if (parsed.authorityName === undefined) parsed.authorityName = ''

    // Older saves predate grid-snapping (or predate it applying unconditionally),
    // so a station or geo point from that era can sit a few px off-grid — invisible
    // on its own, but it kinks any straight run through freshly-snapped neighbors.
    // Re-snapping on load keeps the whole map on-grid without a one-off migration step.
    for (const station of Object.values(parsed.stations ?? {})) {
      station.x = snapToGrid(station.x)
      station.y = snapToGrid(station.y)
    }
    for (const feature of Object.values(parsed.geoFeatures)) {
      feature.points = feature.points.map(p => ({ x: snapToGrid(p.x), y: snapToGrid(p.y) }))
    }

    return parsed
  } catch {
    return null
  }
}

function initState(): MapState {
  const persisted = loadPersisted()
  if (!persisted) return emptyState
  return { ...emptyState, ...persisted }
}

function removeStationsFromLines(
  lines: Record<string, Line>,
  lineOrder: string[],
  removedStationIds: Set<string>,
): { lines: Record<string, Line>; lineOrder: string[] } {
  const nextLines = { ...lines }
  const nextOrder = [...lineOrder]
  for (const id of [...nextOrder]) {
    const line = nextLines[id]
    const nodes = line.nodes.filter(n => n.kind !== 'station' || !removedStationIds.has(n.stationId))
    if (nodes.length < 2) {
      delete nextLines[id]
      nextOrder.splice(nextOrder.indexOf(id), 1)
    } else if (nodes.length !== line.nodes.length) {
      nextLines[id] = { ...line, nodes }
    }
  }
  return { lines: nextLines, lineOrder: nextOrder }
}

function reducer(rawState: MapState, action: Action): MapState {
  const state = RECORDABLE_ACTIONS.has(action.type) ? pushHistory(rawState) : rawState

  switch (action.type) {
    case 'checkpoint':
      return pushHistory(rawState)

    case 'undo': {
      if (state.past.length === 0) return state
      const snapshot = state.past[state.past.length - 1]
      return {
        ...state,
        ...snapshot,
        past: state.past.slice(0, -1),
        future: [...state.future, snapshotOf(state)],
        selectedStationIds: [],
        selectedLineIds: [],
        selectedGeoFeatureIds: [],
      }
    }

    case 'redo': {
      if (state.future.length === 0) return state
      const snapshot = state.future[state.future.length - 1]
      return {
        ...state,
        ...snapshot,
        past: [...state.past, snapshotOf(state)],
        future: state.future.slice(0, -1),
        selectedStationIds: [],
        selectedLineIds: [],
        selectedGeoFeatureIds: [],
      }
    }

    case 'setTool':
      return {
        ...state,
        tool: action.tool,
        draftLineNodes: [],
        draftLineId: null,
        draftGeoPoints: [],
        selectedStationIds: [],
        selectedLineIds: [],
        selectedGeoFeatureIds: [],
      }

    case 'setMapName':
      return { ...state, mapName: action.name }

    case 'setAuthorityName':
      return { ...state, authorityName: action.name }

    case 'addCompany': {
      const id = `company-${state.nextCompanyNumber}`
      const company: Company = { id, name: `Company ${state.nextCompanyNumber}`, type: 'public' }
      return {
        ...state,
        companies: { ...state.companies, [id]: company },
        companyOrder: [...state.companyOrder, id],
        nextCompanyNumber: state.nextCompanyNumber + 1,
      }
    }

    case 'renameCompany': {
      const company = state.companies[action.companyId]
      if (!company) return state
      return { ...state, companies: { ...state.companies, [action.companyId]: { ...company, name: action.name } } }
    }

    case 'setCompanyType': {
      const company = state.companies[action.companyId]
      if (!company) return state
      return {
        ...state,
        companies: { ...state.companies, [action.companyId]: { ...company, type: action.companyType } },
      }
    }

    case 'deleteCompany': {
      const companies = { ...state.companies }
      delete companies[action.companyId]
      const lines = { ...state.lines }
      for (const line of Object.values(lines)) {
        if (line.companyId === action.companyId) lines[line.id] = { ...line, companyId: null }
      }
      return {
        ...state,
        companies,
        companyOrder: state.companyOrder.filter(id => id !== action.companyId),
        lines,
      }
    }

    case 'setLineCompany': {
      const line = state.lines[action.lineId]
      if (!line) return state
      return { ...state, lines: { ...state.lines, [action.lineId]: { ...line, companyId: action.companyId } } }
    }

    case 'addStation': {
      const id = `station-${state.nextStationNumber}`
      const station: Station = {
        id,
        name: `Station ${state.nextStationNumber}`,
        x: action.x,
        y: action.y,
        transfer: false,
      }
      return {
        ...state,
        stations: { ...state.stations, [id]: station },
        stationOrder: [...state.stationOrder, id],
        nextStationNumber: state.nextStationNumber + 1,
      }
    }

    case 'moveStations': {
      const stations = { ...state.stations }
      for (const id of action.ids) {
        const s = stations[id]
        if (!s) continue
        stations[id] = { ...s, x: s.x + action.dx, y: s.y + action.dy }
      }
      return { ...state, stations }
    }

    case 'renameStation': {
      const station = state.stations[action.stationId]
      if (!station) return state
      return { ...state, stations: { ...state.stations, [action.stationId]: { ...station, name: action.name } } }
    }

    case 'toggleStationTransfer': {
      const station = state.stations[action.stationId]
      if (!station) return state
      return {
        ...state,
        stations: { ...state.stations, [action.stationId]: { ...station, transfer: !station.transfer } },
      }
    }

    case 'appendDraftLineNode': {
      const last = state.draftLineNodes[state.draftLineNodes.length - 1]
      if (last && sameNode(last, action.node)) return state
      return { ...state, draftLineNodes: [...state.draftLineNodes, action.node] }
    }

    case 'insertDraftLineStation': {
      const id = `station-${state.nextStationNumber}`
      const station: Station = {
        id,
        name: `Station ${state.nextStationNumber}`,
        x: action.x,
        y: action.y,
        transfer: false,
      }
      const nodes = [...state.draftLineNodes]
      nodes.splice(action.index, 0, { kind: 'station', stationId: id })
      return {
        ...state,
        stations: { ...state.stations, [id]: station },
        stationOrder: [...state.stationOrder, id],
        nextStationNumber: state.nextStationNumber + 1,
        draftLineNodes: nodes,
      }
    }

    case 'insertLineStation': {
      const line = state.lines[action.lineId]
      if (!line) return state
      const id = `station-${state.nextStationNumber}`
      const station: Station = {
        id,
        name: `Station ${state.nextStationNumber}`,
        x: action.x,
        y: action.y,
        transfer: false,
      }
      const nodes = [...line.nodes]
      nodes.splice(action.index, 0, { kind: 'station', stationId: id })
      return {
        ...state,
        stations: { ...state.stations, [id]: station },
        stationOrder: [...state.stationOrder, id],
        nextStationNumber: state.nextStationNumber + 1,
        lines: { ...state.lines, [action.lineId]: { ...line, nodes } },
      }
    }

    case 'startExtendLine': {
      const line = state.lines[action.lineId]
      if (!line) return state
      return {
        ...state,
        tool: 'draw-line',
        draftLineNodes: [...line.nodes],
        draftLineId: action.lineId,
        selectedStationIds: [],
        selectedLineIds: [],
        selectedGeoFeatureIds: [],
      }
    }

    case 'finishDraftLine': {
      if (state.draftLineNodes.length < 2) {
        return { ...state, draftLineNodes: [], draftLineId: null }
      }
      if (state.draftLineId) {
        const line = state.lines[state.draftLineId]
        if (!line) return { ...state, draftLineNodes: [], draftLineId: null }
        return {
          ...state,
          lines: { ...state.lines, [state.draftLineId]: { ...line, nodes: state.draftLineNodes } },
          draftLineNodes: [],
          draftLineId: null,
        }
      }
      const id = `line-${state.nextLineNumber}`
      const line: Line = {
        id,
        name: `Line ${state.nextLineNumber}`,
        color: nextLineColor(state.lineOrder.length),
        nodes: state.draftLineNodes,
        visible: true,
        companyId: null,
      }
      return {
        ...state,
        lines: { ...state.lines, [id]: line },
        lineOrder: [...state.lineOrder, id],
        nextLineNumber: state.nextLineNumber + 1,
        draftLineNodes: [],
      }
    }

    case 'cancelDraftLine':
      return { ...state, draftLineNodes: [], draftLineId: null }

    case 'addGeoPoint':
      return { ...state, draftGeoPoints: [...state.draftGeoPoints, { x: action.x, y: action.y }] }

    case 'finishGeoFeature': {
      const type = state.tool === 'draw-river' ? 'river' : state.tool === 'draw-park' ? 'park' : null
      if (!type || state.draftGeoPoints.length < MIN_GEO_POINTS[type]) {
        return { ...state, draftGeoPoints: [] }
      }
      const id = `geo-${state.nextGeoFeatureNumber}`
      const feature: GeoFeature = {
        id,
        type,
        name: `${GEO_FEATURE_LABEL[type]} ${state.nextGeoFeatureNumber}`,
        points: state.draftGeoPoints,
      }
      return {
        ...state,
        geoFeatures: { ...state.geoFeatures, [id]: feature },
        geoFeatureOrder: [...state.geoFeatureOrder, id],
        nextGeoFeatureNumber: state.nextGeoFeatureNumber + 1,
        draftGeoPoints: [],
      }
    }

    case 'cancelGeoFeature':
      return { ...state, draftGeoPoints: [] }

    case 'deleteGeoFeature': {
      const geoFeatures = { ...state.geoFeatures }
      delete geoFeatures[action.geoFeatureId]
      return {
        ...state,
        geoFeatures,
        geoFeatureOrder: state.geoFeatureOrder.filter(id => id !== action.geoFeatureId),
        selectedGeoFeatureIds: state.selectedGeoFeatureIds.filter(id => id !== action.geoFeatureId),
      }
    }

    case 'renameGeoFeature': {
      const feature = state.geoFeatures[action.geoFeatureId]
      if (!feature) return state
      return {
        ...state,
        geoFeatures: { ...state.geoFeatures, [action.geoFeatureId]: { ...feature, name: action.name } },
      }
    }

    case 'setSelection':
      return {
        ...state,
        selectedStationIds: action.stationIds,
        selectedLineIds: action.lineIds,
        selectedGeoFeatureIds: action.geoFeatureIds,
      }

    case 'clearSelection':
      return { ...state, selectedStationIds: [], selectedLineIds: [], selectedGeoFeatureIds: [] }

    case 'renameLine': {
      const line = state.lines[action.lineId]
      if (!line) return state
      return { ...state, lines: { ...state.lines, [action.lineId]: { ...line, name: action.name } } }
    }

    case 'recolorLine': {
      const line = state.lines[action.lineId]
      if (!line) return state
      return { ...state, lines: { ...state.lines, [action.lineId]: { ...line, color: action.color } } }
    }

    case 'toggleLineVisibility': {
      const line = state.lines[action.lineId]
      if (!line) return state
      return { ...state, lines: { ...state.lines, [action.lineId]: { ...line, visible: !line.visible } } }
    }

    case 'deleteLine': {
      const lines = { ...state.lines }
      delete lines[action.lineId]
      return {
        ...state,
        lines,
        lineOrder: state.lineOrder.filter(id => id !== action.lineId),
        selectedLineIds: state.selectedLineIds.filter(id => id !== action.lineId),
      }
    }

    case 'deleteStation': {
      const removed = new Set([action.stationId])
      const stations = { ...state.stations }
      delete stations[action.stationId]
      const stationOrder = state.stationOrder.filter(id => id !== action.stationId)
      const { lines, lineOrder } = removeStationsFromLines(state.lines, state.lineOrder, removed)
      return {
        ...state,
        stations,
        stationOrder,
        lines,
        lineOrder,
        selectedStationIds: state.selectedStationIds.filter(id => id !== action.stationId),
      }
    }

    case 'deleteSelected': {
      const removedStationIds = new Set(state.selectedStationIds)
      const removedLineIds = new Set(state.selectedLineIds)
      const removedGeoFeatureIds = new Set(state.selectedGeoFeatureIds)

      const stations = { ...state.stations }
      for (const id of removedStationIds) delete stations[id]
      const stationOrder = state.stationOrder.filter(id => !removedStationIds.has(id))

      const linesAfterExplicitRemoval = { ...state.lines }
      const lineOrderAfterExplicitRemoval = state.lineOrder.filter(id => {
        if (removedLineIds.has(id)) {
          delete linesAfterExplicitRemoval[id]
          return false
        }
        return true
      })

      const { lines, lineOrder } = removeStationsFromLines(
        linesAfterExplicitRemoval,
        lineOrderAfterExplicitRemoval,
        removedStationIds,
      )

      const geoFeatures = { ...state.geoFeatures }
      const geoFeatureOrder = state.geoFeatureOrder.filter(id => {
        if (removedGeoFeatureIds.has(id)) {
          delete geoFeatures[id]
          return false
        }
        return true
      })

      return {
        ...state,
        stations,
        stationOrder,
        lines,
        lineOrder,
        geoFeatures,
        geoFeatureOrder,
        selectedStationIds: [],
        selectedLineIds: [],
        selectedGeoFeatureIds: [],
      }
    }

    default:
      return state
  }
}

export function useMapState() {
  const [state, dispatch] = useReducer(reducer, undefined, initState)

  useEffect(() => {
    const snapshot: DataSnapshot = {
      mapName: state.mapName,
      authorityName: state.authorityName,
      stations: state.stations,
      stationOrder: state.stationOrder,
      lines: state.lines,
      lineOrder: state.lineOrder,
      geoFeatures: state.geoFeatures,
      geoFeatureOrder: state.geoFeatureOrder,
      companies: state.companies,
      companyOrder: state.companyOrder,
      nextStationNumber: state.nextStationNumber,
      nextLineNumber: state.nextLineNumber,
      nextGeoFeatureNumber: state.nextGeoFeatureNumber,
      nextCompanyNumber: state.nextCompanyNumber,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }, [
    state.mapName,
    state.authorityName,
    state.stations,
    state.stationOrder,
    state.lines,
    state.lineOrder,
    state.geoFeatures,
    state.geoFeatureOrder,
    state.companies,
    state.companyOrder,
    state.nextStationNumber,
    state.nextLineNumber,
    state.nextGeoFeatureNumber,
    state.nextCompanyNumber,
  ])

  const setTool = useCallback((tool: Tool) => dispatch({ type: 'setTool', tool }), [])
  const setMapName = useCallback((name: string) => dispatch({ type: 'setMapName', name }), [])
  const setAuthorityName = useCallback((name: string) => dispatch({ type: 'setAuthorityName', name }), [])
  const addCompany = useCallback(() => dispatch({ type: 'addCompany' }), [])
  const renameCompany = useCallback(
    (companyId: string, name: string) => dispatch({ type: 'renameCompany', companyId, name }),
    [],
  )
  const setCompanyType = useCallback(
    (companyId: string, companyType: CompanyType) => dispatch({ type: 'setCompanyType', companyId, companyType }),
    [],
  )
  const deleteCompany = useCallback((companyId: string) => dispatch({ type: 'deleteCompany', companyId }), [])
  const setLineCompany = useCallback(
    (lineId: string, companyId: string | null) => dispatch({ type: 'setLineCompany', lineId, companyId }),
    [],
  )
  const addStation = useCallback((x: number, y: number) => dispatch({ type: 'addStation', x, y }), [])
  const moveStations = useCallback(
    (ids: string[], dx: number, dy: number) => dispatch({ type: 'moveStations', ids, dx, dy }),
    [],
  )
  const renameStation = useCallback(
    (stationId: string, name: string) => dispatch({ type: 'renameStation', stationId, name }),
    [],
  )
  const toggleStationTransfer = useCallback(
    (stationId: string) => dispatch({ type: 'toggleStationTransfer', stationId }),
    [],
  )
  const appendDraftLineNode = useCallback(
    (node: LineNode) => dispatch({ type: 'appendDraftLineNode', node }),
    [],
  )
  const insertDraftLineStation = useCallback(
    (x: number, y: number, index: number) => dispatch({ type: 'insertDraftLineStation', x, y, index }),
    [],
  )
  const insertLineStation = useCallback(
    (lineId: string, x: number, y: number, index: number) => dispatch({ type: 'insertLineStation', lineId, x, y, index }),
    [],
  )
  const startExtendLine = useCallback((lineId: string) => dispatch({ type: 'startExtendLine', lineId }), [])
  const finishDraftLine = useCallback(() => dispatch({ type: 'finishDraftLine' }), [])
  const cancelDraftLine = useCallback(() => dispatch({ type: 'cancelDraftLine' }), [])
  const addGeoPoint = useCallback((x: number, y: number) => dispatch({ type: 'addGeoPoint', x, y }), [])
  const finishGeoFeature = useCallback(() => dispatch({ type: 'finishGeoFeature' }), [])
  const cancelGeoFeature = useCallback(() => dispatch({ type: 'cancelGeoFeature' }), [])
  const deleteGeoFeature = useCallback(
    (geoFeatureId: string) => dispatch({ type: 'deleteGeoFeature', geoFeatureId }),
    [],
  )
  const renameGeoFeature = useCallback(
    (geoFeatureId: string, name: string) => dispatch({ type: 'renameGeoFeature', geoFeatureId, name }),
    [],
  )
  const setSelection = useCallback(
    (stationIds: string[], lineIds: string[] = [], geoFeatureIds: string[] = []) =>
      dispatch({ type: 'setSelection', stationIds, lineIds, geoFeatureIds }),
    [],
  )
  const clearSelection = useCallback(() => dispatch({ type: 'clearSelection' }), [])
  const deleteSelected = useCallback(() => dispatch({ type: 'deleteSelected' }), [])
  const deleteLine = useCallback((lineId: string) => dispatch({ type: 'deleteLine', lineId }), [])
  const deleteStation = useCallback((stationId: string) => dispatch({ type: 'deleteStation', stationId }), [])
  const renameLine = useCallback((lineId: string, name: string) => dispatch({ type: 'renameLine', lineId, name }), [])
  const recolorLine = useCallback((lineId: string, color: string) => dispatch({ type: 'recolorLine', lineId, color }), [])
  const toggleLineVisibility = useCallback(
    (lineId: string) => dispatch({ type: 'toggleLineVisibility', lineId }),
    [],
  )
  const checkpoint = useCallback(() => dispatch({ type: 'checkpoint' }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  const stationList = useMemo(() => state.stationOrder.map(id => state.stations[id]), [state.stationOrder, state.stations])
  const lineList = useMemo(() => state.lineOrder.map(id => state.lines[id]), [state.lineOrder, state.lines])
  const geoFeatureList = useMemo(
    () => state.geoFeatureOrder.map(id => state.geoFeatures[id]),
    [state.geoFeatureOrder, state.geoFeatures],
  )
  const companyList = useMemo(
    () => state.companyOrder.map(id => state.companies[id]),
    [state.companyOrder, state.companies],
  )

  return {
    state,
    stationList,
    lineList,
    geoFeatureList,
    companyList,
    setTool,
    setMapName,
    setAuthorityName,
    addCompany,
    renameCompany,
    setCompanyType,
    deleteCompany,
    setLineCompany,
    addStation,
    moveStations,
    renameStation,
    toggleStationTransfer,
    appendDraftLineNode,
    insertDraftLineStation,
    insertLineStation,
    startExtendLine,
    finishDraftLine,
    cancelDraftLine,
    addGeoPoint,
    finishGeoFeature,
    cancelGeoFeature,
    deleteGeoFeature,
    renameGeoFeature,
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
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
