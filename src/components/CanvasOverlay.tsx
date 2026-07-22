import { MapIcon } from '../icons'

interface CanvasStatsProps {
  lineCount: number
  stationCount: number
  zoom: number
}

/**
 * Map stats — lines, stations, zoom. Laid out by whatever places it (it now rides the foot of
 * the right-hand column, beneath the panel) rather than pinning itself to a corner.
 */
export function CanvasStats({ lineCount, stationCount, zoom }: CanvasStatsProps) {
  return (
    <div
      style={{
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
        whiteSpace: 'nowrap',
        // Yields to the score badge beside it rather than pushing the row past the panel edge:
        // shrinks, and clips its own content (the zoom % goes first) before it would overflow.
        flexShrink: 1,
        minWidth: 0,
        overflow: 'hidden',
        // Read-only chrome — never swallow a click meant for the map underneath.
        pointerEvents: 'none',
      }}
    >
      <MapIcon />
      <span>{lineCount} lines</span>
      <span style={{ color: 'var(--border-default)' }}>·</span>
      <span>{stationCount} stations</span>
      <span style={{ color: 'var(--border-default)' }}>·</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{Math.round(zoom * 100)}%</span>
    </div>
  )
}

/** Name of the current station/geo selection, bottom-centred. Lines get the richer LED
 * announcer instead. Centres on whatever layer it's given, so it lands in the middle of
 * the map the user can see rather than the middle of the window. */
export function SelectionLabel({ label }: { label: string }) {
  return (
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
      {label}
    </div>
  )
}
