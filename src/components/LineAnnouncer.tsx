import { useEffect, useId, useState } from 'react'
import { LineIndicator } from 'metro-ds'
import { buildTextBitmap, CHAR_HEIGHT } from '../canvas/ledFont'
import type { Line } from '../types'

interface LineAnnouncerProps {
  line: Line
  scrollText: string
}

// Real LED destination signs are amber regardless of the service's route color —
// keeps the dots high-contrast against the dark housing no matter which line lit it up.
const LED_COLOR = '#FFB300'

const DOT_PITCH = 4
const DOT_RADIUS = 1
const VIEWPORT_COLS = 26
const MIN_SCROLL_SECONDS = 2.5
const COLS_PER_SECOND = 9
const MORPH_MS = 420

const LED_WIDTH = VIEWPORT_COLS * DOT_PITCH
const LED_HEIGHT = CHAR_HEIGHT * DOT_PITCH
const SETTLED_HEIGHT = 28
const SETTLED_MAX_WIDTH = 220

function shortLineLabel(name: string): string {
  const trimmed = name.trim()
  const trailingNumber = trimmed.match(/(\d+)\s*$/)
  if (trailingNumber) return trailingNumber[1]
  return trimmed.charAt(0).toUpperCase() || '•'
}

/**
 * Appears as a destination-sign LED marquee when a line is selected, already lit
 * (no blank scroll-in), scrolls once, then morphs — same housing div, never
 * unmounts — into a small persistent LineIndicator chip instead of fading out and
 * being replaced by a separate element. Hovering the settled chip morphs it back
 * into the LED marquee (replaying the scroll) as a way to re-read the full
 * destination text on demand; leaving reverts to the chip. The width change is a
 * max-width reveal rather than a measured JS width, so it's a pure CSS transition;
 * the LED scroll itself is also CSS-driven, not per-frame JS, so none of this
 * competes with the train rAF animations. Re-mounts (via the caller's `key`)
 * whenever a different line is selected, replaying the whole sequence.
 */
export function LineAnnouncer({ line, scrollText }: LineAnnouncerProps) {
  const [settled, setSettled] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [replayCount, setReplayCount] = useState(0)
  const idPrefix = useId().replace(/[^a-zA-Z0-9]/g, '')

  const bitmap = buildTextBitmap(scrollText)
  const textCols = bitmap[0]?.length ?? 0
  const trackWidth = textCols * DOT_PITCH
  const scrollSeconds = Math.max(MIN_SCROLL_SECONDS, textCols / COLS_PER_SECOND)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), scrollSeconds * 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // While unsettled the marquee is already playing; hovering only matters once
  // settled, where it re-reveals the LED and replays the scroll from the start.
  const showLed = !settled || hovering
  const animationName = `led-scroll-${idPrefix}-${replayCount}`

  const backgroundDots = []
  for (let r = 0; r < CHAR_HEIGHT; r++) {
    for (let c = 0; c < VIEWPORT_COLS; c++) {
      backgroundDots.push(
        <circle
          key={`bg-${r}-${c}`}
          cx={c * DOT_PITCH + DOT_PITCH / 2}
          cy={r * DOT_PITCH + DOT_PITCH / 2}
          r={DOT_RADIUS}
          fill="var(--ink-600)"
          opacity={0.4}
        />,
      )
    }
  }

  const textDots = []
  for (let r = 0; r < CHAR_HEIGHT; r++) {
    for (let c = 0; c < textCols; c++) {
      if (bitmap[r][c]) {
        textDots.push(
          <circle
            key={`tx-${r}-${c}`}
            cx={c * DOT_PITCH + DOT_PITCH / 2}
            cy={r * DOT_PITCH + DOT_PITCH / 2}
            r={DOT_RADIUS}
            fill={LED_COLOR}
          />,
        )
      }
    }
  }

  return (
    <div
      onMouseEnter={() => {
        if (!settled) return
        setReplayCount(n => n + 1)
        setHovering(true)
      }}
      onMouseLeave={() => setHovering(false)}
      style={{
        position: 'absolute',
        bottom: 'var(--space-3)',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        height: showLed ? LED_HEIGHT + 8 : SETTLED_HEIGHT,
        background: showLed ? '#0a0a0a' : 'var(--ink-900)',
        border: showLed ? '1px solid #2a2a2a' : '1px solid transparent',
        borderRadius: showLed ? 6 : 999,
        boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        transition: `height ${MORPH_MS}ms ease, background ${MORPH_MS}ms ease, border-radius ${MORPH_MS}ms ease, border-color ${MORPH_MS}ms ease`,
      }}
    >
      {/* LED phase — shrinks away once settled, reveals again on hover */}
      <div
        style={{
          maxWidth: showLed ? LED_WIDTH + 10 : 0,
          opacity: showLed ? 1 : 0,
          overflow: 'hidden',
          transition: `max-width ${MORPH_MS}ms ease, opacity 200ms ease`,
        }}
      >
        <svg width={LED_WIDTH} height={LED_HEIGHT} style={{ display: 'block', margin: '0 5px' }}>
          <style>{`
            @keyframes ${animationName} {
              from { transform: translateX(0); }
              to { transform: translateX(${-trackWidth}px); }
            }
          `}</style>
          <g>{backgroundDots}</g>
          <g key={animationName} style={{ animation: `${animationName} ${scrollSeconds}s linear` }}>
            {textDots}
          </g>
        </svg>
      </div>

      {/* Settled chip — grows in once the LED phase is done, hides again on hover */}
      <div
        style={{
          maxWidth: showLed ? 0 : SETTLED_MAX_WIDTH,
          opacity: showLed ? 0 : 1,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          whiteSpace: 'nowrap',
          transition: `max-width ${MORPH_MS}ms ease, opacity 240ms ease ${showLed ? 0 : MORPH_MS - 200}ms`,
        }}
      >
        <span style={{ paddingLeft: '6px', paddingTop: '2px', paddingBottom: '2px', flexShrink: 0, display: 'flex' }}>
          <LineIndicator id={shortLineLabel(line.name)} color={line.color} size="xs" />
        </span>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--ink-0)', paddingRight: '12px' }}>
          {line.name}
        </span>
      </div>
    </div>
  )
}
