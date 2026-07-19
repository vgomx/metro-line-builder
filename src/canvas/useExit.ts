import { useEffect, useRef, useState } from 'react'

let exitSeq = 0

export interface ExitGhost<T> {
  key: string
  id: string
  data: T
}

/**
 * Detects entities that have just left `items` and hands back a ghost of each — its
 * last-known data — so a removal can shrink or fade out instead of blinking away. Each
 * ghost clears itself after `durationMs`.
 *
 * `items` is rebuilt every render (that's fine); the last committed map is what a removal
 * is diffed against, so the ghost carries the entity's final geometry, not a blank.
 *
 * "Last known" means after every render, not after every change to the id set. Keying this on
 * the ids alone meant an entity that moved without anything being added or removed never had
 * its new position recorded — so deleting a landmark you'd just dragged played its exit at the
 * position it was dragged from, and deleting a line whose station had shifted shattered along
 * the route it used to take. Whether it looked right came down to whether something unrelated
 * had been added in between, which is what made it seem intermittent.
 */
export function useExit<T>(items: Map<string, T>, durationMs: number): ExitGhost<T>[] {
  const committedRef = useRef<Map<string, T>>(new Map())
  const latestRef = useRef(items)
  latestRef.current = items
  const [ghosts, setGhosts] = useState<ExitGhost<T>[]>([])
  const idsKey = [...items.keys()].join(' ')

  // Departures. Keyed on the id set, because that is exactly when one can happen, and the
  // data it reads is whatever the effect below recorded on the previous render — the entity's
  // last position before it left.
  useEffect(() => {
    const prev = committedRef.current
    const curr = latestRef.current
    const removed: ExitGhost<T>[] = []
    for (const [id, data] of prev) {
      if (!curr.has(id)) removed.push({ key: `${id}-${exitSeq++}`, id, data })
    }
    if (removed.length === 0) return

    setGhosts(list => [...list, ...removed])
    for (const ghost of removed) {
      // No cleanup that clears these timers: under StrictMode the effect runs
      // mount→unmount→mount and clearing on the simulated unmount would strand the ghost.
      // A timer firing after a real unmount is a harmless no-op setState.
      setTimeout(() => setGhosts(list => list.filter(g => g.key !== ghost.key)), durationMs)
    }
    // idsKey stands in for the id set; reading items/durationMs fresh each run is intended.
  }, [idsKey, durationMs]) // eslint-disable-line react-hooks/exhaustive-deps

  // The record itself, refreshed after every render rather than only when the id set changes —
  // an entity that merely moved has to have its new position remembered, or the ghost above
  // carries a stale one. Declared second so the departure effect sees the previous render's
  // data before this overwrites it; the two are a pair, and swapping them loses the ghost.
  useEffect(() => {
    committedRef.current = new Map(latestRef.current)
  })

  return ghosts
}
