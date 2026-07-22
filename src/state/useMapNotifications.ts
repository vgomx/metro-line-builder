import { useCallback, useEffect, useRef } from 'react'
import type { DataSnapshot } from './useMapState'
import { stationIdsOfLine } from '../canvas/lineNodes'
import { notificationCopy } from '../notificationCopy'

/**
 * Turns edits to the map into Gazette headlines.
 *
 * Detection is by diffing successive states rather than by hooking each handler, so all the
 * headline logic lives in one place — but that means load, undo/redo and generate, which move the
 * whole map at once, would each read as a flurry of "new line!" headlines. So the caller wraps
 * those paths and calls `suppress` first: the next diff then only re-baselines (silently, or with
 * a single "founded" headline for a freshly generated city) instead of reporting every difference.
 *
 * The map name is handled apart from the rest, on a debounce, because it's edited a keystroke at a
 * time and a live "renamed to Cru… Crum… Crump…" would be absurd.
 */

type SuppressReason = 'silent' | 'foundation'

interface LineSnap {
  name: string
  number: number
  companyId: string | null
  stops: number
}

interface Snap {
  mapName: string
  lines: Map<string, LineSnap>
  companies: Map<string, string>
  totalStations: number
}

function snapshot(state: DataSnapshot): Snap {
  const lines = new Map<string, LineSnap>()
  for (const id of state.lineOrder) {
    const line = state.lines[id]
    if (line) lines.set(id, { name: line.name, number: line.number, companyId: line.companyId, stops: stationIdsOfLine(line).length })
  }
  const companies = new Map<string, string>()
  for (const id of state.companyOrder) {
    const company = state.companies[id]
    if (company) companies.set(id, company.name)
  }
  return { mapName: state.mapName, lines, companies, totalStations: state.stationOrder.length }
}

/** The highest station milestone crossed going from `prev` to `curr` — the first station, then
 * each round 25. One headline even if a burst of stations vaults several at once. */
function milestoneCrossed(prev: number, curr: number): number | null {
  const hits: number[] = []
  if (prev < 1 && curr >= 1) hits.push(1)
  for (let m = Math.ceil((prev + 1) / 25) * 25; m <= curr; m += 25) hits.push(m)
  return hits.length ? hits[hits.length - 1] : null
}

export interface MapNotificationsControl {
  /** Call before dispatching a whole-map move so its diff doesn't spam. 'foundation' still earns
   * one headline; 'silent' earns none. */
  suppress: (reason: SuppressReason) => void
}

export function useMapNotifications(state: DataSnapshot, announce: (text: string) => void): MapNotificationsControl {
  const prevRef = useRef<Snap | null>(null)
  const suppressRef = useRef<SuppressReason | null>(null)
  const renameBaseRef = useRef<string>(state.mapName)
  const renameTimerRef = useRef<number | undefined>(undefined)

  // Immediate events: lines, companies, concessions, station milestones. Map name is not here.
  useEffect(() => {
    const snap = snapshot(state)
    const prev = prevRef.current
    prevRef.current = snap

    if (prev === null) {
      // First run just banks a baseline — the map loaded from storage isn't news.
      renameBaseRef.current = snap.mapName
      return
    }

    const suppress = suppressRef.current
    if (suppress) {
      suppressRef.current = null
      renameBaseRef.current = snap.mapName
      if (suppress === 'foundation') announce(notificationCopy.founded(snap.mapName))
      return
    }

    let lineCreated = false
    for (const [id, line] of snap.lines) {
      const before = prev.lines.get(id)
      if (!before) {
        lineCreated = true
        announce(notificationCopy.lineOpened(line.name, line.number, line.stops))
        continue
      }
      if (line.stops > before.stops) {
        announce(notificationCopy.lineExtended(line.name, line.number, line.stops - before.stops))
      }
      if (line.companyId !== before.companyId) {
        if (line.companyId) announce(notificationCopy.lineConceded(line.name, line.number, snap.companies.get(line.companyId) ?? ''))
        else announce(notificationCopy.lineReturned(line.name, line.number))
      }
    }

    for (const [id, name] of snap.companies) {
      if (!prev.companies.has(id)) announce(notificationCopy.companyFounded(name))
    }

    // A new line's headline already speaks to the stations it brought, so don't double up.
    if (!lineCreated) {
      const milestone = milestoneCrossed(prev.totalStations, snap.totalStations)
      if (milestone) announce(notificationCopy.stationMilestone(milestone))
    }
  }, [state, announce])

  // The map name, on a debounce: only the settled name earns a headline, and only if it actually
  // changed from the last one reported. A pending suppress (load/undo/generate) means the main
  // effect is about to re-baseline the name, so leave it be.
  useEffect(() => {
    if (prevRef.current === null || suppressRef.current) return
    window.clearTimeout(renameTimerRef.current)
    renameTimerRef.current = window.setTimeout(() => {
      const from = renameBaseRef.current
      if (state.mapName.trim() && state.mapName !== from) {
        announce(notificationCopy.renamedMap(from, state.mapName))
        renameBaseRef.current = state.mapName
      }
    }, 1300)
    return () => window.clearTimeout(renameTimerRef.current)
  }, [state.mapName, announce])

  const suppress = useCallback((reason: SuppressReason) => {
    suppressRef.current = reason
  }, [])

  return { suppress }
}
