import type { DataSnapshot } from './state/useMapState'
import type { Line, LineNode, Point, Station } from './types'
import { nextLineColor } from './lineColors'
import { GRID_SIZE } from './grid'
import { pickLineName, pickMapName, pickStationName } from './names'

const MIN_X = 200
const MAX_X = 1080
const MIN_Y = 120
const MAX_Y = 560

// Eight compass directions in circular order, so two can be chosen a known number of
// steps apart to control the angle of the bend a line makes at its hub.
const DIRECTIONS: [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
]

function snap(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Straight run of stops out from `start` along `dir`, each 1–2 cells apart, clamped in. */
function arm(start: Point, dir: [number, number], steps: number): Point[] {
  const points: Point[] = []
  let x = start.x
  let y = start.y
  for (let i = 0; i < steps; i++) {
    x = clamp(x + dir[0] * rand(1, 2) * GRID_SIZE, MIN_X, MAX_X)
    y = clamp(y + dir[1] * rand(1, 2) * GRID_SIZE, MIN_Y, MAX_Y)
    points.push({ x, y })
  }
  return points
}

/**
 * Procedurally builds a plausible little metro map. A few central interchange *hubs* are
 * placed first, then each line is routed as two straight arms that meet — and bend — at a
 * hub. Lines are handed out across the hubs (fewer hubs than lines), so at least one hub
 * carries two or more lines and the routes genuinely cross and share stations there,
 * instead of drifting past each other the way independent random walks tend to.
 */
export function buildRandomMap(): DataSnapshot {
  const byCoord = new Map<string, Station>()
  const stationOrder: string[] = []
  let nextStation = 1

  const stationAt = (rawX: number, rawY: number): Station => {
    const x = clamp(snap(rawX), MIN_X, MAX_X)
    const y = clamp(snap(rawY), MIN_Y, MAX_Y)
    const key = `${x},${y}`
    const existing = byCoord.get(key)
    if (existing) return existing
    const id = `station-${nextStation++}`
    const station: Station = { id, name: '', x, y, transfer: false, main: false }
    byCoord.set(key, station)
    stationOrder.push(id)
    return station
  }

  const lineCount = rand(3, 5)

  // A central cluster of hubs, spread a few cells apart. Fewer than the line count, so
  // some hub is always shared — that shared hub is the interchange the lines cross at.
  const anchorX = clamp(snap(rand(440, 680)), MIN_X, MAX_X)
  const anchorY = clamp(snap(rand(260, 400)), MIN_Y, MAX_Y)
  // Half as many hubs as lines (capped), so round-robin assignment always leaves every hub
  // with at least two lines. A hub holding a single line would strand it: no interchange,
  // no crossing, just a route floating on its own away from the network.
  const hubCount = Math.max(1, Math.min(3, Math.floor(lineCount / 2)))
  // No two of these offsets are collinear with any compass direction (every pairwise delta
  // has both components non-zero and |dx| != |dy|). So an arm leaving one hub can never run
  // straight down the corridor to another: same-direction arms from different hubs sit on
  // parallel-but-distinct lines and cross at most at a point, never as a duplicate route.
  const hubOffsets = shuffle<[number, number]>([
    [0, 0], [3, 1], [1, -3], [-3, 2],
  ]).slice(0, hubCount)
  const hubKeys = new Set<string>()
  const hubs: Point[] = []
  for (const [cx, cy] of hubOffsets) {
    const p = { x: clamp(anchorX + cx * GRID_SIZE, MIN_X, MAX_X), y: clamp(anchorY + cy * GRID_SIZE, MIN_Y, MAX_Y) }
    const key = `${p.x},${p.y}`
    if (hubKeys.has(key)) continue
    hubKeys.add(key)
    hubs.push(p)
  }

  // Every arm leaving a given hub takes a direction no other line has used there. Two lines
  // sharing a hub therefore cross at it and diverge, instead of setting off the same way and
  // running as a duplicate route for their whole length — which the lane fanning would
  // faithfully render as a permanent double band.
  const usedDirectionsByHub = new Map<number, Set<number>>()

  const buildLineNodes = (hub: Point, hubIndex: number): LineNode[] | null => {
    const used = usedDirectionsByHub.get(hubIndex) ?? new Set<number>()
    const free = DIRECTIONS.map((_, i) => i).filter(i => !used.has(i))
    if (free.length < 2) return null

    const a = free[rand(0, free.length - 1)]
    // Second arm 2–6 eighths around the compass: a right-angle bend up to a near-straight
    // through-route, never doubling back along the first arm.
    const spread = free.filter(i => {
      const gap = (((i - a) % DIRECTIONS.length) + DIRECTIONS.length) % DIRECTIONS.length
      return gap >= 2 && gap <= 6
    })
    const others = spread.length > 0 ? spread : free.filter(i => i !== a)
    if (others.length === 0) return null
    const b = others[rand(0, others.length - 1)]

    const sequence = [...arm(hub, DIRECTIONS[a], rand(2, 4)).reverse(), hub, ...arm(hub, DIRECTIONS[b], rand(2, 4))]
    const nodes: LineNode[] = []
    const seen = new Set<string>()
    for (const point of sequence) {
      const station = stationAt(point.x, point.y)
      if (seen.has(station.id)) continue
      seen.add(station.id)
      nodes.push({ kind: 'station', stationId: station.id })
    }
    if (seen.size < 2) return null

    used.add(a)
    used.add(b)
    usedDirectionsByHub.set(hubIndex, used)
    return nodes
  }

  const lines: Record<string, Line> = {}
  const lineOrder: string[] = []
  for (let i = 0; i < lineCount; i++) {
    const hubIndex = i % hubs.length
    let nodes: LineNode[] | null = null
    for (let attempt = 0; attempt < 6 && !nodes; attempt++) nodes = buildLineNodes(hubs[hubIndex], hubIndex)
    if (!nodes) continue
    const id = `line-${lineOrder.length + 1}`
    // Built from nothing, so the lines number straight through 1..N — no gaps to fill.
    lines[id] = { id, number: lineOrder.length + 1, name: '', color: nextLineColor(lineOrder.length), companyId: null, visible: true, nodes }
    lineOrder.push(id)
  }

  // Name everything once the geometry is settled, keeping names unique within the map.
  const byId = new Map([...byCoord.values()].map(s => [s.id, s]))
  const stations: Record<string, Station> = {}
  const stationNames = new Set<string>()
  for (const id of stationOrder) {
    const name = pickStationName(stationNames)
    stationNames.add(name)
    stations[id] = { ...byId.get(id)!, name }
  }
  const lineNames = new Set<string>()
  for (const id of lineOrder) {
    const name = pickLineName(lineNames)
    lineNames.add(name)
    lines[id].name = name
  }

  return {
    mapName: pickMapName(),
    authorityName: '',
    stations,
    stationOrder,
    lines,
    lineOrder,
    geoFeatures: {},
    geoFeatureOrder: [],
    companies: {},
    companyOrder: [],
    nextStationNumber: nextStation,
    nextLineNumber: lineOrder.length + 1,
    nextGeoFeatureNumber: 1,
    nextCompanyNumber: 1,
  }
}
