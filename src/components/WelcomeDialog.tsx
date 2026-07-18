import { Button, Dialog } from 'metro-ds'
import logoLightUrl from 'metro-ds/assets/logo-mark.svg'
import logoDarkUrl from 'metro-ds/assets/logo-mark-white.svg'
import { SparkleIcon, StationIcon } from '../icons'
import type { Theme } from '../useTheme'

interface WelcomeDialogProps {
  open: boolean
  theme: Theme
  /** Hand them a city to pull apart. */
  onGenerate: () => void
  /** Hand them the grid and get out of the way. */
  onBlank: () => void
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
export function WelcomeDialog({ open, theme, onGenerate, onBlank }: WelcomeDialogProps) {
  return (
    <Dialog open={open} onClose={onBlank} title="" width="420px">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--gap-lg)', textAlign: 'center' }}>
        <img src={theme === 'dark' ? logoDarkUrl : logoLightUrl} alt="" width={64} height={64} />

        <div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Metro Line Builder
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
            Draw a transit map for a city that doesn&rsquo;t exist yet.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)', width: '100%' }}>
          <Button variant="primary" icon={<SparkleIcon />} onClick={onGenerate} style={{ width: '100%' }}>
            Start with a generated city
          </Button>
          <Button variant="secondary" icon={<StationIcon />} onClick={onBlank} style={{ width: '100%' }}>
            Start with a blank canvas
          </Button>
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
