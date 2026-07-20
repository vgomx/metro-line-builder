import { useEffect, useRef, useState } from 'react'
import { Button } from 'metro-ds'
import { DownloadIcon } from '../icons'
import type { ImageFormat } from '../exportImage'

interface ExportMenuProps {
  onExportImage: (format: ImageFormat) => void
  onExportJson: () => void
  /** True while a picture is being drawn, which on a large map takes a moment. */
  busy: boolean
}

/**
 * Export, which now means three different things.
 *
 * It used to mean one — the JSON only this app can read — which made the button a save
 * button wearing an export button's name. The two pictures are what people actually want
 * from a finished map, so they come first; the data file keeps its place at the bottom as
 * the one that can be opened again.
 *
 * The descriptions are there because the choice is genuinely not obvious from three file
 * extensions, and the wrong pick is only discovered after the download.
 */
export function ExportMenu({ onExportImage, onExportJson, busy }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: Event) => {
      if (wrapper.current && !wrapper.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const choose = (run: () => void) => {
    setOpen(false)
    run()
  }

  return (
    <div ref={wrapper} style={{ position: 'relative', display: 'inline-flex' }}>
      <Button size="sm" variant="ghost" icon={<DownloadIcon />} disabled={busy} onClick={() => setOpen(o => !o)}>
        <span className="mlb-btn-label">{busy ? 'Exporting…' : 'Export'}</span>
      </Button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '260px',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 100,
          }}
        >
          <MenuItem
            title="PNG image"
            hint="A picture of the map. For sharing and pasting."
            onClick={() => choose(() => onExportImage('png'))}
          />
          <MenuItem
            title="SVG image"
            hint="The same picture, still editable. For Figma or Illustrator."
            onClick={() => choose(() => onExportImage('svg'))}
          />
          <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '3px 8px' }} />
          <MenuItem
            title="Map data"
            hint="A .json file this app can open again."
            onClick={() => choose(onExportJson)}
          />
        </div>
      )}
    </div>
  )
}

function MenuItem({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="mlb-menu-item" onClick={onClick}>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{hint}</span>
    </button>
  )
}
