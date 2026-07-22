/**
 * The Approval scoring rules.
 *
 * Two currencies, on purpose: **points** are the record — a clean, deterministic score you can
 * compare against your own past. **Likes** are the reaction — how many of the people you serve
 * cheered — so they run bigger and swing with impact (a whole new line pleases a crowd; a single
 * stop pleases a handful). The badge counts points; the hearts that fly up are the likes.
 */

export type ScoreCategory = 'lines' | 'stations' | 'operators' | 'placement'

export interface Award {
  points: number
  likes: number
  category: ScoreCategory
  /** A short reason, e.g. "New line" or "Serves the Museum" — shown in the panel's breakdown. */
  label: string
}

/** How close a new stop has to be to count as serving a landmark, or as scenic. Stations sit on a
 * 40-unit grid and landmarks half that; ~1.5 cells reads as "right by it". */
export const LANDMARK_REACH = 58
export const SCENIC_REACH = 64
/** And how far from every existing stop a new one has to be to count as opening new territory —
 * several cells out, so infilling a dense area doesn't qualify but reaching outward does. */
export const TERRITORY_REACH = 200

export const POINTS = {
  newLine: 120,
  station: 15,
  extendPerStop: 12,
  company: 45,
  concession: 30,
  bonusLandmark: 30,
  bonusScenic: 20,
  bonusTerritory: 25,
  bonusInterchange: 35,
} as const

/** Likes run richer than points — they're a crowd, not a tally. */
export const LIKES = {
  newLineBase: 220,
  newLinePerStop: 45,
  station: 70,
  extendPerStop: 60,
  company: 160,
  concession: 130,
  bonusLandmark: 180,
  bonusScenic: 110,
  bonusTerritory: 140,
  bonusInterchange: 220,
} as const
