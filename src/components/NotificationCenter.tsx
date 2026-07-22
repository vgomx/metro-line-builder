import { useEffect, useRef, useState } from 'react'
import { IconButton, Toggle } from 'metro-ds'
import { NewspaperIcon } from '../icons'
import { HoverTip } from './HoverTip'
import type { NotificationsApi } from '../state/useNotifications'

/** Relative time, coarse on purpose — the Gazette isn't a stopwatch. */
function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

/**
 * The top-bar home for the Gazette: a newspaper button carrying an unread count, opening a panel
 * that holds the whole run of headlines. Opening it clears the count; the panel is where a reader
 * catches up on anything the banner retired before they looked, clears the feed, or switches the
 * whole thing off.
 */
export function NotificationCenter({ api }: { api: NotificationsApi }) {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    // Freshen the relative times while the panel is up, and shut on an outside click or Escape.
    setNow(Date.now())
    const tick = window.setInterval(() => setNow(Date.now()), 30000)
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearInterval(tick)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleOpen = () => {
    const next = !open
    setOpen(next)
    if (next) api.markRead()
  }

  const badge = api.unreadCount > 0

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <HoverTip label="Transit Gazette" placement="bottom">
        <span style={{ position: 'relative', display: 'flex' }}>
          <IconButton icon={<NewspaperIcon />} label="Transit Gazette" size="sm" active={open} onClick={toggleOpen} />
          {badge && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                minWidth: '15px',
                height: '15px',
                padding: '0 3px',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 700,
                lineHeight: 1,
                color: '#fff',
                background: 'var(--color-danger, #d9534f)',
                borderRadius: '999px',
                border: '1.5px solid var(--bg-surface)',
                pointerEvents: 'none',
              }}
            >
              {api.unreadCount > 9 ? '9+' : api.unreadCount}
            </span>
          )}
        </span>
      </HoverTip>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 200,
            width: '320px',
            maxWidth: 'calc(100vw - 24px)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '10px 12px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, letterSpacing: '0.02em', color: 'var(--text-primary)' }}>
              The Transit Gazette
            </span>
            {api.items.length > 0 && (
              <button
                type="button"
                onClick={api.clearAll}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', cursor: 'pointer', padding: 0 }}
              >
                Clear all
              </button>
            )}
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {api.items.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                {api.enabled ? 'No headlines yet. Build something the Gazette can report.' : 'Notifications are off.'}
              </div>
            ) : (
              api.items.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    padding: '9px 12px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', lineHeight: 1.4 }}>{item.text}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ago(item.at, now)}</span>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-subtle)' }}>
            <Toggle
              checked={api.enabled}
              onChange={() => api.setEnabled(!api.enabled)}
              label="Notifications"
              hint={api.enabled ? 'Headlines will appear as you build.' : 'The Gazette has gone quiet.'}
              size="sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}
