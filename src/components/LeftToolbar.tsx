import { useEffect } from 'react'
import { IconButton, Toolbar, ToolbarSeparator } from 'metro-ds'
import { CursorIcon, HandIcon, JourneyIcon, ParkIcon, PenIcon, PoiIcon, RiverIcon, StationIcon } from '../icons'
import type { Tool } from '../types'
import type { Theme } from '../useTheme'
import { MoreMenu } from './MoreMenu'
import { HoverTip } from './HoverTip'

interface LeftToolbarProps {
  tool: Tool
  onSetTool: (tool: Tool) => void
  theme: Theme
  onStartOver: () => void
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

export function LeftToolbar({ tool, onSetTool, theme, onStartOver }: LeftToolbarProps) {
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
        {TOOLS.map(({ tool: t, label, icon }) => (
          <HoverTip key={t} label={label}>
            <IconButton icon={icon} label={label} active={tool === t} onClick={() => onSetTool(t)} />
          </HoverTip>
        ))}
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
