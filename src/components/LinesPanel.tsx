import { Button } from 'metro-ds'
import { EyeIcon, EyeOffIcon, PlusIcon } from '../icons'
import type { Line } from '../types'

interface LinesPanelProps {
  lines: Line[]
  selectedLineId: string | null
  onSelect: (lineId: string) => void
  onToggleVisibility: (lineId: string) => void
  onAddLine: () => void
}

export function LinesPanel({ lines, selectedLineId, onSelect, onToggleVisibility, onAddLine }: LinesPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {lines.length === 0 && (
        <p style={{ padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
          No lines yet. Draw one on the canvas.
        </p>
      )}

      {lines.map(line => {
        const isSelected = line.id === selectedLineId
        return (
          <div
            key={line.id}
            onClick={() => onSelect(line.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-sm)',
              padding: '8px 12px',
              cursor: 'pointer',
              background: isSelected ? 'var(--color-info-bg)' : 'transparent',
              borderLeft: `3px solid ${isSelected ? 'var(--interactive-primary)' : 'transparent'}`,
              transition: 'background 100ms ease',
            }}
          >
            <div style={{ width: '14px', height: '14px', borderRadius: 'var(--radius-full)', background: line.color, flexShrink: 0 }} />
            <span
              style={{
                flex: 1,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                fontWeight: isSelected ? 500 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {line.name}
            </span>
            <button
              type="button"
              aria-label={line.visible ? `Hide ${line.name}` : `Show ${line.name}`}
              onClick={e => {
                e.stopPropagation()
                onToggleVisibility(line.id)
              }}
              style={{
                display: 'flex',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: line.visible ? 'var(--text-secondary)' : 'var(--text-disabled)',
              }}
            >
              {line.visible ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </div>
        )
      })}

      <div style={{ padding: '8px 12px' }}>
        <Button size="sm" variant="ghost" icon={<PlusIcon />} onClick={onAddLine} style={{ width: '100%', justifyContent: 'flex-start' }}>
          Add line
        </Button>
      </div>
    </div>
  )
}
