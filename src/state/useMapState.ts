import { useCallback, useMemo, useReducer } from 'react'
import type { Line, Station, Tool } from '../types'
import { nextLineColor } from '../lineColors'

interface MapState {
  stations: Record<string, Station>
  stationOrder: string[]
  lines: Record<string, Line>
  lineOrder: string[]
  tool: Tool
  selectedStationIds: string[]
  selectedLineIds: string[]
  draftLineStationIds: string[]
  nextStationNumber: number
  nextLineNumber: number
}

type Action =
  | { type: 'setTool'; tool: Tool }
  | { type: 'addStation'; x: number; y: number }
  | { type: 'moveStations'; ids: string[]; dx: number; dy: number }
  | { type: 'addToDraftLine'; stationId: string }
  | { type: 'finishDraftLine' }
  | { type: 'cancelDraftLine' }
  | { type: 'setSelection'; stationIds: string[]; lineIds: string[] }
  | { type: 'clearSelection' }
  | { type: 'deleteSelected' }

const initialState: MapState = {
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
}

function reducer(state: MapState, action: Action): MapState {
  switch (action.type) {
    case 'setTool':
      return {
        ...state,
        tool: action.tool,
        draftLineStationIds: [],
        selectedStationIds: [],
        selectedLineIds: [],
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

    case 'deleteSelected': {
      const removedStationIds = new Set(state.selectedStationIds)
      const removedLineIds = new Set(state.selectedLineIds)

      const stations = { ...state.stations }
      for (const id of removedStationIds) delete stations[id]
      const stationOrder = state.stationOrder.filter(id => !removedStationIds.has(id))

      const lines = { ...state.lines }
      const lineOrder = state.lineOrder.filter(id => {
        if (removedLineIds.has(id)) {
          delete lines[id]
          return false
        }
        return true
      })

      // Drop removed stations from surviving lines; drop lines that fall below 2 stations.
      for (const id of [...lineOrder]) {
        const line = lines[id]
        const stationIds = line.stationIds.filter(sid => !removedStationIds.has(sid))
        if (stationIds.length < 2) {
          delete lines[id]
          lineOrder.splice(lineOrder.indexOf(id), 1)
        } else if (stationIds.length !== line.stationIds.length) {
          lines[id] = { ...line, stationIds }
        }
      }

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
  const [state, dispatch] = useReducer(reducer, initialState)

  const setTool = useCallback((tool: Tool) => dispatch({ type: 'setTool', tool }), [])
  const addStation = useCallback((x: number, y: number) => dispatch({ type: 'addStation', x, y }), [])
  const moveStations = useCallback(
    (ids: string[], dx: number, dy: number) => dispatch({ type: 'moveStations', ids, dx, dy }),
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

  const stationList = useMemo(() => state.stationOrder.map(id => state.stations[id]), [state.stationOrder, state.stations])
  const lineList = useMemo(() => state.lineOrder.map(id => state.lines[id]), [state.lineOrder, state.lines])

  return {
    state,
    stationList,
    lineList,
    setTool,
    addStation,
    moveStations,
    addToDraftLine,
    finishDraftLine,
    cancelDraftLine,
    setSelection,
    clearSelection,
    deleteSelected,
  }
}
