import { useEffect } from 'react'
import { IconButton, Toolbar, ToolbarSeparator } from 'metro-ds'
import { CursorIcon, HandIcon, ParkIcon, PenIcon, RiverIcon, StationIcon } from '../icons'
import type { Tool } from '../types'
import type { Theme } from '../useTheme'
import { MoreMenu } from './MoreMenu'

interface LeftToolbarProps {
  tool: Tool
  onSetTool: (tool: Tool) => void
  theme: Theme
}

const TOOLS: { tool: Tool; label: string; icon: JSX.Element; key: string }[] = [
  { tool: 'select', label: 'Select (V)', icon: <CursorIcon />, key: 'v' },
  { tool: 'draw-line', label: 'Draw line (P)', icon: <PenIcon />, key: 'p' },
  { tool: 'add-station', label: 'Add station (S)', icon: <StationIcon />, key: 's' },
  { tool: 'pan', label: 'Pan (H)', icon: <HandIcon />, key: 'h' },
]

const GEO_TOOLS: { tool: Tool; label: string; icon: JSX.Element; key: string }[] = [
  { tool: 'draw-river', label: 'Draw river (R)', icon: <RiverIcon />, key: 'r' },
  { tool: 'draw-park', label: 'Draw park (G)', icon: <ParkIcon />, key: 'g' },
]

export function LeftToolbar({ tool, onSetTool, theme }: LeftToolbarProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const match = [...TOOLS, ...GEO_TOOLS].find(t => t.key === e.key.toLowerCase())
      if (match) onSetTool(match.tool)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSetTool])

  return (
    <aside
      style={{
        width: '52px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--space-3) var(--gap-sm)',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      <Toolbar orientation="vertical" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
        {TOOLS.map(({ tool: t, label, icon }) => (
          <IconButton key={t} icon={icon} label={label} active={tool === t} onClick={() => onSetTool(t)} />
        ))}
        <ToolbarSeparator orientation="horizontal" />
        {GEO_TOOLS.map(({ tool: t, label, icon }) => (
          <IconButton key={t} icon={icon} label={label} active={tool === t} onClick={() => onSetTool(t)} />
        ))}
      </Toolbar>

      <div style={{ flex: 1 }} />

      <MoreMenu theme={theme} />
    </aside>
  )
}
