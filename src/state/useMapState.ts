import { useCallback, useEffect, useMemo, useReducer } from 'react'
import type { Company, CompanySymbol, CompanyType, GeoFeature, GeoFeatureType, Line, LineNode, Point, Station, Tool } from '../types'
import { COMPANY_SYMBOLS } from '../types'
import { DEFAULT_COMPANY_SYMBOL } from '../companySymbols'
import { nextLineColor } from '../lineColors'
import { isUsableLineNumber, nextFreeLineNumber } from '../lineNumber'
import { snapToGrid } from '../grid'
import { pickLineName, pickMapName, pickStationName } from '../names'
import { buildRandomMap } from '../generate'
import { exactSegmentIndex, lineHasStation, resolveLineNodes, sameNode } from '../canvas/lineNodes'

export interface DataSnapshot {
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
  /** A bare waypoint node selected on an already-selected line, by index into its
   * nodes array — lets a stray route-shaping point be targeted for deletion, which
   * stations already support but waypoints (having no id of their own) previously
   * couldn't. */
  selectedWaypoint: { lineId: string; index: number } | null
  draftLineNodes: LineNode[]
  /** Set while the draft line is extending an existing line (vs. drafting a new one). */
  draftLineId: string | null
  /** True when extending from the line's start — draftLineNodes is reversed so appends still land at its end. */
  draftLineReversed: boolean
  draftGeoPoints: Point[]
  /** Set while the draft geo feature is extending an existing river/park (vs. drafting a new one). */
  draftGeoFeatureId: string | null
  /** True when extending from the feature's start — draftGeoPoints is reversed so appends still land at its end. */
  draftGeoReversed: boolean
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
  | { type: 'setCompanySymbol'; companyId: string; symbol: CompanySymbol }
  | { type: 'deleteCompany'; companyId: string }
  | { type: 'setLineCompany'; lineId: string; companyId: string | null }
  | { type: 'addStation'; x: number; y: number }
  | { type: 'moveStations'; ids: string[]; dx: number; dy: number }
  | { type: 'mergeStations'; survivorId: string; mergedId: string }
  | { type: 'renameStation'; stationId: string; name: string }
  | { type: 'toggleStationTransfer'; stationId: string }
  | { type: 'toggleStationMain'; stationId: string }
  | { type: 'appendDraftLineNode'; node: LineNode }
  | { type: 'insertDraftLineStation'; x: number; y: number; index: number }
  | { type: 'insertLineStation'; lineId: string; x: number; y: number; index: number }
  | { type: 'startExtendLine'; lineId: string; end: 'start' | 'end' }
  | { type: 'finishDraftLine' }
  | { type: 'cancelDraftLine' }
  | { type: 'addGeoPoint'; x: number; y: number }
  | { type: 'startExtendGeoFeature'; geoFeatureId: string; end: 'start' | 'end' }
  | { type: 'finishGeoFeature' }
  | { type: 'cancelGeoFeature' }
  | { type: 'deleteGeoFeature'; geoFeatureId: string }
  | { type: 'renameGeoFeature'; geoFeatureId: string; name: string }
  | { type: 'setSelection'; stationIds: string[]; lineIds: string[]; geoFeatureIds: string[] }
  | { type: 'clearSelection' }
  | { type: 'selectWaypoint'; lineId: string; index: number }
  | { type: 'deleteWaypoint'; lineId: string; index: number }
  | { type: 'deleteSelected' }
  | { type: 'deleteLine'; lineId: string }
  | { type: 'deleteStation'; stationId: string }
  | { type: 'renameLine'; lineId: string; name: string }
  | { type: 'setLineNumber'; lineId: string; number: number }
  | { type: 'recolorLine'; lineId: string; color: string }
  | { type: 'toggleLineVisibility'; lineId: string }
  | { type: 'checkpoint' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'loadMap'; snapshot: DataSnapshot }
  | { type: 'generateMap'; snapshot: DataSnapshot }

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
  'loadMap',
  'generateMap',
  'setMapName',
  'setAuthorityName',
  'addCompany',
  'renameCompany',
  'setCompanyType',
  'setCompanySymbol',
  'deleteCompany',
  'setLineCompany',
  'addStation',
  'insertDraftLineStation',
  'insertLineStation',
  'renameStation',
  'toggleStationTransfer',
  'toggleStationMain',
  'finishDraftLine',
  'finishGeoFeature',
  'deleteGeoFeature',
  'renameGeoFeature',
  'renameLine',
  'setLineNumber',
  'recolorLine',
  'toggleLineVisibility',
  'deleteLine',
  'deleteStation',
  'deleteWaypoint',
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
  mapName: pickMapName(),
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
  selectedWaypoint: null,
  draftLineNodes: [],
  draftLineId: null,
  draftLineReversed: false,
  draftGeoPoints: [],
  draftGeoFeatureId: null,
  draftGeoReversed: false,
  nextStationNumber: 1,
  nextLineNumber: 1,
  nextGeoFeatureNumber: 1,
  nextCompanyNumber: 1,
  past: [],
  future: [],
}

const STORAGE_KEY = 'metro-line-builder:map'

/** For a save that predates a counter field: derive a safe next-id number from the highest existing id suffix. */
function deriveNextNumber(ids: string[], prefix: string): number {
  let max = 0
  const pattern = new RegExp(`^${prefix}-(\\d+)$`)
  for (const id of ids) {
    const match = id.match(pattern)
    if (match) max = Math.max(max, parseInt(match[1], 10))
  }
  return max + 1
}

/**
 * The very first "Export" shipped stations/lines as plain arrays (under a top-level
 * "name" field) instead of today's id-keyed Record + matching *Order array. Convert
 * back to a Record here so every lookup by id downstream (station-by-id, transfer
 * counting, line-node resolution, ...) works — without this, array indices leak in
 * as fake "ids" and any lookup by real id silently misses.
 */
function arrayToRecord<T extends { id: string }>(value: unknown): Record<string, T> | undefined {
  if (!Array.isArray(value)) return undefined
  const record: Record<string, T> = {}
  for (const item of value as T[]) {
    if (item && typeof item.id === 'string') record[item.id] = item
  }
  return record
}

/**
 * Backfills fields added after earlier saves (including the minimal shape produced
 * by early versions of "Export"), so both the localStorage autosave and an
 * imported/opened JSON file load through the same compatibility path.
 */
function normalizeSnapshot(parsed: DataSnapshot): DataSnapshot {
  if (!parsed.mapName) parsed.mapName = (parsed as unknown as { name?: string }).name || 'Untitled Map'
  if (parsed.authorityName === undefined) parsed.authorityName = ''
  parsed.stations = arrayToRecord<Station>(parsed.stations) ?? parsed.stations
  parsed.lines = arrayToRecord<Line>(parsed.lines) ?? parsed.lines
  parsed.geoFeatures = arrayToRecord<GeoFeature>(parsed.geoFeatures) ?? parsed.geoFeatures
  parsed.companies = arrayToRecord<Company>(parsed.companies) ?? parsed.companies
  if (!parsed.stations) parsed.stations = {}
  if (!parsed.stationOrder) parsed.stationOrder = Object.keys(parsed.stations)
  if (!parsed.lines) parsed.lines = {}
  if (!parsed.lineOrder) parsed.lineOrder = Object.keys(parsed.lines)
  if (!parsed.geoFeatures) parsed.geoFeatures = {}
  if (!parsed.geoFeatureOrder) parsed.geoFeatureOrder = Object.keys(parsed.geoFeatures)
  if (!parsed.companies) parsed.companies = {}
  if (!parsed.companyOrder) parsed.companyOrder = Object.keys(parsed.companies)

  // Line numbers postdate the first saves, so backfill whichever are missing. Walks
  // lineOrder first so they number the way the map reads, then sweeps the record itself,
  // since a line the order array forgot still has to satisfy the type. Re-deriving the
  // taken set per line is what keeps a partially-numbered save from colliding.
  for (const line of [...parsed.lineOrder.map(id => parsed.lines[id]), ...Object.values(parsed.lines)]) {
    if (line && typeof line.number !== 'number') line.number = nextFreeLineNumber(Object.values(parsed.lines))
  }

  for (const line of Object.values(parsed.lines)) {
    if (line.visible === undefined) line.visible = true
    if (line.companyId === undefined) line.companyId = null
    // Older saves stored a line as a flat station-id sequence; convert to nodes.
    const legacy = line as unknown as { stationIds?: string[] }
    if (!line.nodes && legacy.stationIds) {
      line.nodes = legacy.stationIds.map(stationId => ({ kind: 'station', stationId }))
      delete legacy.stationIds
    }
    // A save from an even older/malformed export can still leave nodes missing —
    // every renderer assumes an array, so this is the last line of defense.
    if (!Array.isArray(line.nodes)) line.nodes = []
  }

  // An *Order array can end up referencing an id that's missing from its record —
  // e.g. a manually-edited export, or a save from a version with a data-model bug.
  // Every renderer assumes `order.map(id => record[id])` always finds something, so
  // this is the one place that keeps that invariant true for every load path.
  parsed.stationOrder = parsed.stationOrder.filter(id => id in parsed.stations)
  parsed.lineOrder = parsed.lineOrder.filter(id => id in parsed.lines)
  parsed.geoFeatureOrder = parsed.geoFeatureOrder.filter(id => id in parsed.geoFeatures)
  parsed.companyOrder = parsed.companyOrder.filter(id => id in parsed.companies)

  // Symbols postdate the first saves, and an imported file can carry anything at all in the
  // field — the renderer indexes a record by it, so only a known mark is allowed through.
  for (const company of Object.values(parsed.companies)) {
    if (!COMPANY_SYMBOLS.includes(company.symbol)) company.symbol = DEFAULT_COMPANY_SYMBOL
  }

  if (!parsed.nextStationNumber) parsed.nextStationNumber = deriveNextNumber(parsed.stationOrder, 'station')
  if (!parsed.nextLineNumber) parsed.nextLineNumber = deriveNextNumber(parsed.lineOrder, 'line')
  if (!parsed.nextGeoFeatureNumber) parsed.nextGeoFeatureNumber = deriveNextNumber(parsed.geoFeatureOrder, 'geo')
  if (!parsed.nextCompanyNumber) parsed.nextCompanyNumber = deriveNextNumber(parsed.companyOrder, 'company')

  // Older saves predate grid-snapping (or predate it applying unconditionally),
  // so a station or geo point from that era can sit a few px off-grid — invisible
  // on its own, but it kinks any straight run through freshly-snapped neighbors.
  // Re-snapping on load keeps the whole map on-grid without a one-off migration step.
  for (const station of Object.values(parsed.stations)) {
    station.x = snapToGrid(station.x)
    station.y = snapToGrid(station.y)
    // Main stations postdate the first saves; nothing in an older map implies one, so the
    // only honest backfill is "not principal until someone says so".
    if (typeof station.main !== 'boolean') station.main = false
    if (typeof station.transfer !== 'boolean') station.transfer = false
  }
  for (const feature of Object.values(parsed.geoFeatures)) {
    feature.points = feature.points.map(p => ({ x: snapToGrid(p.x), y: snapToGrid(p.y) }))
  }

  return parsed
}

function loadPersisted(): DataSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return normalizeSnapshot(JSON.parse(raw) as DataSnapshot)
  } catch {
    return null
  }
}

/** Minimal shape check for an imported file — everything else normalizeSnapshot can backfill. */
function isDataSnapshotLike(value: unknown): value is DataSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.stations === 'object' && typeof candidate.lines === 'object'
}

function initState(): MapState {
  const persisted = loadPersisted()
  if (!persisted) return emptyState
  return { ...emptyState, ...persisted }
}

/**
 * Positions are always grid-snapped before a station is placed, so an exact-coordinate
 * match reliably means "this spot is already a station" — used to make drawing a line
 * across an existing station (from another line or the same one) reuse it as a shared
 * transfer point instead of stacking a duplicate station on top of it.
 */
function findStationAt(stations: Record<string, Station>, x: number, y: number): Station | undefined {
  return Object.values(stations).find(s => s.x === x && s.y === y)
}

/** Folds `mergedId` into `survivorId`: remaps every line's node references, collapses
 * any now-consecutive duplicates, drops lines that fall below 2 points, unions the
 * `transfer` flag, and removes the merged station. Shared by the drag-to-merge action
 * and by enabling "Transfer station" on a station that coincides with another one. */
function mergeStationsInState(state: MapState, survivorId: string, mergedId: string): MapState {
  const survivor = state.stations[survivorId]
  const merged = state.stations[mergedId]
  if (!survivor || !merged) return state

  const lines = { ...state.lines }
  const lineOrder = [...state.lineOrder]
  for (const id of [...lineOrder]) {
    const line = lines[id]
    const remapped = line.nodes.map(n =>
      n.kind === 'station' && n.stationId === mergedId ? ({ kind: 'station', stationId: survivorId } as const) : n,
    )
    // Collapse consecutive duplicate references the remap may have just created.
    const collapsed: LineNode[] = []
    for (const n of remapped) {
      const last = collapsed[collapsed.length - 1]
      if (last && sameNode(last, n)) continue
      collapsed.push(n)
    }
    if (collapsed.length < 2) {
      delete lines[id]
      lineOrder.splice(lineOrder.indexOf(id), 1)
    } else {
      lines[id] = { ...line, nodes: collapsed }
    }
  }

  const stations = { ...state.stations }
  delete stations[mergedId]
  // Both flags union: folding a station away shouldn't quietly demote whichever of the two
  // the map-maker had marked, and the survivor is the same place on the map either way.
  stations[survivorId] = {
    ...survivor,
    transfer: survivor.transfer || merged.transfer,
    main: survivor.main || merged.main,
  }

  return {
    ...state,
    stations,
    stationOrder: state.stationOrder.filter(id => id !== mergedId),
    lines,
    lineOrder,
    selectedStationIds: Array.from(new Set(state.selectedStationIds.map(id => (id === mergedId ? survivorId : id)))),
  }
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
        selectedWaypoint: null,
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
        selectedWaypoint: null,
      }
    }

    case 'loadMap':
    case 'generateMap':
      return {
        ...state,
        ...action.snapshot,
        tool: 'select',
        selectedStationIds: [],
        selectedLineIds: [],
        selectedGeoFeatureIds: [],
        selectedWaypoint: null,
        draftLineNodes: [],
        draftLineId: null,
        draftGeoPoints: [],
        draftGeoFeatureId: null,
        draftGeoReversed: false,
      }

    case 'setTool':
      return {
        ...state,
        tool: action.tool,
        draftLineNodes: [],
        draftLineId: null,
        draftLineReversed: false,
        draftGeoPoints: [],
        draftGeoFeatureId: null,
        draftGeoReversed: false,
        selectedStationIds: [],
        selectedLineIds: [],
        selectedGeoFeatureIds: [],
        selectedWaypoint: null,
      }

    case 'setMapName':
      return { ...state, mapName: action.name }

    case 'setAuthorityName':
      return { ...state, authorityName: action.name }

    case 'addCompany': {
      const id = `company-${state.nextCompanyNumber}`
      const company: Company = { id, name: `Company ${state.nextCompanyNumber}`, type: 'public', symbol: DEFAULT_COMPANY_SYMBOL }
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

    case 'setCompanySymbol': {
      const company = state.companies[action.companyId]
      if (!company) return state
      return {
        ...state,
        companies: { ...state.companies, [action.companyId]: { ...company, symbol: action.symbol } },
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
      // Clicking exactly where a station already sits would otherwise stack an
      // identical duplicate on top of it instead of doing nothing useful.
      if (findStationAt(state.stations, action.x, action.y)) return state
      const id = `station-${state.nextStationNumber}`
      const station: Station = {
        id,
        name: pickStationName(new Set(Object.values(state.stations).map(s => s.name))),
        x: action.x,
        y: action.y,
        transfer: false,
        main: false,
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

    // Not recordable on its own — fired right after a drag lands one station on top
    // of another, as part of the same gesture the caller already checkpointed at
    // drag-start, so a single undo reverts the move and the merge together.
    case 'mergeStations':
      return mergeStationsInState(state, action.survivorId, action.mergedId)

    case 'renameStation': {
      const station = state.stations[action.stationId]
      if (!station) return state
      return { ...state, stations: { ...state.stations, [action.stationId]: { ...station, name: action.name } } }
    }

    case 'toggleStationTransfer': {
      const station = state.stations[action.stationId]
      if (!station) return state
      if (station.transfer) {
        return { ...state, stations: { ...state.stations, [action.stationId]: { ...station, transfer: false } } }
      }

      // Enabling transfer on a station that sits exactly on another one — e.g. two
      // lines drawn independently that happen to coincide — merges them into one
      // shared station instead of leaving a hidden duplicate stacked underneath.
      const otherStations = { ...state.stations }
      delete otherStations[station.id]
      const coincident = findStationAt(otherStations, station.x, station.y)
      if (coincident) return mergeStationsInState(state, station.id, coincident.id)

      // Otherwise, splice this station into any other line whose path happens to
      // cross exactly through this point without already stopping here.
      let lines = state.lines
      for (const id of state.lineOrder) {
        const line = lines[id]
        if (lineHasStation(line, station.id)) continue
        const points = resolveLineNodes(line.nodes, state.stations)
        const index = exactSegmentIndex(points, station)
        if (index === -1) continue
        const nodes = [...line.nodes]
        nodes.splice(index + 1, 0, { kind: 'station', stationId: station.id })
        lines = { ...lines, [id]: { ...line, nodes } }
      }

      return { ...state, lines, stations: { ...state.stations, [action.stationId]: { ...station, transfer: true } } }
    }

    case 'toggleStationMain': {
      const station = state.stations[action.stationId]
      if (!station) return state
      // Nothing to reconcile the way transfer has to — being principal says nothing about
      // the geometry, so it can't imply a merge or pull other lines through the station.
      return { ...state, stations: { ...state.stations, [action.stationId]: { ...station, main: !station.main } } }
    }

    case 'appendDraftLineNode': {
      const last = state.draftLineNodes[state.draftLineNodes.length - 1]
      if (last && sameNode(last, action.node)) return state
      return { ...state, draftLineNodes: [...state.draftLineNodes, action.node] }
    }

    case 'insertDraftLineStation': {
      // Landing on an existing station's spot — e.g. crossing another line — makes
      // it a shared transfer point instead of stacking a duplicate on top of it.
      const existing = findStationAt(state.stations, action.x, action.y)
      const nodes = [...state.draftLineNodes]
      if (existing) {
        nodes.splice(action.index, 0, { kind: 'station', stationId: existing.id })
        return { ...state, draftLineNodes: nodes }
      }
      const id = `station-${state.nextStationNumber}`
      const station: Station = {
        id,
        name: pickStationName(new Set(Object.values(state.stations).map(s => s.name))),
        x: action.x,
        y: action.y,
        transfer: false,
        main: false,
      }
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
      // Landing on an existing station's spot — e.g. crossing another line — makes
      // it a shared transfer point instead of stacking a duplicate on top of it.
      const existing = findStationAt(state.stations, action.x, action.y)
      const nodes = [...line.nodes]
      if (existing) {
        nodes.splice(action.index, 0, { kind: 'station', stationId: existing.id })
        return { ...state, lines: { ...state.lines, [action.lineId]: { ...line, nodes } } }
      }
      const id = `station-${state.nextStationNumber}`
      const station: Station = {
        id,
        name: pickStationName(new Set(Object.values(state.stations).map(s => s.name))),
        x: action.x,
        y: action.y,
        transfer: false,
        main: false,
      }
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
      // New stations always get appended to the end of draftLineNodes, so extending
      // from the start instead reverses the working copy — the append lands on
      // what's visually the front, and finishDraftLine flips it back before saving.
      const reversed = action.end === 'start'
      return {
        ...state,
        tool: 'draw-line',
        draftLineNodes: reversed ? [...line.nodes].reverse() : [...line.nodes],
        draftLineId: action.lineId,
        draftLineReversed: reversed,
        selectedStationIds: [],
        selectedLineIds: [],
        selectedWaypoint: null,
        selectedGeoFeatureIds: [],
      }
    }

    case 'finishDraftLine': {
      if (state.draftLineNodes.length < 2) {
        return { ...state, draftLineNodes: [], draftLineId: null, draftLineReversed: false }
      }
      if (state.draftLineId) {
        const line = state.lines[state.draftLineId]
        if (!line) return { ...state, draftLineNodes: [], draftLineId: null, draftLineReversed: false }
        const nodes = state.draftLineReversed ? [...state.draftLineNodes].reverse() : state.draftLineNodes
        return {
          ...state,
          lines: { ...state.lines, [state.draftLineId]: { ...line, nodes } },
          draftLineNodes: [],
          draftLineId: null,
          draftLineReversed: false,
        }
      }
      const id = `line-${state.nextLineNumber}`
      const line: Line = {
        id,
        number: nextFreeLineNumber(Object.values(state.lines)),
        name: pickLineName(new Set(Object.values(state.lines).map(l => l.name))),
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
      return { ...state, draftLineNodes: [], draftLineId: null, draftLineReversed: false }

    case 'addGeoPoint':
      return { ...state, draftGeoPoints: [...state.draftGeoPoints, { x: action.x, y: action.y }] }

    case 'startExtendGeoFeature': {
      const feature = state.geoFeatures[action.geoFeatureId]
      if (!feature) return state
      // New points always get appended to the end of draftGeoPoints, so extending
      // from the start instead reverses the working copy — the append lands on
      // what's visually the front, and finishGeoFeature flips it back before saving.
      const reversed = action.end === 'start'
      return {
        ...state,
        tool: feature.type === 'river' ? 'draw-river' : 'draw-park',
        draftGeoPoints: reversed ? [...feature.points].reverse() : [...feature.points],
        draftGeoFeatureId: action.geoFeatureId,
        draftGeoReversed: reversed,
        selectedStationIds: [],
        selectedLineIds: [],
        selectedGeoFeatureIds: [],
        selectedWaypoint: null,
      }
    }

    case 'finishGeoFeature': {
      const type = state.tool === 'draw-river' ? 'river' : state.tool === 'draw-park' ? 'park' : null
      if (!type || state.draftGeoPoints.length < MIN_GEO_POINTS[type]) {
        return { ...state, draftGeoPoints: [], draftGeoFeatureId: null, draftGeoReversed: false }
      }
      if (state.draftGeoFeatureId) {
        const feature = state.geoFeatures[state.draftGeoFeatureId]
        if (!feature) return { ...state, draftGeoPoints: [], draftGeoFeatureId: null, draftGeoReversed: false }
        const points = state.draftGeoReversed ? [...state.draftGeoPoints].reverse() : state.draftGeoPoints
        return {
          ...state,
          geoFeatures: { ...state.geoFeatures, [state.draftGeoFeatureId]: { ...feature, points } },
          draftGeoPoints: [],
          draftGeoFeatureId: null,
          draftGeoReversed: false,
        }
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
      return { ...state, draftGeoPoints: [], draftGeoFeatureId: null, draftGeoReversed: false }

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
        selectedWaypoint: null,
      }

    case 'clearSelection':
      return { ...state, selectedStationIds: [], selectedLineIds: [], selectedGeoFeatureIds: [], selectedWaypoint: null }

    case 'selectWaypoint':
      return {
        ...state,
        selectedStationIds: [],
        selectedLineIds: [action.lineId],
        selectedGeoFeatureIds: [],
        selectedWaypoint: { lineId: action.lineId, index: action.index },
      }

    case 'deleteWaypoint': {
      const line = state.lines[action.lineId]
      if (!line) return { ...state, selectedWaypoint: null }
      const nodes = line.nodes.filter((_, i) => i !== action.index)
      if (nodes.length < 2) {
        const lines = { ...state.lines }
        delete lines[action.lineId]
        return {
          ...state,
          lines,
          lineOrder: state.lineOrder.filter(id => id !== action.lineId),
          selectedLineIds: state.selectedLineIds.filter(id => id !== action.lineId),
          selectedWaypoint: null,
        }
      }
      return {
        ...state,
        lines: { ...state.lines, [action.lineId]: { ...line, nodes } },
        selectedWaypoint: null,
      }
    }

    case 'renameLine': {
      const line = state.lines[action.lineId]
      if (!line) return state
      return { ...state, lines: { ...state.lines, [action.lineId]: { ...line, name: action.name } } }
    }

    case 'setLineNumber': {
      const line = state.lines[action.lineId]
      if (!line) return state
      // Two lines sharing a number would make every badge on the map ambiguous, so the
      // invariant is enforced here rather than trusted to the caller — the UI blocks a
      // clash before it gets this far, but a bad number must not be able to land at all.
      if (!isUsableLineNumber(action.number)) return state
      if (Object.values(state.lines).some(other => other.id !== line.id && other.number === action.number)) return state
      return { ...state, lines: { ...state.lines, [action.lineId]: { ...line, number: action.number } } }
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
        selectedWaypoint: state.selectedWaypoint?.lineId === action.lineId ? null : state.selectedWaypoint,
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
        selectedWaypoint: null,
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
  const loadMap = useCallback((raw: unknown): boolean => {
    if (!isDataSnapshotLike(raw)) return false
    dispatch({ type: 'loadMap', snapshot: normalizeSnapshot(raw) })
    return true
  }, [])
  const generateMap = useCallback(() => dispatch({ type: 'generateMap', snapshot: buildRandomMap() }), [])
  const addCompany = useCallback(() => dispatch({ type: 'addCompany' }), [])
  const renameCompany = useCallback(
    (companyId: string, name: string) => dispatch({ type: 'renameCompany', companyId, name }),
    [],
  )
  const setCompanyType = useCallback(
    (companyId: string, companyType: CompanyType) => dispatch({ type: 'setCompanyType', companyId, companyType }),
    [],
  )
  const setCompanySymbol = useCallback(
    (companyId: string, symbol: CompanySymbol) => dispatch({ type: 'setCompanySymbol', companyId, symbol }),
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
  const mergeStations = useCallback(
    (survivorId: string, mergedId: string) => dispatch({ type: 'mergeStations', survivorId, mergedId }),
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
  const toggleStationMain = useCallback((stationId: string) => dispatch({ type: 'toggleStationMain', stationId }), [])
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
  const startExtendLine = useCallback(
    (lineId: string, end: 'start' | 'end') => dispatch({ type: 'startExtendLine', lineId, end }),
    [],
  )
  const finishDraftLine = useCallback(() => dispatch({ type: 'finishDraftLine' }), [])
  const cancelDraftLine = useCallback(() => dispatch({ type: 'cancelDraftLine' }), [])
  const addGeoPoint = useCallback((x: number, y: number) => dispatch({ type: 'addGeoPoint', x, y }), [])
  const startExtendGeoFeature = useCallback(
    (geoFeatureId: string, end: 'start' | 'end') => dispatch({ type: 'startExtendGeoFeature', geoFeatureId, end }),
    [],
  )
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
  const selectWaypoint = useCallback(
    (lineId: string, index: number) => dispatch({ type: 'selectWaypoint', lineId, index }),
    [],
  )
  const deleteWaypoint = useCallback(
    (lineId: string, index: number) => dispatch({ type: 'deleteWaypoint', lineId, index }),
    [],
  )
  const deleteSelected = useCallback(() => dispatch({ type: 'deleteSelected' }), [])
  const deleteLine = useCallback((lineId: string) => dispatch({ type: 'deleteLine', lineId }), [])
  const deleteStation = useCallback((stationId: string) => dispatch({ type: 'deleteStation', stationId }), [])
  const renameLine = useCallback((lineId: string, name: string) => dispatch({ type: 'renameLine', lineId, name }), [])
  const setLineNumber = useCallback((lineId: string, number: number) => dispatch({ type: 'setLineNumber', lineId, number }), [])
  const recolorLine = useCallback((lineId: string, color: string) => dispatch({ type: 'recolorLine', lineId, color }), [])
  const toggleLineVisibility = useCallback(
    (lineId: string) => dispatch({ type: 'toggleLineVisibility', lineId }),
    [],
  )
  const checkpoint = useCallback(() => dispatch({ type: 'checkpoint' }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  // Filters out an id that doesn't resolve — normalizeSnapshot already keeps a
  // freshly-loaded *Order array in sync with its record, but this is cheap
  // insurance against every renderer's assumption that these lists never contain
  // a hole, in case some future mutation ever lets the two drift apart again.
  const stationList = useMemo(
    () => state.stationOrder.map(id => state.stations[id]).filter((s): s is Station => Boolean(s)),
    [state.stationOrder, state.stations],
  )
  const lineList = useMemo(
    () => state.lineOrder.map(id => state.lines[id]).filter((l): l is Line => Boolean(l)),
    [state.lineOrder, state.lines],
  )
  const geoFeatureList = useMemo(
    () => state.geoFeatureOrder.map(id => state.geoFeatures[id]).filter((f): f is GeoFeature => Boolean(f)),
    [state.geoFeatureOrder, state.geoFeatures],
  )
  const companyList = useMemo(
    () => state.companyOrder.map(id => state.companies[id]).filter((c): c is Company => Boolean(c)),
    [state.companyOrder, state.companies],
  )
  const snapshot: DataSnapshot = useMemo(
    () => ({
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
    }),
    [
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
    ],
  )

  return {
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
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
