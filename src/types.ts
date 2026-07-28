export interface Station {
  id: string
  name: string
  x: number
  y: number
  transfer: boolean
  /** Flagged by hand as one of the network's principal stations — a Luz or a Sé. Unlike
   * `transfer`, nothing about the geometry implies it: a station can serve every line on the
   * map without being one of the handful the city is organised around, so this is only ever
   * the map-maker's call. */
  main: boolean
  /** The station's own transport mode, chosen when it's placed. Optional and absent-means-metro,
   * so old maps load unchanged. It only decides the station's look — its square-or-circle shape —
   * while it has no lines; once lines run through it, their modes are what it wears, so a metro
   * stop on a rail line reads as rail regardless of how it was first placed. */
  mode?: LineKind
}

/**
 * A landmark dropped anywhere on the map — a museum, an airport, a park gate. Unlike a
 * station it belongs to no line and shapes no route; it's pure annotation, free to sit
 * wherever it makes sense.
 */
export interface PointOfInterest {
  id: string
  /** OpenMoji codepoint: both the icon's identity and its filename in src/assets/openmoji. */
  icon: string
  /** Shown beside the icon. Defaults to the icon's own name, and can be anything after that. */
  name: string
  x: number
  y: number
}

export interface Point {
  x: number
  y: number
}

/** A stop on a line's path — anchored to a real station, or a bare waypoint that just shapes the route. */
export type LineNode = { kind: 'station'; stationId: string } | { kind: 'point'; x: number; y: number }

export type CompanyType = 'public' | 'private'

/** The marks a company can wear, in the order the picker offers them — a vocabulary of
 * track, direction, and arrows, the way real operators badge themselves. The union derives
 * from this list so the picker, the renderer, and the validation in normalizeSnapshot can't
 * drift apart — adding a mark here is the whole registration. */
export const COMPANY_SYMBOLS = [
  'arrow',
  'chevrons',
  'converge',
  'diverge',
  'compass',
  'loop',
  'junction',
  'switch',
  'crossing',
  'rails',
] as const

export type CompanySymbol = (typeof COMPANY_SYMBOLS)[number]

export interface Company {
  id: string
  name: string
  type: CompanyType
  /** The company's monochromatic logo mark — purely cosmetic, always drawn in the ink of
   * wherever it appears rather than carrying a colour of its own. */
  symbol: CompanySymbol
}

/** What a line runs. Metro is the default and the majority; rail is the mainline/suburban kind,
 * drawn as a double track and stopping at square stations; tram is the street-level kind, a single
 * thin line calling at diamond stops. An enum rather than a boolean so the next kind — BRT, ferry —
 * is a value here rather than another flag to reconcile against the last one. */
export type LineKind = 'metro' | 'rail' | 'tram'

export interface Line {
  id: string
  /** The line's public number, as riders know it — São Paulo's 1, 2, 3. Distinct from `id`,
   * which is an internal handle that never changes; a number is the line's identity on the
   * map and in every badge. */
  number: number
  name: string
  color: string
  nodes: LineNode[]
  visible: boolean
  /** Owning operator, or null if unassigned (falls back to the Local Transport Authority). */
  companyId: string | null
  /** When the line was drawn, for the "Created" sort. Optional: lines saved before this existed
   * have none, and fall back to their position in the manual order. */
  createdAt?: number
  /** What the line runs. Optional and absent-means-metro, so every map saved before rail existed
   * loads as all-metro without a migration — the same shape `createdAt` takes. */
  kind?: LineKind
}

/** A line's kind, resolving the absent-means-metro default in one place so no caller has to. */
export function lineKind(line: Line): LineKind {
  return line.kind ?? 'metro'
}

export function isRailLine(line: Line): boolean {
  return line.kind === 'rail'
}

export function isTramLine(line: Line): boolean {
  return line.kind === 'tram'
}

/** The letter that leads a line's code — M for metro, R for rail, T for tram. */
export function lineKindPrefix(kind: LineKind): string {
  return kind === 'rail' ? 'R' : kind === 'tram' ? 'T' : 'M'
}

/** The mark a station wears for a mode: a disc for metro, a rounded square for rail, a diamond for
 * tram. One place so the canvas, the list, the key and the trip strip can't draw a stop three ways.
 * A presentational mapping, but it lives beside the codes for the same reason `lineKindPrefix` does:
 * it's the mode's identity, and everything that renders a mode reaches for it. */
export type StationShape = 'circle' | 'square' | 'diamond'
export function stationShape(kind: LineKind): StationShape {
  return kind === 'rail' ? 'square' : kind === 'tram' ? 'diamond' : 'circle'
}

/**
 * Which shape a stop wears given the modes calling there.
 *
 * A stop served by one mode wears that mode's shape, however many lines of it stop there — a
 * three-metro interchange is still a (bigger) disc, a rail junction a bigger square. Only where two
 * modes genuinely meet does the shape fall back to a disc, because no one mode's shape can stand for
 * a place you change between them. This is the whole rule the canvas, the list and the key share.
 */
export function markShapeForModes(modes: LineKind[]): StationShape {
  return new Set(modes).size >= 2 ? 'circle' : stationShape(modes[0] ?? 'metro')
}

/**
 * A line's code: its kind's letter and its number, M1, R3 and so on.
 *
 * Numbering is per kind, so a metro Line 1 and a rail Line 1 both exist; the badges tell them apart
 * by shape and fill, but only just, and never in a sentence. The letter makes the distinction plain
 * and speakable — M1 is unmistakably not R1 — which is the whole reason a rider learns a line by a
 * code rather than by its colour.
 */
export function lineCode(line: Line): string {
  return `${lineKindPrefix(lineKind(line))}${line.number}`
}

export type GeoFeatureType = 'river' | 'park'

export interface GeoFeature {
  id: string
  type: GeoFeatureType
  name: string
  points: Point[]
}

export type Tool = 'select' | 'plan-journey' | 'add-station' | 'draw-line' | 'draw-river' | 'draw-park' | 'add-poi' | 'pan'
