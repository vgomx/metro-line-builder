import { useEffect } from 'react'
import { IconButton, Toolbar, ToolbarSeparator } from 'metro-ds'
import { CursorIcon, HandIcon, JourneyIcon, ParkIcon, PenIcon, PoiIcon, RiverIcon, StationIcon } from '../icons'
import type { LineKind, Tool } from '../types'
import type { Theme } from '../useTheme'
import { ModeGlyphHtml, MODE_LABEL } from '../modeGlyphs'
import { MoreMenu } from './MoreMenu'
import { HoverTip } from './HoverTip'

interface LeftToolbarProps {
  tool: Tool
  onSetTool: (tool: Tool) => void
  /** The mode the next drawn line takes, and its setter — the Draw line tool's picker. */
  lineKind: LineKind
  onLineKind: (kind: LineKind) => void
  /** The mode the next placed station takes, and its setter — the Add station tool's picker. */
  stationMode: LineKind
  onStationMode: (kind: LineKind) => void
  theme: Theme
  onStartOver: () => void
}

/**
 * The mode chooser that opens beside a tool while it's active — metro or rail. It's how you say
 * what the next line, or the next station, will be without leaving the tool. Sits to the right of
 * the toolbar, anchored to the tool it belongs to.
 */
function ModePicker({ title, value, onChange }: { title: string; value: LineKind; onChange: (kind: LineKind) => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 'calc(100% + 12px)',
        top: 0,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '5px',
        background: 'var(--panel-glass)',
        backdropFilter: 'var(--panel-blur)',
        WebkitBackdropFilter: 'var(--panel-blur)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '1px 4px 2px' }}>
        {title}
      </span>
      {(['metro', 'rail'] as LineKind[]).map(mode => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            padding: '4px 9px 4px 6px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            background: value === mode ? 'var(--color-info-bg)' : 'transparent',
            color: 'var(--text-primary)',
            fontSize: '12px',
            fontWeight: value === mode ? 600 : 400,
            fontFamily: "'Barlow', system-ui, sans-serif",
          }}
        >
          <ModeGlyphHtml mode={mode} size={16} />
          {MODE_LABEL[mode]}
        </button>
      ))}
    </div>
  )
}

export const LEFT_TOOLBAR_WIDTH = 52

const TOOLS: { tool: Tool; label: string; icon: JSX.Element; key: string }[] = [
  { tool: 'select', label: 'Select (V)', icon: <CursorIcon />, key: 'v' },
  { tool: 'draw-line', label: 'Draw line (P)', icon: <PenIcon />, key: 'p' },
  { tool: 'add-station', label: 'Add station (S)', icon: <StationIcon />, key: 's' },
  { tool: 'pan', label: 'Pan (H)', icon: <HandIcon />, key: 'h' },
]

const GEO_TOOLS: { tool: Tool; label: string; icon: JSX.Element; key: string }[] = [
  { tool: 'draw-river', label: 'Draw river (R)', icon: <RiverIcon />, key: 'r' },
  { tool: 'draw-park', label: 'Draw park (G)', icon: <ParkIcon />, key: 'g' },
  { tool: 'add-poi', label: 'Point of interest (I)', icon: <PoiIcon />, key: 'i' },
]

/** Reading the map rather than drawing it, so it sits apart from the tools that change things. */
const READ_TOOLS: { tool: Tool; label: string; icon: JSX.Element; key: string }[] = [
  { tool: 'plan-journey', label: 'Plan a journey (J)', icon: <JourneyIcon />, key: 'j' },
]

export function LeftToolbar({ tool, onSetTool, lineKind, onLineKind, stationMode, onStationMode, theme, onStartOver }: LeftToolbarProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const match = [...TOOLS, ...GEO_TOOLS, ...READ_TOOLS].find(t => t.key === e.key.toLowerCase())
      if (match) onSetTool(match.tool)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSetTool])

  return (
    <aside
      style={{
        position: 'absolute',
        top: 'var(--space-3)',
        left: 'var(--space-3)',
        width: `${LEFT_TOOLBAR_WIDTH}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--gap-sm) var(--gap-sm)',
        background: 'var(--panel-glass)',
        backdropFilter: 'var(--panel-blur)',
        WebkitBackdropFilter: 'var(--panel-blur)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 10,
      }}
    >
      <Toolbar orientation="vertical" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
        {TOOLS.map(({ tool: t, label, icon }) => {
          // Draw line and Add station carry a mode; while either is the active tool, its picker
          // opens beside it. Wrapped so the flyout can anchor to the button rather than the strip.
          const picker =
            t === 'draw-line'
              ? { title: 'Line type', value: lineKind, onChange: onLineKind }
              : t === 'add-station'
                ? { title: 'Station type', value: stationMode, onChange: onStationMode }
                : null
          const button = (
            <HoverTip label={label}>
              <IconButton icon={icon} label={label} active={tool === t} onClick={() => onSetTool(t)} />
            </HoverTip>
          )
          if (!picker) return <div key={t}>{button}</div>
          return (
            <div key={t} style={{ position: 'relative' }}>
              {button}
              {tool === t && <ModePicker {...picker} />}
            </div>
          )
        })}
        <ToolbarSeparator orientation="horizontal" />
        {GEO_TOOLS.map(({ tool: t, label, icon }) => (
          <HoverTip key={t} label={label}>
            <IconButton icon={icon} label={label} active={tool === t} onClick={() => onSetTool(t)} />
          </HoverTip>
        ))}
        <ToolbarSeparator orientation="horizontal" />
        {READ_TOOLS.map(({ tool: t, label, icon }) => (
          <HoverTip key={t} label={label}>
            <IconButton icon={icon} label={label} active={tool === t} onClick={() => onSetTool(t)} />
          </HoverTip>
        ))}
        <ToolbarSeparator orientation="horizontal" />
      </Toolbar>

      <MoreMenu theme={theme} onStartOver={onStartOver} />
    </aside>
  )
}
