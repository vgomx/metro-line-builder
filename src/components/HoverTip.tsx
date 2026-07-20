import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

interface HoverTipProps {
  /** What the control is. A trailing "(V)" is pulled out and drawn as a key. */
  label: string
  /** Which side of the control the tip sits on. */
  placement?: 'right' | 'bottom'
  /** Merged into the wrapper, so a tipped control can still take part in a flex row. */
  style?: CSSProperties
  children: ReactNode
}

/** Long enough that sweeping across a toolbar doesn't strobe, short enough that a deliberate
 * hover doesn't feel like waiting. The platform's own is around a second, which is most of
 * why it feels unresponsive. */
const SHOW_DELAY_MS = 320

/** Splits "Draw line (P)" into its name and its shortcut key. */
function splitShortcut(label: string): { name: string; key: string | null } {
  const match = label.match(/^(.*?)\s*\(([^)]+)\)$/)
  return match ? { name: match[1], key: match[2] } : { name: label, key: null }
}

/**
 * The app's own tooltip for icon-only controls.
 *
 * The platform's is a poor fit for a drawing tool: it waits about a second, ignores the
 * app's theme and type, can't show a keyboard shortcut as anything but more text, and on a
 * dense toolbar it arrives long after the pointer has moved on. This one is quick, themed,
 * and gives the shortcut its own key cap.
 *
 * It also strips the native `title` from whatever it wraps. The design system's IconButton
 * sets one from its label and offers no way to opt out, so without this every control would
 * show both tips — ours immediately and the platform's a beat later, saying the same thing
 * twice in two different type faces. The attribute is removed after every render because
 * React puts it back whenever the label changes; the accessible name is unaffected, since
 * that comes from aria-label, which stays.
 */
export function HoverTip({ label, placement = 'right', style, children }: HoverTipProps) {
  const [visible, setVisible] = useState(false)
  const wrapper = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const { name, key } = splitShortcut(label)

  useEffect(() => {
    for (const el of wrapper.current?.querySelectorAll('[title]') ?? []) el.removeAttribute('title')
  })

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const show = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setVisible(false)
  }

  return (
    <span
      ref={wrapper}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      onMouseEnter={show}
      onMouseLeave={hide}
      // Pressing the control is an answer in itself: the tip has done its job and gets out of
      // the way rather than hanging over what was just clicked.
      onMouseDown={hide}
    >
      {children}
      {visible && (
        // Two spans, because the outer one's transform is doing the centring and the entrance
        // animates a transform too — on one element the animation would win and the tip would
        // jump out of alignment as it appeared.
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 40,
            pointerEvents: 'none',
            ...(placement === 'bottom'
              ? { top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' }
              : { left: 'calc(100% + 10px)', top: '50%', transform: 'translateY(-50%)' }),
          }}
        >
          <span
            className={placement === 'bottom' ? 'mlb-tip-down' : 'mlb-tip-right'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--ink-900)',
              color: 'var(--ink-0)',
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {name}
            {key && (
              <span
                style={{
                  padding: '1px 5px',
                  borderRadius: '3px',
                  background: 'rgba(255, 255, 255, 0.16)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  lineHeight: 1.5,
                }}
              >
                {key}
              </span>
            )}
          </span>
        </span>
      )}
    </span>
  )
}
