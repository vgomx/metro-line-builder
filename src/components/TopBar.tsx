import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Button, IconButton } from 'metro-ds'
import logoLightUrl from 'metro-ds/assets/logo.svg'
import logoDarkUrl from 'metro-ds/assets/logo-horizontal-white.svg'
import {
  DownloadIcon,
  FolderOpenIcon,
  GridIcon,
  MoonIcon,
  PanelIcon,
  RedoIcon,
  SoundOffIcon,
  SoundOnIcon,
  SparkleIcon,
  SunIcon,
  TrainIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../icons'
import type { Theme } from '../useTheme'
import { HoverTip } from './HoverTip'

/**
 * Slides a toggle's icon into place when its state changes: up when it comes on, down when it
 * goes off, so the direction of travel matches the direction of the change.
 *
 * Keyed by the state, which is what remounts the icon and replays the animation — and for the
 * two toggles whose icon actually changes (sound, theme), that remount is the swap, so the new
 * icon arrives sliding rather than blinking into place.
 *
 * Silent on first render. Five icons sliding in every time the app loads would announce
 * nothing, since nothing has changed yet.
 */
function ToggleIcon({ on, children }: { on: boolean; children: ReactNode }) {
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
  }, [])
  return (
    <span key={String(on)} className={mounted.current ? (on ? 'mlb-toggle-on' : 'mlb-toggle-off') : undefined} style={{ display: 'flex' }}>
      {children}
    </span>
  )
}

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
  showPanel: boolean
  onTogglePanel: () => void
  soundEnabled: boolean
  onToggleSound: () => void
  theme: Theme
  onToggleTheme: () => void
  onOpen: () => void
  onExport: () => void
  onSurprise: () => void
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
  showPanel,
  onTogglePanel,
  soundEnabled,
  onToggleSound,
  theme,
  onToggleTheme,
  onOpen,
  onExport,
  onSurprise,
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
          marginRight: 'var(--space-4)',
          paddingRight: 'var(--space-4)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        <img src={theme === 'dark' ? logoDarkUrl : logoLightUrl} alt="Metro Line Builder" height={24} />
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
        <HoverTip label="Undo" placement="bottom">
          <IconButton icon={<UndoIcon />} label="Undo" size="sm" disabled={!canUndo} onClick={onUndo} />
        </HoverTip>
        <HoverTip label="Redo" placement="bottom">
          <IconButton icon={<RedoIcon />} label="Redo" size="sm" disabled={!canRedo} onClick={onRedo} />
        </HoverTip>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-tight)', marginRight: 'var(--space-2)' }}>
        <HoverTip label="Zoom out" placement="bottom">
          <IconButton icon={<ZoomOutIcon />} label="Zoom out" size="sm" onClick={onZoomOut} />
        </HoverTip>
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
        <HoverTip label="Zoom in" placement="bottom">
          <IconButton icon={<ZoomInIcon />} label="Zoom in" size="sm" onClick={onZoomIn} />
        </HoverTip>
      </div>

      <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)', margin: '0 var(--space-2)' }} />

      {/* The toggles get the same 4px between them as the undo/redo and zoom clusters. Flush
          against each other, their active backgrounds met and read as one long pressed slab
          rather than as three switches, two of which happened to be on. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-tight)' }}>
        <HoverTip label="Toggle grid" placement="bottom">
          <IconButton
            icon={
              <ToggleIcon on={showGrid}>
                <GridIcon />
              </ToggleIcon>
            }
            label="Toggle grid"
            size="sm"
            active={showGrid}
            onClick={onToggleGrid}
          />
        </HoverTip>
        <HoverTip label="Toggle trains" placement="bottom">
          <IconButton
            icon={
              <ToggleIcon on={showTrains}>
                <TrainIcon />
              </ToggleIcon>
            }
            label="Toggle trains"
            size="sm"
            active={showTrains}
            onClick={onToggleTrains}
          />
        </HoverTip>
        <HoverTip label={showPanel ? 'Hide side panel' : 'Show side panel'} placement="bottom">
          <IconButton
            icon={
              <ToggleIcon on={showPanel}>
                <PanelIcon />
              </ToggleIcon>
            }
            label={showPanel ? 'Hide side panel' : 'Show side panel'}
            size="sm"
            active={showPanel}
            onClick={onTogglePanel}
          />
        </HoverTip>
        <HoverTip label={soundEnabled ? 'Mute interface sounds' : 'Unmute interface sounds'} placement="bottom">
          <IconButton
            icon={<ToggleIcon on={soundEnabled}>{soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}</ToggleIcon>}
            label={soundEnabled ? 'Mute interface sounds' : 'Unmute interface sounds'}
            size="sm"
            active={soundEnabled}
            onClick={onToggleSound}
          />
        </HoverTip>
        <HoverTip label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} placement="bottom">
          <IconButton
            icon={<ToggleIcon on={theme === 'dark'}>{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</ToggleIcon>}
            label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            size="sm"
            onClick={onToggleTheme}
          />
        </HoverTip>
      </div>

      <div style={{ width: 'var(--space-2)' }} />
      <Button size="sm" variant="ghost" icon={<SparkleIcon />} onClick={onSurprise}>
        Surprise me
      </Button>
      <div style={{ width: 'var(--gap-tight)' }} />
      <Button size="sm" variant="ghost" icon={<FolderOpenIcon />} onClick={onOpen}>
        Open
      </Button>
      <div style={{ width: 'var(--gap-tight)' }} />
      <Button size="sm" variant="ghost" icon={<DownloadIcon />} onClick={onExport}>
        Export
      </Button>
    </div>
  )
}
