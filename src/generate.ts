import type { DataSnapshot } from './state/useMapState'
import type { GeoFeature, Line, LineNode, Point, PointOfInterest, Station } from './types'
import { nextLineColor } from './lineColors'
import { GRID_SIZE, POI_GRID_SIZE } from './grid'
import { buildVertices } from './canvas/routing'
import { distanceToOutline, insidePolygon } from './canvas/polygon'
import { pickLineName, pickMapName, pickStationName } from './names'

const MIN_X = 160
const MAX_X = 1120
const MIN_Y = 100
const MAX_Y = 600

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

/** Straight run of stops out from `start` along `dir`, each 2–3 cells apart, clamped in. */
function arm(start: Point, dir: [number, number], steps: number): Point[] {
  const points: Point[] = []
  let x = start.x
  let y = start.y
  for (let i = 0; i < steps; i++) {
    x = clamp(x + dir[0] * rand(2, 3) * GRID_SIZE, MIN_X, MAX_X)
    y = clamp(y + dir[1] * rand(2, 3) * GRID_SIZE, MIN_Y, MAX_Y)
    points.push({ x, y })
  }
  return points
}


/**
 * What a generated city can have standing in it, beyond its network. A short curated list
 * rather than the whole palette: these are the things a transit map actually bothers to mark,
 * and picking from 141 symbols at random would put a scooter and a canoe in the civic centre.
 */
const POI_KINDS: { icon: string; name: string }[] = [
  { icon: '1F3DB', name: 'Museum' },
  { icon: '1F3DF', name: 'Stadium' },
  { icon: '1F3E5', name: 'Hospital' },
  { icon: '1F3EB', name: 'University' },
  { icon: '26EA', name: 'Cathedral' },
  { icon: '26F2', name: 'Fountain' },
  { icon: '1F3AA', name: 'Fairground' },
  { icon: '1F3E2', name: 'Exchange' },
  { icon: 'mlb-obelisk', name: 'Obelisk' },
  { icon: 'mlb-monument', name: 'Monument' },
  { icon: 'mlb-old-tower', name: 'Old tower' },
  { icon: 'mlb-statue', name: 'Statue' },
]

/**
 * Clearances, in world units, and the reason each one is the size it is.
 *
 * A station is a 13-unit marker wearing a name card that reaches further, so a landmark needs
 * more room from a station than its own 26-unit tile suggests. Two landmarks need less, having
 * only their own labels to keep apart. A line needs enough that the symbol reads as standing
 * beside the route rather than blocking it.
 */
const POI_CLEAR_OF_STATION = 58
const POI_CLEAR_OF_POI = 70
const POI_CLEAR_OF_LINE = 26
/** ...and no further than this from one. Clearances alone push landmarks into the empty
 * quarters of the map, where a hospital sitting by itself in a field reads as a mistake
 * rather than as a city. A landmark belongs near the network it is reached from — within a
 * couple of blocks of a platform, not a hike. */
const POI_NEAR_STATION_MAX = 110
/** Landmarks stay out of the parks too. A monument standing in a green field looks placed by
 * accident, and its label has to fight the park's own. */
const POI_CLEAR_OF_PARK = 20
const PARK_CLEAR_OF_STATION = 28
/** A park belongs to the city, so it stays close to the network rather than sitting out in
 * the margins. Tightened from a distance that let parks drift a good three cells clear of the
 * nearest platform, which read as a field the city happened to be next to. */
const PARK_NEAR_STATION_MAX = 96
/** Parks that share an edge read as one bigger park, so they're kept a cell apart. */
const PARK_CLEAR_OF_PARK = GRID_SIZE
/** And out of the water. Parks used to be placed without any regard for the river, so a
 * third of maps had a green sitting in the middle of the blue. The river is drawn wide, so
 * this is its half-width plus a gap to read across. */
const PARK_CLEAR_OF_RIVER = 26
/** A river is drawn wide, and a station standing in one looks like a mistake rather than a
 * bridge. Half the river's width plus the station's marker, plus room to read between them. */
const RIVER_CLEAR_OF_STATION = 22

function distanceToSegment(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** How far a point is from the nearest of a line's routed segments — the drawn path, elbows
 * and all, not the straight chord between stops. */
function distanceToRoute(route: Point[], p: Point): number {
  let best = Infinity
  for (let i = 0; i < route.length - 1; i++) {
    best = Math.min(best, distanceToSegment(route[i], route[i + 1], p))
  }
  return best
}

/**
 * Whether a park's outline stays clear of the river.
 *
 * Three ways they can touch, all checked: the river running through the park (a river vertex
 * inside the outline), a corner of the park reaching into the river (a park vertex too near
 * the river's course), or the river skimming an edge of the park between its own vertices (a
 * river vertex too near the outline). Cheap, and the river is a five-point line so none of
 * the loops are large.
 */
function parkClearsRiver(park: Point[], river: Point[], clearance: number): boolean {
  for (const v of river) if (insidePolygon(park, v)) return false
  for (const v of park) if (distanceToRoute(river, v) < clearance) return false
  for (const v of river) if (distanceToOutline(park, v) < clearance) return false
  return true
}

/** The convex hull of a set of points (Andrew's monotone chain), used as the network's
 * footprint — the shape a landmark has to fall inside to read as standing within the city
 * rather than out past its edge. */
function convexHull(input: Point[]): Point[] {
  const pts = [...new Map(input.map(p => [`${p.x},${p.y}`, p])).values()].sort((a, b) => a.x - b.x || a.y - b.y)
  if (pts.length < 3) return pts
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const half = (source: Point[]) => {
    const out: Point[] = []
    for (const p of source) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  return [...half(pts), ...half([...pts].reverse())]
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
  const hubOfLine = new Map<string, number>()
  for (let i = 0; i < lineCount; i++) {
    const hubIndex = i % hubs.length
    let nodes: LineNode[] | null = null
    for (let attempt = 0; attempt < 6 && !nodes; attempt++) nodes = buildLineNodes(hubs[hubIndex], hubIndex)
    if (!nodes) continue
    const id = `line-${lineOrder.length + 1}`
    // The stamp keeps them in generation order under a "Created" sort, and ahead of anything
    // drawn afterwards (a later Date.now()). Number and mode are settled once every line exists,
    // since numbering now runs per mode.
    lines[id] = { id, number: 0, name: '', color: nextLineColor(lineOrder.length), companyId: null, visible: true, nodes, createdAt: Date.now() + lineOrder.length }
    lineOrder.push(id)
    hubOfLine.set(id, hubIndex)
  }

  // Modes: a city built from nothing is mostly metro, with a rail line or two threaded through it.
  // A hub two lines cross at becomes a modal interchange the moment one of them is rail — which is
  // where the mode glyphs earn their place — so a shared hub is seeded rail first and one of its
  // other lines held back as metro, guaranteeing the crossing is metro-meets-rail. The rest of the
  // rail quota is filled from anywhere, always leaving metro the majority.
  const railIds = new Set<string>()
  const railQuota = lineOrder.length <= 1 ? 0 : Math.min(lineOrder.length - 1, Math.max(1, Math.round(lineOrder.length * 0.3)))
  if (railQuota > 0) {
    const byHub = new Map<number, string[]>()
    for (const id of lineOrder) {
      const h = hubOfLine.get(id)!
      const bucket = byHub.get(h)
      if (bucket) bucket.push(id)
      else byHub.set(h, [id])
    }
    const sharedHub = [...byHub.values()].find(ids => ids.length >= 2)
    const protectedMetro = sharedHub?.[1]
    if (sharedHub) railIds.add(sharedHub[0])
    for (const id of shuffle([...lineOrder])) {
      if (railIds.size >= railQuota) break
      if (id === protectedMetro) continue
      railIds.add(id)
    }
  }

  // Number per mode: metro 1..N, rail 1..N, each filling its own sequence. Metro keeps no `kind`
  // field, holding to the absent-means-metro convention the rest of the app reads by.
  let metroNumber = 0
  let railNumber = 0
  for (const id of lineOrder) {
    if (railIds.has(id)) {
      lines[id].kind = 'rail'
      lines[id].number = ++railNumber
    } else {
      lines[id].number = ++metroNumber
    }
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

  // Make the busiest metro-meets-rail crossing a principal station, so a generated map arrives
  // showing the mode glyphs it now has the vocabulary for — the one place they'd appear. Read off
  // the line nodes rather than hub coordinates, which is what the renderer itself derives modes
  // from, so this can't disagree with where the glyphs actually land.
  const modesAtStation = new Map<string, Set<string>>()
  const linesAtStation = new Map<string, number>()
  for (const id of lineOrder) {
    const mode = railIds.has(id) ? 'rail' : 'metro'
    const seen = new Set<string>()
    for (const node of lines[id].nodes) {
      if (node.kind !== 'station' || seen.has(node.stationId)) continue
      seen.add(node.stationId)
      const modes = modesAtStation.get(node.stationId) ?? new Set<string>()
      modes.add(mode)
      modesAtStation.set(node.stationId, modes)
      linesAtStation.set(node.stationId, (linesAtStation.get(node.stationId) ?? 0) + 1)
    }
  }
  let modalMainId: string | undefined
  let busiest = 0
  for (const [sid, modes] of modesAtStation) {
    const count = linesAtStation.get(sid) ?? 0
    if (modes.size >= 2 && count > busiest) {
      busiest = count
      modalMainId = sid
    }
  }
  if (modalMainId && stations[modalMainId]) stations[modalMainId].main = true


  // Everything above is the network. What follows is the city it runs through: a river, a
  // park or two, and a handful of landmarks — placed by proposing spots and rejecting the
  // ones that would crowd something, because a generated map is only convincing while it
  // still reads at a glance.
  const routes = lineOrder.map(id =>
    buildVertices(
      lines[id].nodes
        .map(node => (node.kind === 'station' ? byCoord.get(`${stations[node.stationId].x},${stations[node.stationId].y}`) : null))
        .filter((st): st is Station => Boolean(st))
        .map(st => ({ x: st.x, y: st.y })),
      false,
    ),
  )
  const placedStations = Object.values(stations)

  const geoFeatures: Record<string, GeoFeature> = {}
  const geoFeatureOrder: string[] = []
  let nextGeo = 1

  // One river, crossing the whole map so it reads as geography rather than a puddle. It runs
  // corner to corner on the long axis with the middle points wandering, and it is allowed to
  // cross the network freely — a line bridging a river is what transit maps look like.
  //
  // Its course is chosen rather than drawn once: a river laid down blind runs straight through
  // stations often enough to matter — measured at roughly two and a half per map — and a stop
  // standing in the water reads as a bug, not as a waterfront. Several courses are proposed
  // and the one that keeps furthest from the network wins, which costs nothing and turns a
  // frequent embarrassment into a rarity.
  const proposeRiver = (): Point[] => {
    const vertical = Math.random() < 0.5
    // Where the river enters and where it leaves, as fractions across the perpendicular axis.
    // Both are drawn from nearly the whole width rather than a fixed middle band: the network
    // sits in the centre, so a course that is always made to cross the middle has nowhere to
    // go, and the search had no room to find a clear one.
    const entry = 0.1 + Math.random() * 0.8
    const exit = 0.1 + Math.random() * 0.8
    const points: Point[] = []
    const steps = 4
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const across = entry + (exit - entry) * t
      const wobble = rand(-1, 1) * GRID_SIZE
      if (vertical) {
        points.push({
          x: clamp(snap(MIN_X + (MAX_X - MIN_X) * across + wobble), MIN_X - GRID_SIZE * 2, MAX_X + GRID_SIZE * 2),
          y: snap(MIN_Y - GRID_SIZE * 2 + (MAX_Y - MIN_Y + GRID_SIZE * 4) * t),
        })
      } else {
        points.push({
          x: snap(MIN_X - GRID_SIZE * 2 + (MAX_X - MIN_X + GRID_SIZE * 4) * t),
          y: clamp(snap(MIN_Y + (MAX_Y - MIN_Y) * across + wobble), MIN_Y - GRID_SIZE * 2, MAX_Y + GRID_SIZE * 2),
        })
      }
    }
    return points
  }

  // The city's centre of mass, so the river can be asked to cross it rather than merely to
  // avoid stations — which, on a network now spread wide, would push the water out to run
  // down an empty margin where it reads as unconnected to the city.
  const cityCentre = {
    x: placedStations.reduce((sum, st) => sum + st.x, 0) / placedStations.length,
    y: placedStations.reduce((sum, st) => sum + st.y, 0) / placedStations.length,
  }
  const riverClearsStations = (course: Point[]) =>
    Math.min(...placedStations.map(st => distanceToRoute(course, st))) >= RIVER_CLEAR_OF_STATION
  // Among courses that keep clear of every platform, take the one that passes closest to the
  // centre — a river that actually runs through the city. Only if none clear the platforms
  // does the search fall back to whichever keeps furthest from them.
  let riverPoints = proposeRiver()
  let bestCentral = riverClearsStations(riverPoints) ? distanceToRoute(riverPoints, cityCentre) : Infinity
  let bestClearance = Math.min(...placedStations.map(st => distanceToRoute(riverPoints, st)))
  for (let attempt = 0; attempt < 60; attempt++) {
    const candidate = proposeRiver()
    const clearance = Math.min(...placedStations.map(st => distanceToRoute(candidate, st)))
    const central = distanceToRoute(candidate, cityCentre)
    if (clearance >= RIVER_CLEAR_OF_STATION) {
      if (central < bestCentral) {
        riverPoints = candidate
        bestCentral = central
        bestClearance = clearance
      }
    } else if (bestCentral === Infinity && clearance > bestClearance) {
      // Still hunting for a clear course; keep the roomiest seen so far as the fallback.
      riverPoints = candidate
      bestClearance = clearance
    }
  }
  const riverId = `geo-${nextGeo++}`
  geoFeatures[riverId] = { id: riverId, type: 'river', name: `River ${geoFeatureOrder.length + 1}`, points: riverPoints }
  geoFeatureOrder.push(riverId)

  // Parks go where no station stands. They sit under the network, so a line crossing one is
  // fine — a stop inside one would put a name card on a green field and read as a mistake.
  //
  // Parks are grown from a centre rather than stamped as rectangles: five to seven points
  // around it at varying distances, which the closed orthogonal router turns into a stepped,
  // irregular green — a park with a shape, instead of the lawn-shaped box a rectangle gives.
  // The centre is taken from a station's neighbourhood so the park belongs to the city.
  const parkCount = rand(1, 2)
  const parkBoxes: { x0: number; y0: number; x1: number; y1: number }[] = []
  const parkOutlines: Point[][] = []
  for (let attempt = 0, made = 0; attempt < 240 && made < parkCount; attempt++) {
    const anchorStation = placedStations[rand(0, placedStations.length - 1)]
    if (!anchorStation) break
    // Kept within a couple of cells of the anchor, so the park lands in the interior pocket
    // beside a stop rather than drifting off to find open space.
    const centre = {
      x: snap(anchorStation.x + rand(-2, 2) * GRID_SIZE),
      y: snap(anchorStation.y + rand(-2, 2) * GRID_SIZE),
    }
    const corners = rand(5, 7)
    const points: Point[] = []
    for (let i = 0; i < corners; i++) {
      // Angles in order around the centre, so the outline never crosses itself, with the
      // reach varying corner to corner — that variation is the whole shape. Smaller than
      // before (was up to 3.2 cells): a garden square in the network, not a district park.
      const angle = (i / corners) * Math.PI * 2 + (Math.random() - 0.5) * 0.35
      const reach = (0.9 + Math.random() * 0.9) * GRID_SIZE
      points.push({ x: snap(centre.x + Math.cos(angle) * reach), y: snap(centre.y + Math.sin(angle) * reach) })
    }
    const box = {
      x0: Math.min(...points.map(p => p.x)),
      y0: Math.min(...points.map(p => p.y)),
      x1: Math.max(...points.map(p => p.x)),
      y1: Math.max(...points.map(p => p.y)),
    }
    if (box.x1 - box.x0 < GRID_SIZE * 1.5 || box.y1 - box.y0 < GRID_SIZE * 1.5) continue
    const nearestStation = Math.min(...placedStations.map(st => Math.hypot(st.x - centre.x, st.y - centre.y)))
    if (nearestStation > PARK_NEAR_STATION_MAX) continue
    const crowded = placedStations.some(
      st => insidePolygon(points, st) || distanceToOutline(points, st) < PARK_CLEAR_OF_STATION,
    )
    const overlapsPark = parkBoxes.some(
      p =>
        box.x0 < p.x1 + PARK_CLEAR_OF_PARK &&
        box.x1 + PARK_CLEAR_OF_PARK > p.x0 &&
        box.y0 < p.y1 + PARK_CLEAR_OF_PARK &&
        box.y1 + PARK_CLEAR_OF_PARK > p.y0,
    )
    if (crowded || overlapsPark) continue
    if (!parkClearsRiver(points, riverPoints, PARK_CLEAR_OF_RIVER)) continue
    parkBoxes.push(box)
    parkOutlines.push(points)
    const id = `geo-${nextGeo++}`
    geoFeatures[id] = { id, type: 'park', name: `Park ${parkBoxes.length}`, points }
    geoFeatureOrder.push(id)
    made++
  }

  // Landmarks: proposed on the landmark half-grid and kept only where they crowd nothing.
  // Rejection sampling rather than a formula, because "not too near a station, another
  // landmark, or a route" is easy to check and hard to solve.
  const pointsOfInterest: Record<string, PointOfInterest> = {}
  const poiOrder: string[] = []
  const kinds = shuffle(POI_KINDS)
  const poiTarget = rand(3, 5)
  const placedPois: Point[] = []
  // Proposed from inside the network's own footprint rather than the whole canvas, so a
  // landmark lands among the lines it's reached from instead of out past the last stop. The
  // footprint is the stations' bounding box; with the wider spacing above it now has interior
  // room to hold one. A small overshoot on each side lets a landmark sit just off the outer
  // edge of the network too, which still reads as part of the city.
  const bx0 = Math.min(...placedStations.map(st => st.x)) - GRID_SIZE
  const bx1 = Math.max(...placedStations.map(st => st.x)) + GRID_SIZE
  const by0 = Math.min(...placedStations.map(st => st.y)) - GRID_SIZE
  const by1 = Math.max(...placedStations.map(st => st.y)) + GRID_SIZE
  // The network's footprint, grown by a cell. A landmark has to land inside this: a bounding
  // box alone accepts its four corners, which are exactly the empty outskirts the landmarks
  // kept ending up in. The hull follows the network's real cross shape instead.
  const footprint = convexHull(placedStations.map(st => ({ x: st.x, y: st.y })))
  const footprintCentre = {
    x: footprint.reduce((sum, p) => sum + p.x, 0) / footprint.length,
    y: footprint.reduce((sum, p) => sum + p.y, 0) / footprint.length,
  }
  const grownFootprint = footprint.map(p => {
    const dx = p.x - footprintCentre.x
    const dy = p.y - footprintCentre.y
    const len = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / len) * GRID_SIZE, y: p.y + (dy / len) * GRID_SIZE }
  })
  for (let attempt = 0; attempt < 500 && poiOrder.length < poiTarget; attempt++) {
    const p = {
      x: Math.round(rand(bx0, bx1) / POI_GRID_SIZE) * POI_GRID_SIZE,
      y: Math.round(rand(by0, by1) / POI_GRID_SIZE) * POI_GRID_SIZE,
    }
    if (grownFootprint.length >= 3 && !insidePolygon(grownFootprint, p)) continue
    const toNearestStation = Math.min(...placedStations.map(st => Math.hypot(st.x - p.x, st.y - p.y)))
    if (toNearestStation < POI_CLEAR_OF_STATION) continue
    if (toNearestStation > POI_NEAR_STATION_MAX) continue
    if (placedPois.some(other => Math.hypot(other.x - p.x, other.y - p.y) < POI_CLEAR_OF_POI)) continue
    if (routes.some(route => distanceToRoute(route, p) < POI_CLEAR_OF_LINE)) continue
    if (distanceToRoute(riverPoints, p) < POI_CLEAR_OF_LINE) continue
    if (parkOutlines.some(park => insidePolygon(park, p) || distanceToOutline(park, p) < POI_CLEAR_OF_PARK)) continue
    const kind = kinds[poiOrder.length % kinds.length]
    const id = `poi-${poiOrder.length + 1}`
    pointsOfInterest[id] = { id, icon: kind.icon, name: kind.name, x: p.x, y: p.y }
    poiOrder.push(id)
    placedPois.push(p)
  }

  return {
    mapName: pickMapName(),
    authorityName: '',
    stations,
    stationOrder,
    lines,
    lineOrder,
    geoFeatures,
    geoFeatureOrder,
    pointsOfInterest,
    poiOrder,
    companies: {},
    companyOrder: [],
    nextStationNumber: nextStation,
    nextLineNumber: lineOrder.length + 1,
    nextGeoFeatureNumber: nextGeo,
    nextCompanyNumber: 1,
    nextPoiNumber: poiOrder.length + 1,
  }
}
