import { useEffect, useRef, useState } from 'react'
import { Dialog, Divider, IconButton } from 'metro-ds'
import logoUrl from 'metro-ds/assets/logo-mark.svg'
import { MoreIcon } from '../icons'
import { LEGAL_NOTICES } from '../legalNotices'

const APP_VERSION = '0.1.0'

export function MoreMenu() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeDialog, setActiveDialog] = useState<'legal' | 'about' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const openDialog = (dialog: 'legal' | 'about') => {
    setMenuOpen(false)
    setActiveDialog(dialog)
  }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <IconButton icon={<MoreIcon />} label="More" onClick={() => setMenuOpen(o => !o)} />

      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 'calc(100% + 6px)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            width: '140px',
            zIndex: 100,
          }}
        >
          <button type="button" onClick={() => openDialog('legal')} style={menuItemStyle}>
            Legal
          </button>
          <button type="button" onClick={() => openDialog('about')} style={menuItemStyle}>
            About
          </button>
        </div>
      )}

      <Dialog open={activeDialog === 'legal'} onClose={() => setActiveDialog(null)} title="Legal" width="560px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            Metro Line Builder is built with the following open-source software. Only packages actually shipped
            in the app are listed below — build-only tooling isn't included since it never reaches end users.
          </p>
          {LEGAL_NOTICES.map(notice => (
            <div key={notice.name}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--gap-sm)', marginBottom: '6px' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{notice.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                  {notice.license} — {notice.packages}
                </span>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 'var(--space-3)',
                  background: 'var(--bg-page)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  lineHeight: 1.5,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '160px',
                  overflowY: 'auto',
                }}
              >
                {notice.text}
              </pre>
            </div>
          ))}
        </div>
      </Dialog>

      <Dialog open={activeDialog === 'about'} onClose={() => setActiveDialog(null)} title="" width="360px">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--gap-md)', textAlign: 'center' }}>
          <img src={logoUrl} alt="" width={56} height={56} />
          <div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>Metro Line Builder</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Version {APP_VERSION}
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            An interactive editor for designing schematic metro and transit maps.
          </p>
          <Divider />
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
            Created by{' '}
            <a
              href="https://vitorgomes.design"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-link)', textDecoration: 'underline' }}
            >
              Vitor Gomes
            </a>
            .
            <br />
            © 2026 Vitor Gomes. Licensed under the MIT License.
          </p>
          <button
            type="button"
            onClick={() => openDialog('legal')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 'var(--text-xs)',
              color: 'var(--text-link)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            View open-source acknowledgements
          </button>
        </div>
      </Dialog>
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '7px 10px',
  fontSize: '13px',
  fontFamily: 'var(--font-sans)',
  color: 'var(--text-primary)',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
}
