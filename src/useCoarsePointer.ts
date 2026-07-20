import { useEffect, useState } from 'react'

const QUERY = '(pointer: coarse)'

/**
 * True when the primary pointer is a finger rather than a mouse.
 *
 * Used to decide the things that genuinely differ between the two — whether a tooltip can
 * wait for a hover that will never come, whether a 28px button is big enough, whether a
 * shortcut key is worth printing. Not used for layout, which follows viewport width instead:
 * a tablet with a trackpad is still a tablet-sized screen, and a touchscreen laptop is not.
 *
 * Live rather than read once, because a tablet gains and loses a pointer every time its
 * keyboard case is attached.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)

  useEffect(() => {
    const query = window.matchMedia(QUERY)
    const onChange = () => setCoarse(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return coarse
}
