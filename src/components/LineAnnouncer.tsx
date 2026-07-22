import { useEffect, useId, useState } from 'react'
import { LineIndicator } from 'metro-ds'
import { buildTextBitmap, CHAR_HEIGHT } from '../canvas/ledFont'
import type { Line } from '../types'

interface LineAnnouncerProps {
  line: Line
  scrollText: string
  /** True while this line's train is being ridden — the chip grows a "Stop" affordance. */
  riding?: boolean
  onStopRide?: () => void
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

/**
 * Two visually-split pieces sharing one lifecycle: a static line chip pinned at
 * bottom-center, and the LED destination sign living in the canvas's bottom-right
 * corner. On selection the LED lights up already lit (no blank scroll-in), scrolls
 * the destination once, then shrinks away exactly like the old morph did — while
 * the chip stays put. Hovering the chip re-lights the LED in the corner and
 * replays the scroll from the start; leaving lets it collapse again. Both
 * animations are pure CSS (max-width reveal + keyframe scroll), so nothing here
 * competes with the train rAF loops. Re-mounts (via the caller's `key`) whenever
 * a different line is selected, replaying the whole sequence.
 */
export function LineAnnouncer({ line, scrollText, riding = false, onStopRide }: LineAnnouncerProps) {
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
  // settled, where it re-lights the corner sign and replays the scroll.
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
    <>
      {/* LED destination sign — top-right corner (clear of toasts/status bar), shrinks away after the scroll */}
      <div
        style={{
          position: 'absolute',
          top: 'var(--space-3)',
          right: 'var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          height: LED_HEIGHT + 8,
          background: '#0a0a0a',
          border: `1px solid ${showLed ? '#2a2a2a' : 'transparent'}`,
          borderRadius: 6,
          boxShadow: showLed ? '0 6px 20px rgba(0,0,0,0.35)' : 'none',
          overflow: 'hidden',
          opacity: showLed ? 1 : 0,
          pointerEvents: 'none',
          transition: `opacity ${MORPH_MS}ms ease, border-color ${MORPH_MS}ms ease, box-shadow ${MORPH_MS}ms ease`,
        }}
      >
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
      </div>

      {/* Static line chip — bottom-center; hovering re-lights the corner sign. On touch there
          is no hover, so the sign could only ever be seen on its one automatic play and a tap
          is the only gesture left to ask for another. It re-lights and then releases itself,
          since no "pointer left" is coming. */}
      <div
        onMouseEnter={() => {
          if (!settled) return
          setReplayCount(n => n + 1)
          setHovering(true)
        }}
        onMouseLeave={() => setHovering(false)}
        onPointerDown={e => {
          if (e.pointerType !== 'touch' || !settled) return
          setReplayCount(n => n + 1)
          setHovering(true)
        }}
        onPointerUp={e => {
          if (e.pointerType === 'touch') setHovering(false)
        }}
        style={{
          position: 'absolute',
          bottom: 'var(--space-3)',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          whiteSpace: 'nowrap',
          height: 28,
          background: 'var(--ink-900)',
          borderRadius: 999,
          boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
          pointerEvents: 'auto',
        }}
      >
        <span style={{ paddingLeft: '6px', paddingTop: '2px', paddingBottom: '2px', flexShrink: 0, display: 'flex' }}>
          <LineIndicator id={String(line.number)} color={line.color} shape="pill" size="xs" />
        </span>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--ink-0)', paddingRight: riding ? '4px' : '12px' }}>
          {line.name}
        </span>
        {/* Riding turns the chip into the ride's own control: a clear way off the train that
            doesn't depend on knowing Escape or where to click. */}
        {riding && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onStopRide?.()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginRight: '4px',
              height: '20px',
              padding: '0 9px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--ink-900)',
              background: 'var(--ink-0)',
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            Stop
          </button>
        )}
      </div>
    </>
  )
}
