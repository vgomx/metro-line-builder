import { useEffect, useRef, useState } from 'react'
import { NewspaperIcon } from '../icons'
import type { Notification } from '../state/useNotifications'

/** How long a headline holds at the top of the canvas before retiring itself to the panel. Long
 * enough to read a sentence, short enough that a run of edits doesn't build a wall. Hovering
 * pauses it, so a headline being read is never yanked away. */
const HOLD_MS = 7000

interface NotificationBannerProps {
  items: Notification[]
  onDismiss: (id: string) => void
}

/**
 * The Gazette's front page: the most recent headlines, stacked at the top of the canvas. Each
 * retires itself after a spell (and can be dismissed at once with the ×), dropping back to the
 * panel behind the top-bar icon where the whole run stays readable. Non-interactive except for
 * the dismiss button, so it never eats a click meant for the map beneath it.
 */
export function NotificationBanner({ items, onDismiss }: NotificationBannerProps) {
  if (items.length === 0) return null
  return (
    <div
      style={{
        position: 'absolute',
        top: 'var(--space-3)',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: 'min(440px, calc(100% - 32px))',
        pointerEvents: 'none',
      }}
    >
      {items.map(item => (
        <BannerCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function BannerCard({ item, onDismiss }: { item: Notification; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    if (paused) return
    const timer = window.setTimeout(() => dismissRef.current(item.id), HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [item.id, paused])

  return (
    <div
      className="mlb-banner-in"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 12px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderLeft: '3px solid var(--interactive-primary)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        pointerEvents: 'auto',
      }}
    >
      <span style={{ color: 'var(--interactive-primary)', display: 'flex', marginTop: '1px', flexShrink: 0 }}>
        <NewspaperIcon />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: '2px',
          }}
        >
          The Transit Gazette
        </div>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35 }}>
          {item.text}
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(item.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          flexShrink: 0,
          background: 'none',
          border: 'none',
          borderRadius: '4px',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
