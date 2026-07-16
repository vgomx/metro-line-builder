import { MapIcon } from '../icons'

interface CanvasStatsProps {
  lineCount: number
  stationCount: number
  zoom: number
}

/**
 * Map stats, pinned to the canvas's bottom-left corner. Sits on the same margin as the
 * floating toolbar directly above it, so the two read as one left-hand column rather than
 * as chrome at two different depths — which is why this anchors to the canvas itself
 * instead of the inset layer the centred chrome uses.
 */
export function CanvasStats({ lineCount, stationCount, zoom }: CanvasStatsProps) {
  return (
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
