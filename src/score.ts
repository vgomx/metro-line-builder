/**
 * The Karma scoring rules.
 *
 * Transport karma: the network keeps a memory of what you did to it. Building earns; tearing down
 * costs. A closure refunds *exactly* what the thing earned while it stood, so the ledger can't be
 * farmed — laying a line and ripping it up again nets zero, however many times you do it — and the
 * total is free to fall below zero, because a city that has lost more than it gained should read
 * that way.
 *
 * Two currencies, on purpose: **karma** is the record — a clean, deterministic score you can
 * compare against your own past. **Reactions** are the crowd — how many of the people you serve
 * felt something — so they run bigger and swing with impact (a whole new line moves a crowd; a
 * single stop moves a handful). The badge counts karma; the faces that fly up are the reactions,
 * smiling or furious according to which way the karma went.
 */

export type ScoreCategory = 'lines' | 'stations' | 'operators' | 'placement'

export interface Award {
  /** Signed: positive for building, negative for tearing down. */
  points: number
  /** How many people reacted — always a plain count, never signed. The sign of `points` is what
   * decides whether they arrive cheering or furious. */
  reactions: number
  category: ScoreCategory
  /** A short reason, e.g. "New line" or "Line closed" — shown in the panel's breakdown. */
  label: string
}

/** How close a new stop has to be to count as serving a landmark, or as scenic. Stations sit on a
 * 40-unit grid and landmarks half that; ~1.5 cells reads as "right by it". */
export const LANDMARK_REACH = 58
export const SCENIC_REACH = 64
/** And how far from every existing stop a new one has to be to count as opening new territory —
 * several cells out, so infilling a dense area doesn't qualify but reaching outward does. */
export const TERRITORY_REACH = 200

/** What each act of building is worth. Tearing the same thing down costs the negative of what it
 * actually earned, so there is no separate table of penalties to drift out of step with this one. */
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

/** Reactions run richer than karma — they're a crowd, not a tally. The same numbers serve both
 * directions: a line torn up moves as many people as it moved when it opened, they just aren't
 * smiling about it. */
export const REACTIONS = {
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
