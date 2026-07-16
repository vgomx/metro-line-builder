import { useCallback, useState } from 'react'
import { isSoundEnabled, playSound, setSoundEnabled } from './sound'

/**
 * Mirrors the sound module's on/off flag into React so the toolbar can render it. The module
 * stays the source of truth because playSound is called from event handlers rather than from
 * renders; this only drives the toggle's icon.
 *
 * The flag is flipped synchronously rather than in an effect, which is what lets the
 * confirmation tick below be heard — deferring it would leave the flag still false, and the
 * sound announcing that sound is back on would be swallowed by the very flag it announces.
 */
export function useSound() {
  const [soundEnabled, setEnabled] = useState(isSoundEnabled)

  const toggleSound = useCallback(() => {
    const next = !isSoundEnabled()
    setSoundEnabled(next)
    setEnabled(next)
    if (next) playSound('toggle')
  }, [])

  return { soundEnabled, toggleSound }
}
