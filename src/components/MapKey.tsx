import type { ReactNode } from 'react'
import { ModeGlyphHtml } from '../modeGlyphs'

/**
 * The map's key: what the marks mean, now that the map speaks in modes.
 *
 * Monochrome and muted on purpose — it explains the coloured map without competing with it, and
 * carries no line colours of its own because every line is already named and numbered, so a colour
 * key would only add noise. It names the vocabulary that isn't self-evident: a double track is
 * rail, a square is a rail stop, a ringed mark is an interchange, and a main interchange spells its
 * modes out in glyphs.
 *
 * Sits above the authority mark in the corner, and is shown or hidden from the top bar — always-on
 * would spend permanent corner weight a reader only sometimes wants.
 */

const INK = 'var(--text-secondary)'

function Header({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '3px' }}>
      {children}
    </div>
  )
}

function Row({ mark, label }: { mark: ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minHeight: '17px' }}>
      <span style={{ width: '22px', display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>{mark}</span>
      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

/** The samples are drawn to the map's own vocabulary: a solid stroke, a double track, and the
 * circle / square / ringed marks a station wears — kept in one muted ink rather than any line's
 * colour, since the key is about form, not which line. */
function SolidLine() {
  return (
    <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden>
      <line x1="1" y1="6" x2="21" y2="6" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  )
}

function DoubleLine() {
  return (
    <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden>
      <line x1="1" y1="4" x2="21" y2="4" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="1" y1="8" x2="21" y2="8" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function StopMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle cx="7" cy="7" r="4.5" fill="var(--bg-surface)" stroke={INK} strokeWidth="2" />
    </svg>
  )
}

function RailStopMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect x="2.4" y="2.4" width="9.2" height="9.2" rx="3" fill="var(--bg-surface)" stroke={INK} strokeWidth="2" />
    </svg>
  )
}

function InterchangeMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle cx="7" cy="7" r="5.5" fill="var(--bg-surface)" stroke={INK} strokeWidth="2.4" />
      <circle cx="7" cy="7" r="1.9" fill={INK} />
    </svg>
  )
}

export function MapKey() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        padding: '9px 12px 10px',
        background: 'var(--panel-glass)',
        backdropFilter: 'var(--panel-blur)',
        WebkitBackdropFilter: 'var(--panel-blur)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        pointerEvents: 'auto',
      }}
    >
      <Header>Lines</Header>
      <Row mark={<SolidLine />} label="Metro line" />
      <Row mark={<DoubleLine />} label="Rail line" />

      <Header>Stations</Header>
      <Row mark={<StopMark />} label="Stop" />
      <Row mark={<RailStopMark />} label="Rail stop" />
      <Row mark={<InterchangeMark />} label="Interchange" />

      <Header>Main interchange</Header>
      <Row
        mark={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--text-secondary)' }}>
            <ModeGlyphHtml mode="metro" size={13} />
            <ModeGlyphHtml mode="rail" size={13} />
          </span>
        }
        label="Its modes, shown"
      />
    </div>
  )
}
