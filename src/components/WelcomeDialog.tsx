import { Dialog } from 'metro-ds'
import logoLightUrl from 'metro-ds/assets/logo-mark.svg'
import logoDarkUrl from 'metro-ds/assets/logo-mark-white.svg'
import { LINE_COLORS } from '../lineColors'
import type { Theme } from '../useTheme'

interface WelcomeDialogProps {
  open: boolean
  theme: Theme
  /** Hand them a city to pull apart. */
  onGenerate: () => void
  /** Hand them the grid and get out of the way. */
  onBlank: () => void
  /** Close without choosing. On first run that leaves the blank canvas already underneath;
   * reopened over a map, it leaves that map exactly as it was. */
  onDismiss: () => void
  /** True when it's been reopened over a map that already has something on it, which turns
   * both choices from a start into a replacement. */
  returning?: boolean
}

/**
 * The first thing a new map-maker sees, and the only thing standing between them and the
 * canvas — so it asks one question and then leaves.
 *
 * The question is which of the two honest starts they want: a generated city, which is the
 * faster way to understand what this thing does, or an empty grid, which is the reason they
 * came. Neither is a tutorial, because a map is more legible than an explanation of one.
 *
 * Every way out lands somewhere sensible: both buttons dismiss it, and the close button, Esc
 * and a click outside all leave the blank canvas that was already underneath — which is the
 * second answer anyway. No path drops the user somewhere they didn't ask to be.
 */
export function WelcomeDialog({ open, theme, onGenerate, onBlank, onDismiss, returning = false }: WelcomeDialogProps) {
  return (
    // Closing is the way out that changes nothing. It used to be onBlank, which was the same
    // thing back when the canvas underneath was always already empty — reopened over a
    // finished map, onBlank clears it for real and can't be what Esc does.
    <Dialog open={open} onClose={onDismiss} title="" width="480px">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--gap-lg)', textAlign: 'center' }}>
        <img src={theme === 'dark' ? logoDarkUrl : logoLightUrl} alt="" width={64} height={64} />

        <div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Metro Line Builder
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
            {returning
              ? 'Start a new map. This replaces the one you have open — undo brings it back.'
              : 'Draw a transit map for a city that doesn’t exist yet.'}
          </p>
        </div>

        {/* Two slots rather than two buttons: the choice is between two kinds of map, and a
            picture of each says which is which faster than a label can. Each preview is drawn
            in the app's own vocabulary — its line colours, its station markers, its grid — so
            the slot is a small promise about what's behind it. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-md)', width: '100%' }}>
          <button type="button" className="mlb-slot" onClick={onGenerate}>
            <svg viewBox="0 0 120 78" className="mlb-slot-art" aria-hidden="true">
              <rect width="120" height="78" fill="var(--bg-page)" />
              <g stroke="var(--border-default)" strokeWidth="0.5" opacity="0.7">
                {[16, 32, 48, 64].map(y => (
                  <line key={y} x1="0" y1={y} x2="120" y2={y} />
                ))}
                {[20, 40, 60, 80, 100].map(x => (
                  <line key={x} x1={x} y1="0" x2={x} y2="78" />
                ))}
              </g>
              <g fill="none" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 24h30l14 14h34" stroke={LINE_COLORS[0]} />
                <path d="M22 60h26l16-16h40" stroke={LINE_COLORS[2]} />
                <path d="M58 68V38l12-12h28" stroke={LINE_COLORS[1]} />
              </g>
              <g fill="var(--bg-page)" stroke="var(--text-primary)" strokeWidth="1.6">
                <circle cx="14" cy="24" r="2.6" />
                <circle cx="58" cy="38" r="3.4" />
                <circle cx="92" cy="38" r="2.6" />
                <circle cx="22" cy="60" r="2.6" />
                <circle cx="70" cy="26" r="2.6" />
                <circle cx="98" cy="26" r="2.6" />
              </g>
            </svg>
            <span className="mlb-slot-title">Generated city</span>
            <span className="mlb-slot-sub">A whole network, ready to pull apart</span>
          </button>

          <button type="button" className="mlb-slot" onClick={onBlank}>
            <svg viewBox="0 0 120 78" className="mlb-slot-art" aria-hidden="true">
              <rect width="120" height="78" fill="var(--bg-page)" />
              <g stroke="var(--border-default)" strokeWidth="0.5" opacity="0.7">
                {[16, 32, 48, 64].map(y => (
                  <line key={y} x1="0" y1={y} x2="120" y2={y} />
                ))}
                {[20, 40, 60, 80, 100].map(x => (
                  <line key={x} x1={x} y1="0" x2={x} y2="78" />
                ))}
              </g>
            </svg>
            <span className="mlb-slot-title">Blank canvas</span>
            <span className="mlb-slot-sub">An empty grid and a free hand</span>
          </button>
        </div>

        {/* Small, and last, because it is a notice rather than a welcome — but present, because
            the app ships other people's work and the first screen is where that is owed. */}
        <p style={{ fontSize: '11px', lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>
          © 2026 Vitor Gomes. Released under the MIT licence.
          <br />
          Map symbols from{' '}
          <a
            href="https://openmoji.org/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
          >
            OpenMoji
          </a>{' '}
          under CC BY-SA 4.0. Full notices under More → Legal.
        </p>
      </div>
    </Dialog>
  )
}
