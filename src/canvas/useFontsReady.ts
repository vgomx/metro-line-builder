import { useEffect, useState } from 'react'

/** A cap so a font that never arrives doesn't leave the flag stuck false forever. */
const FONTS_READY_CAP_MS = 3000

/**
 * False until the label webfont has settled, then true — and it flips at most once.
 *
 * Every label's placement is measured from the real font through a canvas, but at first paint that
 * font may not have loaded yet — a cold iPad Safari is the worst case — so the opening placement
 * pass can be measured against a fallback face and drop a card across a marker. Nothing else forces
 * a second pass on a map left untouched, so that first bad placement would simply stay. Flipping
 * this when the fonts settle re-renders the canvas once with the true metrics, and the placement
 * search runs again against them, replacing the fallback-measured one.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(() => !document.fonts || document.fonts.status === 'loaded')

  useEffect(() => {
    if (ready || !document.fonts) return
    let cancelled = false
    const settle = () => {
      if (!cancelled) setReady(true)
    }
    void document.fonts.ready.then(settle)
    const cap = setTimeout(settle, FONTS_READY_CAP_MS)
    return () => {
      cancelled = true
      clearTimeout(cap)
    }
  }, [ready])

  return ready
}
