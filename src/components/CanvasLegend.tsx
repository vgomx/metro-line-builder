import { useState } from 'react'

interface CanvasLegendProps {
  mapName: string
  authorityName: string
}

/**
 * Floating key anchored to the canvas's bottom-right corner. Will eventually grow a
 * symbol key and a line key above the authority mark below — kept monochrome and
 * translucent by default so it doesn't compete with the map itself, picking up color
 * only on hover so it reads as a deliberate branding detail rather than another UI panel.
 */
export function CanvasLegend({ mapName, authorityName }: CanvasLegendProps) {
  const primaryName = authorityName.trim() || mapName.trim() || 'Untitled Map'

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'var(--space-3)',
        right: 'var(--space-3)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 'var(--gap-sm)',
        pointerEvents: 'none',
      }}
    >
      <AuthorityMark name={primaryName} />
    </div>
  )
}

/** Wordmark lockup — a placeholder mark on the left (stands in for a future
 * per-map logo) beside the name stacked word-per-word, left-aligned, like a
 * vertical transit-authority nameplate. Reads as neutral, translucent chrome
 * until hovered, when it takes on the app's brand color like a real logo would. */
function AuthorityMark({ name }: { name: string }) {
  const [hovered, setHovered] = useState(false)
  const accent = hovered ? 'var(--interactive-primary)' : 'var(--text-secondary)'
  const words = `${name} Transit Authority`.split(/\s+/).filter(Boolean)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        opacity: hovered ? 1 : 0.55,
        cursor: 'default',
        pointerEvents: 'auto',
        transition: 'opacity 150ms ease',
      }}
    >
      {/* Placeholder for a future per-map logo mark */}
      <svg width="30" height="46" viewBox="0 0 30 46" style={{ flexShrink: 0 }}>
        <rect x="1.5" y="1.5" width="27" height="43" rx="4" fill="none" stroke={accent} strokeWidth="2" style={{ transition: 'stroke 150ms ease' }} />
        <circle cx="15" cy="23" r="8.5" fill="none" stroke={accent} strokeWidth="2" style={{ transition: 'stroke 150ms ease' }} />
      </svg>

      <div
        style={{
          fontFamily: "'Barlow Condensed', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: '15px',
          letterSpacing: '0.01em',
          textTransform: 'uppercase',
          color: accent,
          transition: 'color 150ms ease',
        }}
      >
        {words.map((word, i) => (
          <div key={i} style={{ lineHeight: 1.05, textAlign: 'left' }}>
            {word}
          </div>
        ))}
      </div>
    </div>
  )
}
