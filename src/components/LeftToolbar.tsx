import { useEffect } from 'react'
import { IconButton, Toolbar } from 'metro-ds'
import { CursorIcon, HandIcon, PenIcon, StationIcon } from '../icons'
import type { Tool } from '../types'

interface LeftToolbarProps {
  tool: Tool
  onSetTool: (tool: Tool) => void
}

const TOOLS: { tool: Tool; label: string; icon: JSX.Element; key: string }[] = [
  { tool: 'select', label: 'Select (V)', icon: <CursorIcon />, key: 'v' },
  { tool: 'draw-line', label: 'Draw line (P)', icon: <PenIcon />, key: 'p' },
  { tool: 'add-station', label: 'Add station (S)', icon: <StationIcon />, key: 's' },
  { tool: 'pan', label: 'Pan (H)', icon: <HandIcon />, key: 'h' },
]

export function LeftToolbar({ tool, onSetTool }: LeftToolbarProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const match = TOOLS.find(t => t.key === e.key.toLowerCase())
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
      <Toolbar orientation="vertical">
        {TOOLS.map(({ tool: t, label, icon }) => (
          <IconButton key={t} icon={icon} label={label} active={tool === t} onClick={() => onSetTool(t)} />
        ))}
      </Toolbar>
    </aside>
  )
}
