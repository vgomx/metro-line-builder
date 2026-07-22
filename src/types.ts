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
}

export type GeoFeatureType = 'river' | 'park'

export interface GeoFeature {
  id: string
  type: GeoFeatureType
  name: string
  points: Point[]
}

export type Tool = 'select' | 'plan-journey' | 'add-station' | 'draw-line' | 'draw-river' | 'draw-park' | 'add-poi' | 'pan'
