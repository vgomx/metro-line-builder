import { Badge } from 'metro-ds'
import type { Line, Station } from '../types'
import { isTransferStation, lineHasStation } from '../canvas/lineNodes'

interface StationsPanelProps {
  stations: Station[]
  lines: Line[]
  selectedStationId: string | null
  onSelect: (stationId: string) => void
}

export function StationsPanel({ stations, lines, selectedStationId, onSelect }: StationsPanelProps) {
  const primaryLineFor = (stationId: string) => lines.find(l => lineHasStation(l, stationId))

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {stations.length === 0 && (
        <p style={{ padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
          No stations yet. Use the Add station tool.
        </p>
      )}

      {stations.map(station => {
        const isSelected = station.id === selectedStationId
        const line = primaryLineFor(station.id)
        const color = line?.color ?? 'var(--border-strong)'
        const transfer = isTransferStation(station, lines)
        return (
          <div
            key={station.id}
            onClick={() => onSelect(station.id)}
            className="mlb-row"
            data-selected={isSelected}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-sm)',
              padding: '8px 12px',
              cursor: 'pointer',
              borderLeft: `3px solid ${isSelected ? 'var(--interactive-primary)' : 'transparent'}`,
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: 'var(--radius-full)',
                border: `2px solid ${color}`,
                background: transfer ? color : 'var(--bg-surface)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                flex: 1,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {station.name}
            </span>
            {transfer && (
              <Badge variant="primary" style={{ fontSize: '9px', padding: '1px 5px' }}>
                Transfer
              </Badge>
            )}
          </div>
        )
      })}
    </div>
  )
}
