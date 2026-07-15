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
 */
export function useExit<T>(items: Map<string, T>, durationMs: number): ExitGhost<T>[] {
  const committedRef = useRef<Map<string, T>>(new Map())
  const latestRef = useRef(items)
  latestRef.current = items
  const [ghosts, setGhosts] = useState<ExitGhost<T>[]>([])
  const idsKey = [...items.keys()].join(' ')

  useEffect(() => {
    const prev = committedRef.current
    const curr = latestRef.current
    const removed: ExitGhost<T>[] = []
    for (const [id, data] of prev) {
      if (!curr.has(id)) removed.push({ key: `${id}-${exitSeq++}`, id, data })
    }
    committedRef.current = new Map(curr)
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

  return ghosts
}
