import type { Line, Station } from '../types'
import { resolveNodePoint } from './lineNodes'

export interface LabelPlacement {
  angle: number
  anchor: 'start' | 'middle' | 'end'
}

/**
 * The 8 schematic compass directions a Beck-style tube map label can sit in, ordered
 * by preference when nothing forces a choice. South (straight below) comes first so
 * a station untouched by any line keeps the plain, familiar look; the rest fan out
 * from there.
 */
const LABEL_DIRECTIONS: LabelPlacement[] = [
  { angle: Math.PI / 2, anchor: 'middle' }, // S
  { angle: 0, anchor: 'start' }, // E
  { angle: Math.PI, anchor: 'end' }, // W
  { angle: -Math.PI / 2, anchor: 'middle' }, // N
  { angle: Math.PI / 4, anchor: 'start' }, // SE
  { angle: (3 * Math.PI) / 4, anchor: 'end' }, // SW
  { angle: -Math.PI / 4, anchor: 'start' }, // NE
  { angle: (-3 * Math.PI) / 4, anchor: 'end' }, // NW
]

/** Drives the measuring font, the card height, and the rendered text alike, so this is the
 * one number that decides how much room every name takes. Kept deliberately small: a name is
 * a box the placement search has to find space for, and a smaller box is one that fits in
 * more of the eight directions before it starts landing on a neighbour. */
export const LABEL_FONT_SIZE = 10
const LABEL_FONT = `600 ${LABEL_FONT_SIZE}px 'Barlow Condensed', system-ui, sans-serif`
const CARD_PAD_X = 5
export const CARD_PAD_Y = 2.5
/** A main station's plate is fully rounded, so its ends curve away where the text would
 * otherwise sit; it needs more room than a square-ish card to keep the name off the arc. */
const MAIN_PAD_X = 10
/** Clear air kept between two labels, so avoiding a collision doesn't just make them touch. */
const LABEL_GAP = 3

const PLAIN_RADIUS = 6.5
const INTERCHANGE_RADIUS = 10
const LABEL_OFFSET = 12

let measureCanvas: HTMLCanvasElement | null = null

/** Pixel width of a label in the exact face it renders with, so the backing card can
 * be sized to fit. Canvas measureText can't read a CSS var for its font, but this
 * label uses a literal family string, so it measures directly. A little horizontal
 * padding on top absorbs the small canvas-vs-layout metric drift. */
export function measureLabelWidth(text: string): number {
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return text.length * (LABEL_FONT_SIZE * 0.55)
  ctx.font = LABEL_FONT
  return ctx.measureText(text).width
}


/**
 * Breaks a label into lines that each fit `maxWidth`, at most `maxLines` of them.
 *
 * SVG text does not wrap, so a long name is a single run that grows until it collides with
 * whatever is beside it — a landmark called "Classical building" is wider than the marker it
 * belongs to, and a park's name can outgrow the park. Wrapping keeps a label roughly as wide
 * as the thing it names, at the cost of it being taller.
 *
 * Greedy: words go on the current line while they fit. A single word wider than the line is
 * broken mid-word rather than allowed to overflow, and anything past the last line is cut with
 * an ellipsis — a name that runs off the map is worse than one visibly shortened.
 */
export function wrapLabel(text: string, maxWidth: number, fontSize: number, maxLines = 2): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  // measureLabelWidth measures at LABEL_FONT_SIZE; text scales linearly with the font size.
  const scale = fontSize / LABEL_FONT_SIZE
  const widthOf = (s: string) => measureLabelWidth(s) * scale
  if (widthOf(trimmed) <= maxWidth) return [trimmed]

  const lines: string[] = []
  let current = ''
  const flush = () => {
    if (current) lines.push(current)
    current = ''
  }

  for (const word of trimmed.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word
    if (widthOf(candidate) <= maxWidth) {
      current = candidate
      continue
    }
    flush()
    if (lines.length >= maxLines) break
    // A word too wide even on its own line: break it where it stops fitting.
    let rest = word
    while (widthOf(rest) > maxWidth && lines.length < maxLines) {
      let cut = rest.length
      while (cut > 1 && widthOf(rest.slice(0, cut)) > maxWidth) cut--
      lines.push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    current = rest
  }
  flush()

  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]
  while (last.length > 1 && widthOf(`${last}…`) > maxWidth) last = last.slice(0, -1)
  kept[maxLines - 1] = `${last}…`
  return kept
}

export interface LabelGeometry {
  /** Text anchor point, relative to the station. */
  labelX: number
  labelY: number
  /** Backing card, relative to the station. */
  cardX: number
  cardY: number
  cardW: number
  cardH: number
  textWidth: number
  /** The name broken into the lines the card is sized for. */
  lines: string[]
}

/** A station name wraps past this, so one long name can't drive a card across its
 * neighbours. Wide enough that the names in the generator's own pool stay on one line. */
const STATION_LABEL_MAX_WIDTH = 84

/**
 * Where a station's name and its backing card sit, in station-local coordinates.
 *
 * The single source of this: StationNode draws from it, and the placement search below tests
 * collisions with it. Two copies of this arithmetic would mean resolving overlaps between
 * boxes that aren't the ones on screen.
 *
 * Measured from the marker's resting radius, ignoring the swell it takes on while hovered or
 * dragged — a name that slid outward whenever the cursor grazed its marker would jitter, and
 * a label that moved mid-drag would invalidate every collision this module just resolved.
 */
export function labelGeometry(station: Station, placement: LabelPlacement, isInterchange: boolean): LabelGeometry {
  const radius = isInterchange ? INTERCHANGE_RADIUS : PLAIN_RADIUS
  const distance = radius + LABEL_OFFSET
  const labelX = Math.cos(placement.angle) * distance
  const labelY = Math.sin(placement.angle) * distance

  const padX = station.main ? MAIN_PAD_X : CARD_PAD_X
  const lines = wrapLabel(station.name, STATION_LABEL_MAX_WIDTH, LABEL_FONT_SIZE, 2)
  // The widest line sets the card, and every line has to fit inside it.
  const textWidth = lines.length > 0 ? Math.max(...lines.map(measureLabelWidth)) : 0
  const cardW = textWidth + padX * 2
  const cardH = LABEL_FONT_SIZE * lines.length + CARD_PAD_Y * 2
  const cardX =
    placement.anchor === 'start'
      ? labelX - padX
      : placement.anchor === 'end'
        ? labelX - textWidth - padX
        : labelX - cardW / 2

  return { labelX, labelY, cardX, cardY: labelY - cardH / 2, cardW, cardH, textWidth, lines }
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

function labelBox(station: Station, placement: LabelPlacement, isInterchange: boolean): Box {
  const g = labelGeometry(station, placement, isInterchange)
  return { x: station.x + g.cardX, y: station.y + g.cardY, width: g.cardW, height: g.cardH }
}

/** How much two boxes actually overlap, in square units — 0 when they don't. Used to choose
 * the least-bad placement when a crowded corner leaves no clear one at all. */
function overlapArea(a: Box, b: Box, gap = 0): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x - gap, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y - gap, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

function overlaps(a: Box, b: Box, gap = 0): boolean {
  return (
    a.x - gap < b.x + b.width &&
    b.x - gap < a.x + a.width &&
    a.y - gap < b.y + b.height &&
    b.y - gap < a.y + a.height
  )
}

function angularDistance(a: number, b: number): number {
  const twoPi = Math.PI * 2
  let diff = Math.abs(a - b) % twoPi
  if (diff > Math.PI) diff = twoPi - diff
  return diff
}

/** Angles (in radians, screen space) from a station to every line segment leaving it. */
function incidentAngles(stationId: string, lineList: Line[], stations: Record<string, Station>): number[] {
  const station = stations[stationId]
  if (!station) return []

  const angles: number[] = []
  for (const line of lineList) {
    const nodes = line.nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (node.kind !== 'station' || node.stationId !== stationId) continue
      const neighbors = [nodes[i - 1], nodes[i + 1]]
      for (const neighbor of neighbors) {
        if (!neighbor) continue
        const point = resolveNodePoint(neighbor, stations)
        if (point) angles.push(Math.atan2(point.y - station.y, point.x - station.x))
      }
    }
  }
  return angles
}

/** How far a direction sits from the nearest line leaving the station — the higher the
 * better, since it's the name keeping clear of the track. */
function clearanceScore(direction: LabelPlacement, incident: number[]): number {
  if (incident.length === 0) return Infinity
  return Math.min(...incident.map(a => angularDistance(a, direction.angle)))
}

/**
 * Places every station's name, in one pass over the whole map.
 *
 * Each label still prefers the compass direction furthest from its own lines, but the choice
 * is now made against what's already on the map: a direction whose card would land on an
 * earlier label, or across another station's marker, is rejected before clearance is even
 * weighed. Deciding station by station in isolation is what let two names sit on top of one
 * another — each was individually correct about the tracks and blind to its neighbour.
 *
 * Greedy, so the order is the priority: principal stations claim a spot first, then
 * interchanges, then the rest in map order. Ties and total deadlock fall back to pure
 * clearance, which is the behaviour this had before — a label that can't avoid every
 * neighbour should at least keep off the tracks.
 */
export function computeLabelPlacements(
  stationList: Station[],
  lineList: Line[],
  stations: Record<string, Station>,
  interchangeIds: Set<string>,
): Record<string, LabelPlacement> {
  const isInterchange = (station: Station) => interchangeIds.has(station.id) || station.transfer

  // Markers are fixed obstacles: unlike labels they can't be moved out of the way, so every
  // label has to work around all of them from the start.
  const markers = new Map<string, Box>(
    stationList.map(station => {
      const r = isInterchange(station) ? INTERCHANGE_RADIUS : PLAIN_RADIUS
      return [station.id, { x: station.x - r, y: station.y - r, width: r * 2, height: r * 2 }]
    }),
  )

  const ranked = stationList
    .map((station, index) => ({ station, index, rank: station.main ? 2 : isInterchange(station) ? 1 : 0 }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)

  const placed: Box[] = []
  const result: Record<string, LabelPlacement> = {}

  for (const { station } of ranked) {
    const incident = incidentAngles(station.id, lineList, stations)
    const interchange = isInterchange(station)
    const named = station.name.trim().length > 0

    let best = LABEL_DIRECTIONS[0]
    let bestScore = -Infinity
    let bestFree: LabelPlacement | null = null
    let bestFreeScore = -Infinity
    // Where to go when nowhere is clear. Wrapping made this matter: a two-line card is half
    // again as tall, so crowded corners run out of free placements more often, and the old
    // fallback — best clearance from the lines, label collisions ignored — could drop a card
    // squarely across its neighbour. Least overlap is the honest answer to "no good options".
    let bestBusy: LabelPlacement | null = null
    let bestBusyOverlap = Infinity
    let bestBusyScore = -Infinity

    for (const direction of LABEL_DIRECTIONS) {
      const score = clearanceScore(direction, incident)
      if (score > bestScore + 1e-6) {
        bestScore = score
        best = direction
      }
      if (!named) continue

      const box = labelBox(station, direction, interchange)
      const hitsLabel = placed.some(other => overlaps(box, other, LABEL_GAP))
      // A station's own marker never reaches its label — the offset guarantees it — so the
      // only markers worth testing are everyone else's.
      const hitsMarker = [...markers].some(([id, marker]) => id !== station.id && overlaps(box, marker))
      if (hitsLabel || hitsMarker) {
        let spilled = 0
        for (const other of placed) spilled += overlapArea(box, other, LABEL_GAP)
        for (const [id, marker] of markers) if (id !== station.id) spilled += overlapArea(box, marker)
        if (spilled < bestBusyOverlap - 1e-6 || (Math.abs(spilled - bestBusyOverlap) < 1e-6 && score > bestBusyScore)) {
          bestBusyOverlap = spilled
          bestBusyScore = score
          bestBusy = direction
        }
        continue
      }
      if (score > bestFreeScore + 1e-6) {
        bestFreeScore = score
        bestFree = direction
      }
    }

    const chosen = bestFree ?? (named ? (bestBusy ?? best) : best)
    result[station.id] = chosen
    if (named) placed.push(labelBox(station, chosen, interchange))
  }

  return result
}
