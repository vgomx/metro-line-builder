import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button, IconButton } from 'metro-ds'
import { DownloadIcon, GridIcon, LogoMark, RedoIcon, TrainIcon, UndoIcon, ZoomInIcon, ZoomOutIcon } from '../icons'

interface TopBarProps {
  mapName: string
  onMapNameChange: (name: string) => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  showGrid: boolean
  onToggleGrid: () => void
  showTrains: boolean
  onToggleTrains: () => void
  onExport: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function TopBar({
  mapName,
  onMapNameChange,
  zoom,
  onZoomIn,
  onZoomOut,
  showGrid,
  onToggleGrid,
  showTrains,
  onToggleTrains,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
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

      <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)', margin: '0 var(--space-2)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-tight)' }}>
        <IconButton icon={<UndoIcon />} label="Undo" size="sm" disabled={!canUndo} onClick={onUndo} />
        <IconButton icon={<RedoIcon />} label="Redo" size="sm" disabled={!canRedo} onClick={onRedo} />
      </div>

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
      <IconButton icon={<TrainIcon />} label="Toggle trains" size="sm" active={showTrains} onClick={onToggleTrains} />
      <div style={{ width: 'var(--space-2)' }} />
      <Button size="sm" variant="ghost" icon={<DownloadIcon />} onClick={onExport}>
        Export
      </Button>
    </div>
  )
}
