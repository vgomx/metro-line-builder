import { useCallback, useEffect, useRef } from 'react'
import type { DataSnapshot } from './useMapState'
import { stationIdsOfLine } from '../canvas/lineNodes'
import type { Award } from '../score'
import { LANDMARK_REACH, LIKES, POINTS, SCENIC_REACH, TERRITORY_REACH } from '../score'

/**
 * Turns deliberate edits into Approval awards, by diffing successive states — the same approach
 * the Gazette uses, and for the same reason it needs a `suppress`: load, undo/redo and generate
 * move the whole map at once and must not be scored (generating a city from a button isn't
 * building one). Stations are scored only once *committed*, so a line draft abandoned with Esc
 * banks nothing.
 *
 * A station's placement is judged as it lands: does it serve a landmark, sit by water or green,
 * or reach into empty territory — and, separately, does adding it (or running another line
 * through it) turn a stop into an interchange. Those are the awards that reward a good map over a
 * merely large one.
 */

type State = DataSnapshot & { draftCreatedStationIds: string[] }

interface Snap {
  lineIds: Set<string>
  lineStops: Map<string, number>
  lineCompany: Map<string, string | null>
  lineLabel: Map<string, string>
  companyIds: Set<string>
  stations: Map<string, { x: number; y: number }>
  stationLineCount: Map<string, number>
}

function label(name: string, number: number): string {
  return name.trim() || `Line ${number}`
}

function snapshot(state: State): Snap {
  const draft = new Set(state.draftCreatedStationIds)
  const stations = new Map<string, { x: number; y: number }>()
  for (const id of state.stationOrder) {
    if (draft.has(id)) continue
    const s = state.stations[id]
    if (s) stations.set(id, { x: s.x, y: s.y })
  }

  const lineIds = new Set<string>()
  const lineStops = new Map<string, number>()
  const lineCompany = new Map<string, string | null>()
  const lineLabel = new Map<string, string>()
  const stationLineCount = new Map<string, number>()
  for (const id of state.lineOrder) {
    const line = state.lines[id]
    if (!line) continue
    const stationIds = stationIdsOfLine(line)
    lineIds.add(id)
    lineStops.set(id, stationIds.length)
    lineCompany.set(id, line.companyId)
    lineLabel.set(id, label(line.name, line.number))
    for (const sid of new Set(stationIds)) stationLineCount.set(sid, (stationLineCount.get(sid) ?? 0) + 1)
  }

  const companyIds = new Set(state.companyOrder.filter(id => state.companies[id]))
  return { lineIds, lineStops, lineCompany, lineLabel, companyIds, stations, stationLineCount }
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export interface ScoreEventsControl {
  suppress: () => void
}

export function useScoreEvents(state: State, award: (a: Award) => void): ScoreEventsControl {
  const prevRef = useRef<Snap | null>(null)
  const suppressRef = useRef(false)

  useEffect(() => {
    const snap = snapshot(state)
    const prev = prevRef.current
    prevRef.current = snap
    if (prev === null) return
    if (suppressRef.current) {
      suppressRef.current = false
      return
    }

    // Lines: opened, or extended.
    for (const [id, stops] of snap.lineStops) {
      if (!prev.lineIds.has(id)) {
        award({ points: POINTS.newLine, likes: LIKES.newLineBase + LIKES.newLinePerStop * stops, category: 'lines', label: 'New line' })
        continue
      }
      const before = prev.lineStops.get(id) ?? stops
      if (stops > before) {
        const added = stops - before
        award({ points: POINTS.extendPerStop * added, likes: LIKES.extendPerStop * added, category: 'lines', label: 'Line extended' })
      }
      if (snap.lineCompany.get(id) !== prev.lineCompany.get(id)) {
        const conceded = snap.lineCompany.get(id) != null
        award({
          points: POINTS.concession,
          likes: LIKES.concession,
          category: 'operators',
          label: conceded ? 'Line conceded' : 'Line made public',
        })
      }
    }

    // New operators.
    for (const id of snap.companyIds) {
      if (!prev.companyIds.has(id)) award({ points: POINTS.company, likes: LIKES.company, category: 'operators', label: 'New operator' })
    }

    // Newly committed stations, judged on where they landed.
    const pois = state.poiOrder.map(id => state.pointsOfInterest[id]).filter(Boolean)
    const geos = state.geoFeatureOrder.map(id => state.geoFeatures[id]).filter(Boolean)
    for (const [id, pos] of snap.stations) {
      if (prev.stations.has(id)) continue
      award({ points: POINTS.station, likes: LIKES.station, category: 'stations', label: 'New station' })

      // Serves a landmark?
      let nearestPoi: { name: string; d: number } | null = null
      for (const poi of pois) {
        const d = dist(pos, poi)
        if (d <= LANDMARK_REACH && (!nearestPoi || d < nearestPoi.d)) nearestPoi = { name: poi.name, d }
      }
      if (nearestPoi) {
        award({ points: POINTS.bonusLandmark, likes: LIKES.bonusLandmark, category: 'placement', label: `Serves the ${nearestPoi.name}` })
      }

      // By the water or the green?
      let scenicType: 'river' | 'park' | null = null
      for (const geo of geos) {
        if (geo.points.some(p => dist(pos, p) <= SCENIC_REACH)) {
          scenicType = geo.type
          break
        }
      }
      if (scenicType) {
        award({ points: POINTS.bonusScenic, likes: LIKES.bonusScenic, category: 'placement', label: scenicType === 'river' ? 'By the water' : 'By the green' })
      }

      // Reaching into empty territory? (Far from everything that was already down.)
      if (prev.stations.size > 0) {
        let nearest = Infinity
        for (const other of prev.stations.values()) nearest = Math.min(nearest, dist(pos, other))
        if (nearest > TERRITORY_REACH) award({ points: POINTS.bonusTerritory, likes: LIKES.bonusTerritory, category: 'placement', label: 'New territory' })
      }
    }

    // Interchanges: a stop that has just come to serve a second line.
    for (const [id, count] of snap.stationLineCount) {
      const before = prev.stationLineCount.get(id) ?? 0
      if (count >= 2 && before < 2) award({ points: POINTS.bonusInterchange, likes: LIKES.bonusInterchange, category: 'placement', label: 'New interchange' })
    }
  }, [state, award])

  const suppress = useCallback(() => {
    suppressRef.current = true
  }, [])

  return { suppress }
}
