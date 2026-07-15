import { useMemo, useState } from 'react'

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

const BASE_FONT_SIZE = 15
const LINE_HEIGHT = 1.05
const BASE_GAP = 8
const MAX_TEXT_WIDTH = 74
// Scaling targets a bit under the hard cap — canvas-measured text and the
// browser's actual CSS layout never match to the pixel, so aiming for the
// exact edge occasionally lets the widest word land a hair over MAX_TEXT_WIDTH
// and fall back to a mid-word wrap that a small margin would have avoided.
const SAFE_TARGET_WIDTH = MAX_TEXT_WIDTH * 0.92
const MIN_SCALE = 0.5
// A condensed face keeps words narrow, which lets long names sit at full size
// more often — but the mark's real footprint is its height (word count ×
// font-size), not width, so staying narrow just means it stays tall too. The
// regular-width sans trips the width-based scale-down sooner, which shrinks
// the font (and with it, the height) even for names that would otherwise
// never trigger it.
const WORDMARK_FONT = 'var(--font-sans)'

let measureCanvas: HTMLCanvasElement | null = null
let resolvedWordmarkFont: string | null = null

/** Canvas 2D's `font` property can't resolve a CSS custom property the way an
 * element's `fontFamily` style can — `var(--font-sans)` would just be ignored
 * and silently fall back to the canvas default, breaking the measurement.
 * Resolving it once against the real DOM keeps the two in sync regardless of
 * what the token's underlying font stack is. */
function resolveWordmarkFont(): string {
  if (resolvedWordmarkFont) return resolvedWordmarkFont
  const value = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
  resolvedWordmarkFont = value || 'sans-serif'
  return resolvedWordmarkFont
}

/** Widest single word at BASE_FONT_SIZE, using the same font stack the wordmark
 * renders with — real glyph metrics instead of a guessed average-char-width,
 * so the scale-to-fit below stays accurate whichever font actually loads.
 * Canvas measureText doesn't apply letter-spacing, so that's added back in by
 * hand; matching the CSS width exactly isn't possible (font hinting and
 * subpixel rounding differ from canvas to layout), so the scale this feeds
 * into targets a bit under MAX_TEXT_WIDTH rather than the exact edge. */
function widestWordPx(words: string[]): number {
  const letterSpacing = BASE_FONT_SIZE * 0.01
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const context = measureCanvas.getContext('2d')
  if (!context) return words.reduce((max, w) => Math.max(max, w.length), 0) * BASE_FONT_SIZE * 0.55
  context.font = `700 ${BASE_FONT_SIZE}px ${resolveWordmarkFont()}`
  return words.reduce((max, w) => {
    const upper = w.toUpperCase()
    const width = context.measureText(upper).width + Math.max(0, upper.length - 1) * letterSpacing
    return Math.max(max, width)
  }, 0)
}

/** Wordmark lockup — a placeholder mark on the left (stands in for a future
 * per-map logo) beside the name stacked word-per-word, left-aligned, like a
 * vertical transit-authority nameplate. The icon is a 1:1 square sized to
 * match the text stack's own rendered height, so it's never an arbitrary
 * fixed shape — and since that height comes from the same font-size and word
 * count driving the text, the icon shrinks and grows in lockstep with it
 * automatically, whether the trigger is a long word or just more lines. Reads
 * as neutral, translucent chrome until hovered, when it takes on the app's
 * brand color like a real logo would. */
function AuthorityMark({ name }: { name: string }) {
  const [hovered, setHovered] = useState(false)
  const accent = hovered ? 'var(--interactive-primary)' : 'var(--text-secondary)'
  const words = useMemo(() => `${name} Transit Authority`.split(/\s+/).filter(Boolean), [name])

  const scale = useMemo(() => {
    const widest = widestWordPx(words)
    return widest <= SAFE_TARGET_WIDTH ? 1 : Math.max(MIN_SCALE, SAFE_TARGET_WIDTH / widest)
  }, [words])

  const fontSize = BASE_FONT_SIZE * scale
  const iconSize = words.length * fontSize * LINE_HEIGHT

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${BASE_GAP * scale}px`,
        opacity: hovered ? 1 : 0.55,
        cursor: 'default',
        pointerEvents: 'auto',
        transition: 'opacity 150ms ease, gap 150ms ease',
      }}
    >
      {/* Logo mark — a 2×2 grid of the authority's transport modes (metro, bus, tram,
          ferry), a 1:1 slot matching the text's height. Placeholder for a future
          per-map logo, but reads as a real multi-modal transit emblem in the meantime. */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        style={{ flexShrink: 0, transition: 'width 150ms ease, height 150ms ease' }}
      >
        <g
          stroke={accent}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{ transition: 'stroke 150ms ease' }}
        >
          {/* Metro (train front) — top-left */}
          <rect x="3.5" y="2.5" width="9" height="10" rx="3" />
          <line x1="4.7" y1="6.4" x2="11.3" y2="6.4" />
          {/* Bus (side) — top-right */}
          <rect x="18.3" y="3.8" width="11.4" height="6.6" rx="1.6" />
          <line x1="19.3" y1="6.3" x2="28.7" y2="6.3" />
          {/* Tram (side, with overhead pole) — bottom-left */}
          <rect x="3.2" y="20.6" width="9.6" height="6.6" rx="1.6" />
          <line x1="4.1" y1="23" x2="11.9" y2="23" />
          <path d="M8 20.6 V17.8 M5.9 17.8 H10.1" />
          {/* Ferry — bottom-right (centered on the quadrant like the other three) */}
          <rect x="21.8" y="19.2" width="4.4" height="3.4" rx="0.6" />
          <path d="M18.4 22.6 H29.6 L27.6 26.6 H20.4 Z" />
          <path d="M18.9 27.8 q1.7 -1 3.4 0 t3.4 0 t3.4 0" />
        </g>
        <g fill={accent} stroke="none" style={{ transition: 'fill 150ms ease' }}>
          {/* Metro headlights */}
          <circle cx="6" cy="10.2" r="0.9" />
          <circle cx="10" cy="10.2" r="0.9" />
          {/* Bus wheels */}
          <circle cx="21" cy="11.4" r="1" />
          <circle cx="27" cy="11.4" r="1" />
          {/* Tram wheels */}
          <circle cx="5.6" cy="27.9" r="1" />
          <circle cx="10.4" cy="27.9" r="1" />
        </g>
      </svg>

      <div
        style={{
          maxWidth: `${MAX_TEXT_WIDTH}px`,
          fontFamily: WORDMARK_FONT,
          fontWeight: 700,
          fontSize: `${fontSize}px`,
          letterSpacing: '0.01em',
          textTransform: 'uppercase',
          color: accent,
          transition: 'color 150ms ease, font-size 150ms ease',
        }}
      >
        {words.map((word, i) => (
          <div key={i} style={{ lineHeight: LINE_HEIGHT, textAlign: 'left', overflowWrap: 'anywhere' }}>
            {word}
          </div>
        ))}
      </div>
    </div>
  )
}
