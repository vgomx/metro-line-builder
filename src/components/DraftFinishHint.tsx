import { useEffect, useState } from 'react'

interface DraftFinishHintProps {
  /** True once the draft has enough points that Enter and double-click actually finish it. */
  active: boolean
}

/** How long the hint stays before getting out of the way. Ten seconds rather than the five
 * that felt right in the abstract: the pause it has to survive is someone deciding where the
 * next station goes, and that is a thinking pause, not a reading one. */
const VISIBLE_MS = 10000

/**
 * How to finish the line you've started.
 *
 * A drawn line ends on Enter or a double-click and neither announces itself, so the only
 * visible way out has been the Finish button. This offers the other two.
 *
 * It appears at the same moment the button does — two points — because that is when those
 * keys start working. Showing it at the first point would have been an instruction that
 * didn't yet do anything, which is worse than saying nothing.
 *
 * It leaves after a few seconds rather than sitting there: it's a thing to learn once, and
 * the button remains as the durable way out.
 */
export function DraftFinishHint({ active }: DraftFinishHintProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    setVisible(true)
    const timer = window.setTimeout(() => setVisible(false), VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [active])

  if (!visible) return null

  return (
    <div
      style={{
        background: 'var(--ink-900)',
        color: 'var(--ink-0)',
        borderRadius: 'var(--radius-lg)',
        padding: '5px 12px',
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        animation: 'mlb-hint-in 160ms ease both',
      }}
    >
      <strong style={{ fontWeight: 700 }}>Enter</strong> to finish ·{' '}
      <strong style={{ fontWeight: 700 }}>Backspace</strong> to take back a point ·{' '}
      <strong style={{ fontWeight: 700 }}>Esc</strong> to cancel
    </div>
  )
}
