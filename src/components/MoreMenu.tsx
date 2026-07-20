import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, Divider, IconButton } from 'metro-ds'
import logoLightUrl from 'metro-ds/assets/logo-mark.svg'
import logoDarkUrl from 'metro-ds/assets/logo-mark-white.svg'
import { ChevronDownIcon, MoreIcon } from '../icons'
import { LEGAL_NOTICES } from '../legalNotices'
import { HoverTip } from './HoverTip'
import type { Theme } from '../useTheme'

const APP_VERSION = '0.1.0'

interface MoreMenuProps {
  theme: Theme
}

export function MoreMenu({ theme }: MoreMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeDialog, setActiveDialog] = useState<'legal' | 'about' | null>(null)
  // One notice open at a time. Several at once would put the list back where it started —
  // taller than the dialog, with the thing you just opened somewhere off the bottom.
  const [openNotice, setOpenNotice] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const legalScrollRef = useRef<HTMLDivElement>(null)
  const noticeRefs = useRef<Record<string, HTMLDivElement | null>>({})

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
    setOpenNotice(null)
    setActiveDialog(dialog)
  }

  /**
   * Opening a notice further down the list would otherwise leave its heading where it was
   * while the text unfolded below the fold — so the newly opened one is brought to the top of
   * the scroll surface. Deferred a frame because the text has to be in the DOM before there's
   * anything to scroll to.
   */
  const toggleNotice = (name: string) => {
    const next = openNotice === name ? null : name
    setOpenNotice(next)
    if (!next) return
    requestAnimationFrame(() => {
      const scroller = legalScrollRef.current
      const item = noticeRefs.current[name]
      if (!scroller || !item) return
      scroller.scrollTo({ top: item.offsetTop - scroller.offsetTop, behavior: 'smooth' })
    })
  }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <HoverTip label="More">
        <IconButton icon={<MoreIcon />} label="More" onClick={() => setMenuOpen(o => !o)} />
      </HoverTip>

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

      {/* Both dialogs are portalled to the body rather than rendered where they sit in the
          tree. Dialog covers the viewport with position:fixed, but the toolbar around this
          menu is frosted, and an element with a backdrop-filter becomes the containing block
          for its fixed descendants — leaving the dialog laid out against a 52px rail instead
          of the window. The portal is what puts it back on the viewport. */}
      {createPortal(
        <>
        <Dialog open={activeDialog === 'legal'} onClose={() => setActiveDialog(null)} title="Legal" width="560px">
          {/* The dialog neither caps its height nor scrolls, and clips what overflows — so with
              a notice per shipped package the list runs off the bottom of the screen
              unreachable. Capping it against the viewport gives the body a scroll. The
              subtracted space covers the dialog's own margin, header and padding; svh rather
              than vh so a mobile browser's retracting toolbar doesn't crop it.

              This is the only scrolling surface in the dialog. The notices are an accordion
              precisely so it stays that way: a licence is thousands of words nobody reads
              start to finish, and giving each one its own scroll box meant a wheel gesture
              landed in whichever box the pointer happened to be over rather than on the list
              you were trying to move. Collapsed, the whole list fits and the scroll belongs
              to one thing. */}
          <div
            ref={legalScrollRef}
            style={{ maxHeight: 'calc(100svh - 200px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)' }}
          >
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
              Metro Line Builder is built with the following open-source software. Only packages actually shipped
              in the app are listed below — build-only tooling isn't included since it never reaches end users.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {LEGAL_NOTICES.map(notice => {
                const isOpen = openNotice === notice.name
                return (
                  <div
                    key={notice.name}
                    ref={el => { noticeRefs.current[notice.name] = el }}
                    style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}
                  >
                    <button
                      type="button"
                      className="mlb-accordion-head"
                      aria-expanded={isOpen}
                      aria-controls={`legal-${notice.name}`}
                      onClick={() => toggleNotice(notice.name)}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'flex',
                          color: 'var(--text-muted)',
                          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                          transition: 'transform 120ms ease',
                        }}
                      >
                        <ChevronDownIcon />
                      </span>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {notice.name}
                      </span>
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {notice.license}
                      </span>
                    </button>
                    {isOpen && (
                      <div id={`legal-${notice.name}`} style={{ padding: '0 var(--space-3) var(--space-3)' }}>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            marginBottom: '8px',
                          }}
                        >
                          {notice.packages}
                        </div>
                        {/* No maxHeight and no overflow here on purpose: the licence runs to
                            its full length and the dialog's own scroll carries it. */}
                        <pre
                          style={{
                            margin: 0,
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            lineHeight: 1.55,
                            color: 'var(--text-secondary)',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {notice.text}
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </Dialog>

        <Dialog open={activeDialog === 'about'} onClose={() => setActiveDialog(null)} title="" width="360px">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--gap-md)', textAlign: 'center' }}>
            <img src={theme === 'dark' ? logoDarkUrl : logoLightUrl} alt="" width={56} height={56} />
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
              <a href="mailto:vgmxx@proton.me" style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                vgmxx@proton.me
              </a>
            </p>

            <Divider />

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
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
            <a
              href="https://github.com/vgomx/metro-line-builder"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--text-link)', textDecoration: 'underline' }}
            >
              View source on GitHub
            </a>
          </div>
        </Dialog>
        </>,
        document.body,
      )}
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
