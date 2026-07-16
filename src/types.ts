export interface Station {
  id: string
  name: string
  x: number
  y: number
  transfer: boolean
}

export interface Point {
  x: number
  y: number
}

/** A stop on a line's path — anchored to a real station, or a bare waypoint that just shapes the route. */
export type LineNode = { kind: 'station'; stationId: string } | { kind: 'point'; x: number; y: number }

export type CompanyType = 'public' | 'private'

export interface Company {
  id: string
  name: string
  type: CompanyType
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
}

export type GeoFeatureType = 'river' | 'park'

export interface GeoFeature {
  id: string
  type: GeoFeatureType
  name: string
  points: Point[]
}

export type Tool = 'select' | 'add-station' | 'draw-line' | 'draw-river' | 'draw-park' | 'pan'
