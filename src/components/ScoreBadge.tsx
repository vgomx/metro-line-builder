import { useEffect, useRef, useState } from 'react'
import type { Burst, ScoreApi, ScoreSample } from '../state/useScore'
import type { ScoreCategory } from '../score'

const HEART = 'M8 14s-5-3.3-5-7A3 3 0 0 1 8 5a3 3 0 0 1 5 2c0 3.7-5 7-5 7Z'

function Heart({ size = 12, color = 'var(--heart, #e0245e)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={color} aria-hidden="true">
      <path d={HEART} />
    </svg>
  )
}

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

/**
 * The Approval badge: your score, tucked in the bottom corner, with the likes flying off it as
 * hearts whenever it climbs. Clicking opens a panel that breaks the score down by where it came
 * from and charts it over time — the personal record, kept in browser memory.
 */
export function ScoreBadge({ api }: { api: ScoreApi }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
    <div ref={ref} style={{ position: 'relative', pointerEvents: 'auto' }}>
      {/* The likes, taking flight off the badge — a little stream of hearts per award, anchored to
          the heart icon so they lift right off it. */}
      <div style={{ position: 'absolute', left: '12px', bottom: '14px', width: 0, height: 0, pointerEvents: 'none', zIndex: 30 }}>
        {api.bursts.map(burst => (
          <BurstFlight key={burst.id} burst={burst} onDone={() => api.clearBurst(burst.id)} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={`Approval score ${api.points}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: '28px',
          boxSizing: 'border-box',
          padding: '0 11px 0 9px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '999px',
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer',
        }}
      >
        <Heart size={13} />
        <span key={api.points} className="mlb-score-pop" style={{ display: 'inline-flex', alignItems: 'baseline', gap: '3px' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {api.points.toLocaleString()}
          </span>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>pts</span>
        </span>
      </button>

      {open && <ScorePanel api={api} onReset={api.reset} />}
    </div>
  )
}

// A warm spread of like-reds, so a burst isn't one flat colour.
const HEART_COLORS = ['#e0245e', '#ff4d6d', '#ff6b8a', '#f0347a', '#ff8fab']

function BurstFlight({ burst, onDone }: { burst: Burst; onDone: () => void }) {
  // Fix each heart's random path once, on mount — re-rolling every render would make them jitter.
  const hearts = useRef(
    Array.from({ length: Math.max(6, Math.min(20, Math.round(burst.likes / 32))) }, () => ({
      dx: Math.round((Math.random() - 0.5) * 84),
      dy: -70 - Math.round(Math.random() * 70),
      rot: Math.round((Math.random() - 0.5) * 60),
      size: 11 + Math.round(Math.random() * 11),
      delay: Math.round(Math.random() * 480),
      duration: 1100 + Math.round(Math.random() * 900),
      startX: Math.round((Math.random() - 0.5) * 16),
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
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
        style={{ position: 'absolute', left: '-2px', bottom: '2px', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 800, color: 'var(--heart, #e0245e)' }}
      >
        +{burst.points}
      </div>
      {hearts.map((h, i) => (
        <span
          key={i}
          className="mlb-heart-rise"
          style={{
            position: 'absolute',
            left: `${h.startX}px`,
            bottom: 0,
            display: 'flex',
            // @ts-expect-error CSS custom properties
            '--dx': `${h.dx}px`,
            '--dy': `${h.dy}px`,
            '--rot': `${h.rot}deg`,
            animationDelay: `${h.delay}ms`,
            animationDuration: `${h.duration}ms`,
          }}
        >
          <Heart size={h.size} color={h.color} />
        </span>
      ))}
    </>
  )
}

function ScorePanel({ api, onReset }: { api: ScoreApi; onReset: () => void }) {
  const now = Date.now()
  const total = api.points
  const categories = (Object.keys(CATEGORY_LABEL) as ScoreCategory[]).filter(c => api.breakdown[c] > 0)

  return (
    <div
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
        <Heart size={22} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '20px', fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {total.toLocaleString()}
          </span>
          <span style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '3px' }}>
            Approval · {api.likes.toLocaleString()} likes
          </span>
        </div>
      </div>

      <Sparkline history={api.history} current={total} />

      <div style={{ padding: '4px 0' }}>
        {categories.length === 0 ? (
          <div style={{ padding: '14px', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Build a line, place a stop, found an operator — approval starts here.
          </div>
        ) : (
          categories.map(cat => (
            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: 'var(--text-xs)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{CATEGORY_LABEL[cat]}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {api.breakdown[cat].toLocaleString()}
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

/** A quiet line of the score climbing. The current total is appended so the line always ends at
 * where the badge sits, even between the once-a-minute history samples. */
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
  const coords = points.map((p, i) => {
    const x = pad + i * step
    const y = h - pad - ((p - min) / span) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <div style={{ padding: '8px 0 4px', borderBottom: '1px solid var(--border-subtle)' }}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polyline points={coords.join(' ')} fill="none" stroke="var(--heart, #e0245e)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pad + (points.length - 1) * step} cy={h - pad - ((current - min) / span) * (h - pad * 2)} r="2.5" fill="var(--heart, #e0245e)" />
      </svg>
    </div>
  )
}
