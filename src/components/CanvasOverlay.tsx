import { MapIcon } from '../icons'

interface CanvasOverlayProps {
  lineCount: number
  stationCount: number
  zoom: number
  selectionLabel: string | null
}

export function CanvasOverlay({ lineCount, stationCount, zoom, selectionLabel }: CanvasOverlayProps) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          bottom: 'var(--space-3)',
          left: 'var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-sm)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '5px 10px',
          boxShadow: 'var(--shadow-sm)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
        }}
      >
        <MapIcon />
        <span>{lineCount} lines</span>
        <span style={{ color: 'var(--border-default)' }}>·</span>
        <span>{stationCount} stations</span>
        <span style={{ color: 'var(--border-default)' }}>·</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{Math.round(zoom * 100)}%</span>
      </div>

      {selectionLabel && (
        <div
          style={{
            position: 'absolute',
            bottom: 'var(--space-3)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--ink-900)',
            color: 'var(--ink-0)',
            borderRadius: 'var(--radius-lg)',
            padding: '5px 12px',
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
          }}
        >
          {selectionLabel}
        </div>
      )}
    </>
  )
}
