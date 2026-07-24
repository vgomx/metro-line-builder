import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Burst, ScoreApi, ScoreSample } from '../state/useScore'
import type { ScoreCategory } from '../score'
import { KARMA_COLOR, KarmaFace, toneOf } from '../karmaFaces'
import type { KarmaTone } from '../karmaFaces'

const CATEGORY_LABEL: Record<ScoreCategory, string> = {
  lines: 'Lines & extensions',
  stations: 'Stations',
  operators: 'Operators',
  placement: 'Great placement',
}

function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

/** A signed figure with a real minus sign rather than a hyphen, since these are set beside the
 * tabular score and a hyphen reads short next to it. */
function signed(points: number): string {
  return `${points < 0 ? '−' : '+'}${Math.abs(points).toLocaleString()}`
}

/** Karma in the black reads green, in the red reads red. Exactly nothing is neither, and colouring
 * it either way would claim a verdict the score hasn't reached yet. */
function karmaColor(value: number): string {
  if (value === 0) return 'var(--text-primary)'
  return value < 0 ? KARMA_COLOR.cross : KARMA_COLOR.glad
}

/**
 * A figure whose digits drop into place one after another, left to right.
 *
 * Keyed on the text so a score that moves while the panel is open lands again rather than silently
 * changing — the same reasoning as the badge's own pop. Each character is its own inline-block
 * because a transform needs a box to act on, and the stagger is an inline delay per index.
 */
function FallingNumber({ text, style }: { text: string; style?: CSSProperties }) {
  return (
    <span key={text} style={{ display: 'inline-flex', fontVariantNumeric: 'tabular-nums', ...style }}>
      {[...text].map((char, i) => (
        <span key={i} className="mlb-digit-fall" style={{ animationDelay: `${i * 45}ms` }}>
          {char}
        </span>
      ))}
    </span>
  )
}

/**
 * The Karma badge: what the network makes of you, tucked in the bottom corner, with the crowd
 * flying off it as faces whenever it moves — smiling when you build, furious when you tear down.
 * The badge itself wears whichever face your running total has earned. Clicking opens a panel that
 * breaks the score down by where it came from and charts it over time, zero line and all.
 */
export function ScoreBadge({ api }: { api: ScoreApi }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const tone = toneOf(api.points)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, pointerEvents: 'auto' }}>
      {/* The crowd, taking flight off the badge — a little stream of faces per award, anchored to
          the face on the badge so they lift right off it. */}
      <div style={{ position: 'absolute', left: '12px', bottom: '14px', width: 0, height: 0, pointerEvents: 'none', zIndex: 30 }}>
        {api.bursts.map(burst => (
          <BurstFlight key={burst.id} burst={burst} onDone={() => api.clearBurst(burst.id)} />
        ))}
      </div>

      <button
        type="button"
        className="mlb-score-btn"
        onClick={() => setOpen(o => !o)}
        aria-label={`Karma ${api.points}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: '28px',
          boxSizing: 'border-box',
          padding: '0 11px 0 9px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer',
        }}
      >
        <KarmaFace tone={tone} size={15} />
        <span key={api.points} className="mlb-score-pop" style={{ display: 'inline-flex', alignItems: 'baseline', gap: '3px' }}>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              // Signed, so the standing is legible before the number is read at all.
              color: karmaColor(api.points),
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {api.points.toLocaleString()}
          </span>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>karma</span>
        </span>
      </button>

      {open && <ScorePanel api={api} onReset={api.reset} />}
    </div>
  )
}

function BurstFlight({ burst, onDone }: { burst: Burst; onDone: () => void }) {
  const tone: KarmaTone = burst.points < 0 ? 'cross' : 'glad'
  // Fix each face's random path once, on mount — re-rolling every render would make them jitter.
  const faces = useRef(
    Array.from({ length: Math.max(6, Math.min(20, Math.round(burst.reactions / 32))) }, () => ({
      dx: Math.round((Math.random() - 0.5) * 84),
      dy: -70 - Math.round(Math.random() * 70),
      rot: Math.round((Math.random() - 0.5) * 60),
      size: 13 + Math.round(Math.random() * 11),
      delay: Math.round(Math.random() * 480),
      duration: 1100 + Math.round(Math.random() * 900),
      startX: Math.round((Math.random() - 0.5) * 16),
    })),
  ).current

  useEffect(() => {
    const timer = window.setTimeout(onDone, 2200)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div
        className="mlb-gain-float"
        style={{
          position: 'absolute',
          left: '-2px',
          bottom: '2px',
          whiteSpace: 'nowrap',
          fontSize: '13px',
          fontWeight: 800,
          color: KARMA_COLOR[tone],
        }}
      >
        {signed(burst.points)}
      </div>
      {faces.map((f, i) => (
        <span
          key={i}
          className="mlb-face-rise"
          style={{
            position: 'absolute',
            left: `${f.startX}px`,
            bottom: 0,
            display: 'flex',
            // @ts-expect-error CSS custom properties
            '--dx': `${f.dx}px`,
            '--dy': `${f.dy}px`,
            '--rot': `${f.rot}deg`,
            animationDelay: `${f.delay}ms`,
            animationDuration: `${f.duration}ms`,
          }}
        >
          <KarmaFace tone={tone} size={f.size} />
        </span>
      ))}
    </>
  )
}

function ScorePanel({ api, onReset }: { api: ScoreApi; onReset: () => void }) {
  const now = Date.now()
  const total = api.points
  const tone = toneOf(total)
  // A category is worth a row whichever way it went — a line of nothing but closures is exactly
  // what someone opening this panel wants to see.
  const categories = (Object.keys(CATEGORY_LABEL) as ScoreCategory[]).filter(c => api.breakdown[c] !== 0)

  return (
    <div
      className="mlb-panel-pop"
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        right: 0,
        width: '300px',
        maxWidth: 'calc(100vw - 24px)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <KarmaFace tone={tone} size={24} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <FallingNumber
            text={total.toLocaleString()}
            style={{ fontSize: '20px', fontWeight: 800, lineHeight: 1, color: karmaColor(total) }}
          />
          <span style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '3px' }}>
            Karma · {api.cheers.toLocaleString()} cheered · {api.jeers.toLocaleString()} furious
          </span>
        </div>
      </div>

      <Sparkline history={api.history} current={total} />

      <div style={{ padding: '4px 0' }}>
        {categories.length === 0 ? (
          <div style={{ padding: '14px', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Build a line, place a stop, found an operator — karma starts here.
          </div>
        ) : (
          categories.map(cat => (
            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: 'var(--text-xs)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{CATEGORY_LABEL[cat]}</span>
              <span
                style={{ color: karmaColor(api.breakdown[cat]), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
              >
                {signed(api.breakdown[cat])}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderTop: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {api.history.length > 1 ? `Since ${ago(api.history[0].at, now)}` : 'Your personal record'}
        </span>
        <button
          type="button"
          onClick={onReset}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', cursor: 'pointer', padding: 0 }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

/**
 * A quiet line of the score moving. The current total is appended so the line always ends at where
 * the badge sits, even between the once-a-minute history samples.
 *
 * Once karma can go negative the chart needs a zero to be read against — a line that only ever
 * falls looks identical to one that only ever climbs without it. The rule is drawn only when the
 * span actually crosses zero, so a map that has never been in the red keeps the plain sparkline.
 */
function Sparkline({ history, current }: { history: ScoreSample[]; current: number }) {
  const points = [...history.map(h => h.score), current]
  if (points.length < 3) {
    return <div style={{ height: '2px' }} />
  }
  const w = 300
  const h = 44
  const pad = 6
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const step = (w - pad * 2) / (points.length - 1)
  const yOf = (p: number) => h - pad - ((p - min) / span) * (h - pad * 2)
  const coords = points.map((p, i) => `${(pad + i * step).toFixed(1)},${yOf(p).toFixed(1)}`)
  const crossesZero = min < 0 && max > 0
  const stroke = current < 0 ? KARMA_COLOR.cross : KARMA_COLOR.glad
  return (
    <div style={{ padding: '8px 0 4px', borderBottom: '1px solid var(--border-subtle)' }}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {crossesZero && (
          <line x1={pad} x2={w - pad} y1={yOf(0)} y2={yOf(0)} stroke="var(--border-default)" strokeWidth="1" strokeDasharray="3 3" />
        )}
        <polyline points={coords.join(' ')} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pad + (points.length - 1) * step} cy={yOf(current)} r="2.5" fill={stroke} />
      </svg>
    </div>
  )
}
