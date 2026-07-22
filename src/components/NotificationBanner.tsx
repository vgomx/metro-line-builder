import { useState } from 'react'
import type { Notification } from '../state/useNotifications'

/** How long a headline holds at the top of the canvas before retiring itself to the panel. Long
 * enough to read a sentence, short enough that a run of edits doesn't build a wall. This is also
 * the countdown bar's duration — the bar finishing is what dismisses the headline, so hovering,
 * which pauses the bar, pauses the clock with it and never yanks away something being read. */
const HOLD_MS = 7000

interface NotificationBannerProps {
  items: Notification[]
  onDismiss: (id: string) => void
}

/**
 * The Gazette's front page: the most recent headlines, stacked at the top of the canvas. Each
 * counts itself down and retires to the panel behind the top-bar icon, where the whole run stays
 * readable. Non-interactive except for the dismiss button, so it never eats a click meant for the
 * map beneath it.
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

  return (
    <div
      className="mlb-banner-in"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        position: 'relative',
        // Clips the countdown bar to the card's rounded corners.
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        padding: '9px 12px 12px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        {/* The masthead is the Gazette's logo — a blackletter, set in title case, because
            blackletter capitals are near-illegible and the whole point is that it reads as a
            newspaper's nameplate rather than a UI label. */}
        <span
          style={{
            fontFamily: "'UnifrakturMaguntia', 'Times New Roman', serif",
            fontSize: '16px',
            lineHeight: 1.1,
            color: 'var(--text-primary)',
          }}
        >
          The Transit Gazette
        </span>
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

      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.35 }}>
        {item.text}
      </div>

      {/* The clock. Its end is the dismissal, so the two can't drift apart, and pausing it on
          hover pauses the headline's life with it. */}
      <div
        aria-hidden
        className="mlb-gazette-timer"
        onAnimationEnd={() => onDismiss(item.id)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '3px',
          background: 'var(--text-muted)',
          opacity: 0.45,
          animationPlayState: paused ? 'paused' : 'running',
          ['--gazette-hold' as string]: `${HOLD_MS}ms`,
        }}
      />
    </div>
  )
}
