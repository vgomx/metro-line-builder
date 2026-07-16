import { Button, LineIndicator } from 'metro-ds'
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
          No lines yet — draw one on the canvas, or hit Surprise me for a whole city.
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
            {/* Carries the line's number rather than a bare swatch, so the list identifies a
                line the same way the canvas does. Sized up from the old 14px dot to seat the
                number legibly — LineIndicator picks its own text colour against the fill,
                which the pale end of the palette (the yellow) needs. */}
            <LineIndicator id={String(line.number)} color={line.color} size="sm" />
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
