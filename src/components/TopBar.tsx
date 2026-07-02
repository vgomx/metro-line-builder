import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button, IconButton } from 'metro-ds'
import { DownloadIcon, GridIcon, LogoMark, ZoomInIcon, ZoomOutIcon } from '../icons'

interface TopBarProps {
  mapName: string
  onMapNameChange: (name: string) => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  showGrid: boolean
  onToggleGrid: () => void
  onExport: () => void
}

export function TopBar({
  mapName,
  onMapNameChange,
  zoom,
  onZoomIn,
  onZoomOut,
  showGrid,
  onToggleGrid,
  onExport,
}: TopBarProps) {
  const [focused, setFocused] = useState(false)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => onMapNameChange(e.target.value)

  return (
    <div
      style={{
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 var(--space-3)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-md)',
          marginRight: 'var(--space-4)',
          paddingRight: 'var(--space-4)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        <LogoMark />
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
          Metro Line Builder
        </span>
      </div>

      <input
        value={mapName}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          border: 'none',
          outline: 'none',
          background: focused ? 'var(--bg-subtle)' : 'transparent',
          fontSize: 'var(--text-base)',
          fontWeight: 500,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          padding: '4px 6px',
          borderRadius: 'var(--radius-sm)',
          transition: 'background 100ms ease',
          minWidth: 0,
          width: `${Math.max(mapName.length, 8)}ch`,
        }}
      />

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-tight)', marginRight: 'var(--space-2)' }}>
        <IconButton icon={<ZoomOutIcon />} label="Zoom out" size="sm" onClick={onZoomOut} />
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            minWidth: '38px',
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <IconButton icon={<ZoomInIcon />} label="Zoom in" size="sm" onClick={onZoomIn} />
      </div>

      <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)', margin: '0 var(--space-2)' }} />

      <IconButton icon={<GridIcon />} label="Toggle grid" size="sm" active={showGrid} onClick={onToggleGrid} />
      <div style={{ width: 'var(--space-2)' }} />
      <Button size="sm" variant="ghost" icon={<DownloadIcon />} onClick={onExport}>
        Export
      </Button>
    </div>
  )
}
