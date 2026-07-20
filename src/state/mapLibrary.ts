import type { DataSnapshot } from './useMapState'

const LIBRARY_KEY = 'metro-line-builder:library'
const CURRENT_ID_KEY = 'metro-line-builder:current-id'

/**
 * How many maps are kept. Twelve at roughly 10kB each is around 120kB — comfortably inside
 * the 5MB localStorage gets, with room for the current map and whatever else the app keeps.
 * The number is a judgement about a list rather than about bytes: past a dozen, "recent" has
 * stopped meaning anything and what's wanted is a file.
 */
const MAX_ENTRIES = 12

export interface LibraryEntry {
  id: string
  name: string
  /** Epoch ms of the last time this map was written. Sorts the list; nothing else reads it. */
  savedAt: number
  snapshot: DataSnapshot
}

/** Enough to draw a thumbnail and a line of description without deserialising everything. */
export interface LibrarySummary {
  id: string
  name: string
  savedAt: number
  stationCount: number
  lineCount: number
  /** Each line's colour and the points it runs through, in world coordinates. */
  routes: { color: string; points: { x: number; y: number }[] }[]
}

function readLibrary(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as LibraryEntry[]).filter(e => e && e.id && e.snapshot) : []
  } catch {
    return []
  }
}

function writeLibrary(entries: LibraryEntry[]) {
  const trimmed = entries.slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(trimmed))
  } catch {
    // Out of quota. Drop the oldest half and try once more rather than losing the write
    // entirely — the alternative is a library that silently stops recording the day it fills
    // up, which looks exactly like a library that's broken.
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(trimmed.slice(0, Math.ceil(trimmed.length / 2))))
    } catch {
      // Storage is denied outright. Nothing to be done, and nothing worth interrupting for.
    }
  }
}

export function currentMapId(): string {
  try {
    const existing = localStorage.getItem(CURRENT_ID_KEY)
    if (existing) return existing
  } catch {
    return 'map-unstored'
  }
  return startNewMapId()
}

/** Mint a fresh identity, so whatever is on the canvas from now on is a different map from
 * whatever was there before — and the old one stays in the library under its own id. */
export function startNewMapId(): string {
  const id = `map-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  try {
    localStorage.setItem(CURRENT_ID_KEY, id)
  } catch {
    // Non-fatal: the map still works, it just won't be filed.
  }
  return id
}

export function adoptMapId(id: string) {
  try {
    localStorage.setItem(CURRENT_ID_KEY, id)
  } catch {
    // As above.
  }
}

/**
 * File the current state of a map under its id, replacing whatever was there before.
 *
 * Empty maps are not recorded. A blank canvas is what every map starts as, and a list whose
 * first three entries are "Untitled, no lines" is worse than a shorter list.
 */
export function rememberMap(id: string, snapshot: DataSnapshot) {
  const hasContent =
    snapshot.stationOrder.length > 0 ||
    snapshot.lineOrder.length > 0 ||
    snapshot.geoFeatureOrder.length > 0 ||
    snapshot.poiOrder.length > 0
  if (!hasContent) return

  const entries = readLibrary().filter(entry => entry.id !== id)
  entries.unshift({ id, name: snapshot.mapName, savedAt: Date.now(), snapshot })
  writeLibrary(entries)
}

export function forgetMap(id: string) {
  writeLibrary(readLibrary().filter(entry => entry.id !== id))
}

export function loadFromLibrary(id: string): DataSnapshot | null {
  return readLibrary().find(entry => entry.id === id)?.snapshot ?? null
}

/**
 * The library as the dialog needs it: newest first, with each map's routes flattened into
 * plain polylines for the thumbnail.
 *
 * The points are the stations a line calls at, in order — not the routed geometry the canvas
 * draws. At thumbnail size the difference between a true Beck route and a straight run
 * between stops is a pixel or two, and computing the real thing for a dozen maps means
 * running the full network solver twelve times to fill a list nobody is looking at yet.
 */
export function summarizeLibrary(): LibrarySummary[] {
  return readLibrary()
    .sort((a, b) => b.savedAt - a.savedAt)
    .map(entry => {
      const { snapshot } = entry
      const routes = snapshot.lineOrder
        .map(lineId => snapshot.lines[lineId])
        .filter(Boolean)
        .map(line => ({
          color: line.color,
          points: line.nodes
            // A node is either a station to look up or a bare waypoint. A station id with no
            // station behind it is a broken save, and skipping it draws a slightly wrong
            // thumbnail rather than throwing on the way into the dialog.
            .map(node => (node.kind === 'station' ? snapshot.stations[node.stationId] : node))
            .filter(Boolean)
            .map(p => ({ x: p.x, y: p.y })),
        }))
        .filter(route => route.points.length >= 2)

      return {
        id: entry.id,
        name: entry.name || 'Untitled map',
        savedAt: entry.savedAt,
        stationCount: snapshot.stationOrder.length,
        lineCount: snapshot.lineOrder.length,
        routes,
      }
    })
}
