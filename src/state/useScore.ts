import { useCallback, useRef, useState } from 'react'
import type { Award, ScoreCategory } from '../score'

/**
 * The Approval score: a personal record of the network you've built, kept in browser memory.
 *
 * Points are the score; likes are the crowd. Each is banked by category so the panel can show
 * where approval came from, and the running score is sampled into a dated history so you can see
 * it climb over time. `bursts` are the transient hearts-and-points that fly off the badge when an
 * award lands; they carry no history and clean themselves up.
 */

const KEY = 'metro-line-builder:score'
/** Keep the history readable, not exhaustive — old samples fall off. */
const MAX_HISTORY = 250

const EMPTY_BREAKDOWN: Record<ScoreCategory, number> = { lines: 0, stations: 0, operators: 0, placement: 0 }

export interface ScoreSample {
  at: number
  score: number
}

export interface Burst {
  id: number
  points: number
  likes: number
}

interface Persisted {
  points: number
  likes: number
  breakdown: Record<ScoreCategory, number>
  history: ScoreSample[]
}

function load(): Persisted {
  const base: Persisted = { points: 0, likes: 0, breakdown: { ...EMPTY_BREAKDOWN }, history: [] }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw)
    return {
      points: Number(parsed.points) || 0,
      likes: Number(parsed.likes) || 0,
      breakdown: { ...EMPTY_BREAKDOWN, ...(parsed.breakdown ?? {}) },
      history: Array.isArray(parsed.history) ? parsed.history.slice(-MAX_HISTORY) : [],
    }
  } catch {
    return base
  }
}

export interface ScoreApi {
  points: number
  likes: number
  breakdown: Record<ScoreCategory, number>
  history: ScoreSample[]
  bursts: Burst[]
  award: (award: Award) => void
  reset: () => void
  clearBurst: (id: number) => void
}

export function useScore(): ScoreApi {
  const [data, setData] = useState<Persisted>(load)
  const [bursts, setBursts] = useState<Burst[]>([])
  const burstSeq = useRef(0)
  // History is sampled at most once a minute — a wall of samples from one busy minute of edits
  // would make the sparkline noise, not a trend.
  const lastSampleRef = useRef(0)

  const persist = useCallback((next: Persisted) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Non-fatal: the score just won't outlive the session.
    }
  }, [])

  const award = useCallback(
    (award: Award) => {
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
        const next: Persisted = { points, likes: prev.likes + award.likes, breakdown, history }
        persist(next)
        return next
      })
      const id = burstSeq.current++
      setBursts(prev => [...prev, { id, points: award.points, likes: award.likes }])
    },
    [persist],
  )

  const clearBurst = useCallback((id: number) => {
    setBursts(prev => prev.filter(b => b.id !== id))
  }, [])

  const reset = useCallback(() => {
    const next: Persisted = { points: 0, likes: 0, breakdown: { ...EMPTY_BREAKDOWN }, history: [] }
    lastSampleRef.current = 0
    setData(next)
    persist(next)
  }, [persist])

  return {
    points: data.points,
    likes: data.likes,
    breakdown: data.breakdown,
    history: data.history,
    bursts,
    award,
    reset,
    clearBurst,
  }
}
