import { useCallback, useEffect, useRef } from 'react'
import type { DataSnapshot } from './useMapState'
import { stationIdsOfLine } from '../canvas/lineNodes'
import type { Award } from '../score'
import { LANDMARK_REACH, POINTS, REACTIONS, SCENIC_REACH, TERRITORY_REACH } from '../score'

/**
 * Turns deliberate edits into Karma, by diffing successive states — the same approach the Gazette
 * uses, and for the same reason it needs a `suppress`: load, undo/redo and generate move the whole
 * map at once and must not be scored (generating a city from a button isn't building one). Stations
 * are scored only once *committed*, so a line draft abandoned with Esc banks nothing.
 *
 * Building and unbuilding are both read here, and they have to cancel exactly. That is what the
 * ledger is for: what a line was worth when it opened, and what each station actually earned where
 * it landed, remembered so a closure can hand back precisely that and no more. Without it a
 * refund would be a guess, and a guess in either direction is a way to farm the score — cycles of
 * build-and-demolish would drift the total up or down for free.
 *
 * A station's placement is judged as it lands: does it serve a landmark, sit by water or green, or
 * reach into empty territory — and, separately, does adding it (or running another line through it)
 * turn a stop into an interchange. Those are the awards that reward a good map over a merely large
 * one, and each of them is refundable in the same breath.
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

/**
 * What the map owes back if it loses something.
 *
 * `birthStops` is the stop count a line opened with, so closing it refunds its opening award plus
 * only the extensions actually earned since. `earned` is the running total a station has banked —
 * its base, whatever its placement was worth, and an interchange bonus if it later became one.
 */
interface Ledger {
  birthStops: Map<string, number>
  earned: Map<string, number>
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

/**
 * Brings the ledger level with a map that arrived all at once — a load, a generate, an undo, or the
 * very first pass. Nothing here is scored, so nothing here can be refunded from history: a line is
 * taken to have opened at the length it arrives with, and a station to have earned its base. That
 * way tearing one down afterwards still costs, but only what this session can honestly account for.
 */
function reseed(ledger: Ledger, snap: Snap): void {
  for (const [id, stops] of snap.lineStops) if (!ledger.birthStops.has(id)) ledger.birthStops.set(id, stops)
  for (const id of snap.stations.keys()) if (!ledger.earned.has(id)) ledger.earned.set(id, POINTS.station)
  for (const id of [...ledger.birthStops.keys()]) if (!snap.lineIds.has(id)) ledger.birthStops.delete(id)
  for (const id of [...ledger.earned.keys()]) if (!snap.stations.has(id)) ledger.earned.delete(id)
}

export interface ScoreEventsControl {
  suppress: () => void
}

export function useScoreEvents(state: State, award: (a: Award) => void): ScoreEventsControl {
  const prevRef = useRef<Snap | null>(null)
  const suppressRef = useRef(false)
  const ledgerRef = useRef<Ledger>({ birthStops: new Map(), earned: new Map() })

  useEffect(() => {
    const snap = snapshot(state)
    const prev = prevRef.current
    prevRef.current = snap
    const ledger = ledgerRef.current
    if (prev === null || suppressRef.current) {
      suppressRef.current = false
      reseed(ledger, snap)
      return
    }

    // Lines: opened, extended, cut back — and a concession either given or taken back.
    for (const [id, stops] of snap.lineStops) {
      if (!prev.lineIds.has(id)) {
        award({
          points: POINTS.newLine,
          reactions: REACTIONS.newLineBase + REACTIONS.newLinePerStop * stops,
          category: 'lines',
          label: 'New line',
        })
        ledger.birthStops.set(id, stops)
        continue
      }
      const before = prev.lineStops.get(id) ?? stops
      if (stops > before) {
        const added = stops - before
        award({ points: POINTS.extendPerStop * added, reactions: REACTIONS.extendPerStop * added, category: 'lines', label: 'Line extended' })
      } else if (stops < before) {
        const dropped = before - stops
        award({ points: -POINTS.extendPerStop * dropped, reactions: REACTIONS.extendPerStop * dropped, category: 'lines', label: 'Line cut back' })
      }
      if (snap.lineCompany.get(id) !== prev.lineCompany.get(id)) {
        // Signed by direction, so handing a line over and taking it back again nets out. An
        // unsigned award for "the operator changed" would pay out on every toggle.
        const conceded = snap.lineCompany.get(id) != null
        award({
          points: conceded ? POINTS.concession : -POINTS.concession,
          reactions: REACTIONS.concession,
          category: 'operators',
          label: conceded ? 'Line conceded' : 'Concession returned',
        })
      }
    }

    // Lines closed: the opening award back, plus only the extensions it actually earned.
    for (const id of prev.lineIds) {
      if (snap.lineIds.has(id)) continue
      const stops = prev.lineStops.get(id) ?? 0
      const extensions = Math.max(0, stops - (ledger.birthStops.get(id) ?? stops))
      award({
        points: -(POINTS.newLine + POINTS.extendPerStop * extensions),
        reactions: REACTIONS.newLineBase + REACTIONS.newLinePerStop * stops,
        category: 'lines',
        label: `${prev.lineLabel.get(id) ?? 'Line'} closed`,
      })
      ledger.birthStops.delete(id)
    }

    // Operators founded, and wound up.
    for (const id of snap.companyIds) {
      if (!prev.companyIds.has(id)) award({ points: POINTS.company, reactions: REACTIONS.company, category: 'operators', label: 'New operator' })
    }
    for (const id of prev.companyIds) {
      if (!snap.companyIds.has(id)) award({ points: -POINTS.company, reactions: REACTIONS.company, category: 'operators', label: 'Operator wound up' })
    }

    // Newly committed stations, judged on where they landed.
    const pois = state.poiOrder.map(id => state.pointsOfInterest[id]).filter(Boolean)
    const geos = state.geoFeatureOrder.map(id => state.geoFeatures[id]).filter(Boolean)
    for (const [id, pos] of snap.stations) {
      if (prev.stations.has(id)) continue
      award({ points: POINTS.station, reactions: REACTIONS.station, category: 'stations', label: 'New station' })
      let earned: number = POINTS.station

      // Serves a landmark?
      let nearestPoi: { name: string; d: number } | null = null
      for (const poi of pois) {
        const d = dist(pos, poi)
        if (d <= LANDMARK_REACH && (!nearestPoi || d < nearestPoi.d)) nearestPoi = { name: poi.name, d }
      }
      if (nearestPoi) {
        award({ points: POINTS.bonusLandmark, reactions: REACTIONS.bonusLandmark, category: 'placement', label: `Serves the ${nearestPoi.name}` })
        earned += POINTS.bonusLandmark
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
        award({ points: POINTS.bonusScenic, reactions: REACTIONS.bonusScenic, category: 'placement', label: scenicType === 'river' ? 'By the water' : 'By the green' })
        earned += POINTS.bonusScenic
      }

      // Reaching into empty territory? (Far from everything that was already down.)
      if (prev.stations.size > 0) {
        let nearest = Infinity
        for (const other of prev.stations.values()) nearest = Math.min(nearest, dist(pos, other))
        if (nearest > TERRITORY_REACH) {
          award({ points: POINTS.bonusTerritory, reactions: REACTIONS.bonusTerritory, category: 'placement', label: 'New territory' })
          earned += POINTS.bonusTerritory
        }
      }
      ledger.earned.set(id, earned)
    }

    // Stations closed: everything that stop ever banked, handed back in one go.
    for (const id of prev.stations.keys()) {
      if (snap.stations.has(id)) continue
      award({
        points: -(ledger.earned.get(id) ?? POINTS.station),
        reactions: REACTIONS.station,
        category: 'stations',
        label: 'Station closed',
      })
      ledger.earned.delete(id)
    }

    // Interchanges made and lost — but only for stops still standing, since a closed one has just
    // handed back its interchange bonus along with the rest of what it earned.
    for (const [id, count] of snap.stationLineCount) {
      const before = prev.stationLineCount.get(id) ?? 0
      if (count >= 2 && before < 2) {
        award({ points: POINTS.bonusInterchange, reactions: REACTIONS.bonusInterchange, category: 'placement', label: 'New interchange' })
        ledger.earned.set(id, (ledger.earned.get(id) ?? POINTS.station) + POINTS.bonusInterchange)
      }
    }
    for (const [id, before] of prev.stationLineCount) {
      if (!snap.stations.has(id)) continue
      const count = snap.stationLineCount.get(id) ?? 0
      if (before >= 2 && count < 2) {
        award({ points: -POINTS.bonusInterchange, reactions: REACTIONS.bonusInterchange, category: 'placement', label: 'Interchange lost' })
        ledger.earned.set(id, (ledger.earned.get(id) ?? POINTS.station) - POINTS.bonusInterchange)
      }
    }
  }, [state, award])

  const suppress = useCallback(() => {
    suppressRef.current = true
  }, [])

  return { suppress }
}
