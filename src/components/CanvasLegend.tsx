import { useMemo, useState } from 'react'
import { AuthoritySealIcon } from '../authoritySeal'

interface CanvasLegendProps {
  mapName: string
  authorityName: string
}

/**
 * Map key, sitting at the foot of the right-hand column beneath the panel. Will eventually
 * grow a symbol key and a line key above the authority mark below — kept monochrome and
 * translucent by default so it doesn't compete with the map itself, picking up color
 * only on hover so it reads as a deliberate branding detail rather than another UI panel.
 * Laid out by the column that owns it rather than pinning itself to a corner, so it stays
 * put as the panel above it flexes.
 */
export function CanvasLegend({ mapName, authorityName }: CanvasLegendProps) {
  const primaryName = authorityName.trim() || mapName.trim() || 'Untitled Map'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 'var(--gap-sm)',
        flexShrink: 0,
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
  // A finger never hovers, so on a tablet this sat at 55% in muted grey forever and the
  // designed state was simply unreachable. The class lets the touch block hand it the
  // hovered opacity permanently — it's a mark on the map, not a control, so nothing is lost
  // by it just being legible.
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
      className="mlb-authority-mark"
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
      {/* The authority's seal, at a 1:1 slot matching the text's height. Same emblem the journey
          planner and the company picker show — one drawing, so the mark can't drift. */}
      <AuthoritySealIcon
        size={iconSize}
        color={accent}
        style={{ transition: 'width 150ms ease, height 150ms ease' }}
      />

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
