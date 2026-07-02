import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { Line, Station, Tool } from '../types'
import { nextLineColor } from '../lineColors'

interface DataSnapshot {
  mapName: string
  stations: Record<string, Station>
  stationOrder: string[]
  lines: Record<string, Line>
  lineOrder: string[]
  nextStationNumber: number
  nextLineNumber: number
}

interface MapState extends DataSnapshot {
  tool: Tool
  selectedStationIds: string[]
  selectedLineIds: string[]
  draftLineStationIds: string[]
  past: DataSnapshot[]
  future: DataSnapshot[]
}

type Action =
  | { type: 'setTool'; tool: Tool }
  | { type: 'setMapName'; name: string }
  | { type: 'addStation'; x: number; y: number }
  | { type: 'moveStations'; ids: string[]; dx: number; dy: number }
  | { type: 'renameStation'; stationId: string; name: string }
  | { type: 'toggleStationTransfer'; stationId: string }
  | { type: 'addToDraftLine'; stationId: string }
  | { type: 'finishDraftLine' }
  | { type: 'cancelDraftLine' }
  | { type: 'setSelection'; stationIds: string[]; lineIds: string[] }
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

// Actions that mutate map content get a history entry pushed before they run, so
// they're individually undoable. Ephemeral UI state (tool, selection, in-progress
// draft line) and moveStations (fired continuously during a drag — the caller
// dispatches an explicit 'checkpoint' once at drag-start instead) are excluded.
const RECORDABLE_ACTIONS = new Set<Action['type']>([
  'setMapName',
  'addStation',
  'renameStation',
  'toggleStationTransfer',
  'finishDraftLine',
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
    stations: state.stations,
    stationOrder: state.stationOrder,
    lines: state.lines,
    lineOrder: state.lineOrder,
    nextStationNumber: state.nextStationNumber,
    nextLineNumber: state.nextLineNumber,
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
  stations: {},
  stationOrder: [],
  lines: {},
  lineOrder: [],
  tool: 'select',
  selectedStationIds: [],
  selectedLineIds: [],
  draftLineStationIds: [],
  nextStationNumber: 1,
  nextLineNumber: 1,
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
    const stationIds = line.stationIds.filter(sid => !removedStationIds.has(sid))
    if (stationIds.length < 2) {
      delete nextLines[id]
      nextOrder.splice(nextOrder.indexOf(id), 1)
    } else if (stationIds.length !== line.stationIds.length) {
      nextLines[id] = { ...line, stationIds }
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
      }
    }

    case 'setTool':
      return {
        ...state,
        tool: action.tool,
        draftLineStationIds: [],
        selectedStationIds: [],
        selectedLineIds: [],
      }

    case 'setMapName':
      return { ...state, mapName: action.name }

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

    case 'addToDraftLine': {
      if (state.draftLineStationIds[state.draftLineStationIds.length - 1] === action.stationId) {
        return state
      }
      return { ...state, draftLineStationIds: [...state.draftLineStationIds, action.stationId] }
    }

    case 'finishDraftLine': {
      if (state.draftLineStationIds.length < 2) {
        return { ...state, draftLineStationIds: [] }
      }
      const id = `line-${state.nextLineNumber}`
      const line: Line = {
        id,
        name: `Line ${state.nextLineNumber}`,
        color: nextLineColor(state.lineOrder.length),
        stationIds: state.draftLineStationIds,
        visible: true,
      }
      return {
        ...state,
        lines: { ...state.lines, [id]: line },
        lineOrder: [...state.lineOrder, id],
        nextLineNumber: state.nextLineNumber + 1,
        draftLineStationIds: [],
      }
    }

    case 'cancelDraftLine':
      return { ...state, draftLineStationIds: [] }

    case 'setSelection':
      return { ...state, selectedStationIds: action.stationIds, selectedLineIds: action.lineIds }

    case 'clearSelection':
      return { ...state, selectedStationIds: [], selectedLineIds: [] }

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

      return {
        ...state,
        stations,
        stationOrder,
        lines,
        lineOrder,
        selectedStationIds: [],
        selectedLineIds: [],
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
      stations: state.stations,
      stationOrder: state.stationOrder,
      lines: state.lines,
      lineOrder: state.lineOrder,
      nextStationNumber: state.nextStationNumber,
      nextLineNumber: state.nextLineNumber,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }, [
    state.mapName,
    state.stations,
    state.stationOrder,
    state.lines,
    state.lineOrder,
    state.nextStationNumber,
    state.nextLineNumber,
  ])

  const setTool = useCallback((tool: Tool) => dispatch({ type: 'setTool', tool }), [])
  const setMapName = useCallback((name: string) => dispatch({ type: 'setMapName', name }), [])
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
  const addToDraftLine = useCallback(
    (stationId: string) => dispatch({ type: 'addToDraftLine', stationId }),
    [],
  )
  const finishDraftLine = useCallback(() => dispatch({ type: 'finishDraftLine' }), [])
  const cancelDraftLine = useCallback(() => dispatch({ type: 'cancelDraftLine' }), [])
  const setSelection = useCallback(
    (stationIds: string[], lineIds: string[] = []) => dispatch({ type: 'setSelection', stationIds, lineIds }),
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

  return {
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
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
