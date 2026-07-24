import { useCallback, useRef, useState } from 'react'
import type { Award, ScoreCategory } from '../score'

/**
 * The Karma score — one record per city, not one per browser.
 *
 * Karma belongs to the map it was earned on: it is what *this* city makes of what you did to it, so
 * opening another map shows that city's own standing, and a map generated from nothing starts at
 * zero. Records are filed under the same map ids the library uses, which is what keeps the two in
 * step — forget a map and its karma goes with it.
 *
 * Karma is the score and it is signed: building adds, tearing down subtracts, and the total is
 * allowed below zero. Reactions are the crowd, split into the ones who cheered and the ones who
 * were furious, so the panel can say which way the city has felt about you overall. Each is banked
 * by category, and the running total is sampled into a dated history so you can watch it climb —
 * or sink. `bursts` are the transient faces-and-figures that fly off the badge when an award
 * lands; they carry no history and clean themselves up.
 */

const KEY = 'metro-line-builder:karma'
/** Where the score lived when there was only one of it, for everything. Read once, then retired. */
const LEGACY_KEY = 'metro-line-builder:score'
/** Keep the history readable, not exhaustive — old samples fall off. */
const MAX_HISTORY = 250
/** Comfortably more than the library keeps, so a city's karma is still there if it is re-opened,
 * without the store growing without end behind a library that has long since dropped it. */
const MAX_RECORDS = 24

const EMPTY_BREAKDOWN: Record<ScoreCategory, number> = { lines: 0, stations: 0, operators: 0, placement: 0 }

export interface ScoreSample {
  at: number
  score: number
}

export interface Burst {
  id: number
  /** Signed, exactly as the award was — the badge reads its sign to pick a face. */
  points: number
  reactions: number
}

interface Persisted {
  points: number
  cheers: number
  jeers: number
  breakdown: Record<ScoreCategory, number>
  history: ScoreSample[]
  /** Last touched, so the store can shed the coldest records rather than an arbitrary few. */
  at: number
}

type Store = Record<string, Persisted>

function empty(): Persisted {
  return { points: 0, cheers: 0, jeers: 0, breakdown: { ...EMPTY_BREAKDOWN }, history: [], at: 0 }
}

function coerce(raw: unknown): Persisted {
  const parsed = (raw ?? {}) as Record<string, unknown>
  return {
    points: Number(parsed.points) || 0,
    // Scores banked before karma existed counted only approval, under the old name — every one of
    // those was a cheer, so they carry over as such rather than being thrown away.
    cheers: Number(parsed.cheers ?? parsed.likes) || 0,
    jeers: Number(parsed.jeers) || 0,
    breakdown: { ...EMPTY_BREAKDOWN, ...((parsed.breakdown as Record<ScoreCategory, number>) ?? {}) },
    history: Array.isArray(parsed.history) ? (parsed.history as ScoreSample[]).slice(-MAX_HISTORY) : [],
    at: Number(parsed.at) || 0,
  }
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const store: Store = {}
    for (const [id, record] of Object.entries(parsed as Record<string, unknown>)) store[id] = coerce(record)
    return store
  } catch {
    return {}
  }
}

function writeStore(store: Store) {
  // Shed the coldest records first, so a long-lived browser doesn't carry karma for cities that
  // fell out of the library many maps ago.
  const ids = Object.keys(store).sort((a, b) => (store[b].at || 0) - (store[a].at || 0))
  const trimmed: Store = {}
  for (const id of ids.slice(0, MAX_RECORDS)) trimmed[id] = store[id]
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed))
  } catch {
    // Non-fatal: the score just won't outlive the session.
  }
}

/**
 * This map's record, adopting the old single global score the first time it's asked for.
 *
 * That score was earned on whatever city was open when karma was still one number for the whole
 * browser, so it belongs to that city — handing it to the map being opened right now keeps it
 * rather than resetting someone's long-running total to zero. Consumed once: the legacy key is
 * cleared as it's adopted, so the next map to open starts fresh like any other.
 */
function loadFor(mapId: string): Persisted {
  const store = readStore()
  const existing = store[mapId]
  if (existing) return existing

  try {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const adopted = coerce(JSON.parse(legacy))
      localStorage.removeItem(LEGACY_KEY)
      store[mapId] = adopted
      writeStore(store)
      return adopted
    }
  } catch {
    // A corrupt legacy score is not worth failing over — this city simply starts at zero.
  }
  return empty()
}

/** Drop a city's karma, for when its map is dropped from the library. */
export function forgetKarma(mapId: string) {
  const store = readStore()
  if (!(mapId in store)) return
  delete store[mapId]
  writeStore(store)
}

export interface ScoreApi {
  points: number
  cheers: number
  jeers: number
  breakdown: Record<ScoreCategory, number>
  history: ScoreSample[]
  bursts: Burst[]
  award: (award: Award) => void
  reset: () => void
  clearBurst: (id: number) => void
  /** Follow the app onto another city — its own karma, from its own record. */
  switchTo: (mapId: string) => void
}

export function useScore(initialMapId: string): ScoreApi {
  const mapIdRef = useRef(initialMapId)
  const [data, setData] = useState<Persisted>(() => loadFor(initialMapId))
  const [bursts, setBursts] = useState<Burst[]>([])
  const burstSeq = useRef(0)
  // History is sampled at most once a minute — a wall of samples from one busy minute of edits
  // would make the sparkline noise, not a trend.
  const lastSampleRef = useRef(0)

  const persist = useCallback((next: Persisted) => {
    const store = readStore()
    store[mapIdRef.current] = next
    writeStore(store)
  }, [])

  const award = useCallback(
    (award: Award) => {
      // An award worth nothing still has a sign to honour but nothing to say — drop it rather than
      // firing an empty burst.
      if (award.points === 0 && award.reactions === 0) return
      setData(prev => {
        const points = prev.points + award.points
        const breakdown = { ...prev.breakdown, [award.category]: prev.breakdown[award.category] + award.points }
        const now = Date.now()
        // now can't be read at module load, so sample time is stamped here where it's a real event.
        const history =
          now - lastSampleRef.current > 60_000
            ? [...prev.history, { at: now, score: points }].slice(-MAX_HISTORY)
            : prev.history
        if (history !== prev.history) lastSampleRef.current = now
        const cheering = award.points >= 0
        const next: Persisted = {
          points,
          cheers: prev.cheers + (cheering ? award.reactions : 0),
          jeers: prev.jeers + (cheering ? 0 : award.reactions),
          breakdown,
          history,
          at: now,
        }
        persist(next)
        return next
      })
      const id = burstSeq.current++
      setBursts(prev => [...prev, { id, points: award.points, reactions: award.reactions }])
    },
    [persist],
  )

  const clearBurst = useCallback((id: number) => {
    setBursts(prev => prev.filter(b => b.id !== id))
  }, [])

  const reset = useCallback(() => {
    const next = { ...empty(), at: Date.now() }
    lastSampleRef.current = 0
    setData(next)
    persist(next)
  }, [persist])

  const switchTo = useCallback((mapId: string) => {
    if (mapId === mapIdRef.current) return
    mapIdRef.current = mapId
    lastSampleRef.current = 0
    // Any faces still in flight belong to the city being left behind.
    setBursts([])
    setData(loadFor(mapId))
  }, [])

  return {
    points: data.points,
    cheers: data.cheers,
    jeers: data.jeers,
    breakdown: data.breakdown,
    history: data.history,
    bursts,
    award,
    reset,
    clearBurst,
    switchTo,
  }
}
