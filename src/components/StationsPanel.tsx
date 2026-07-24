import { useState } from 'react'
import { Input } from 'metro-ds'
import type { Line, Station } from '../types'
import { isRailLine } from '../types'
import { isTransferStation, lineHasStation } from '../canvas/lineNodes'
import { LineBadge } from './LineBadge'
import { StationMark, stationMarkColor, stationMarkKind } from './StationMark'

interface StationsPanelProps {
  stations: Station[]
  lines: Line[]
  selectedStationId: string | null
  onSelect: (stationId: string) => void
}

/** Past this many, the badges would crowd the name out of its own row; the rest are counted
 * instead. Four is already a busier junction than most maps build. */
const MAX_BADGES = 4

export function StationsPanel({ stations, lines, selectedStationId, onSelect }: StationsPanelProps) {
  const [query, setQuery] = useState('')
  const linesCallingAt = (stationId: string) => lines.filter(l => lineHasStation(l, stationId))

  // Only once there are enough stops for the list to be a problem. On a small map the field
  // would be a control asking to be used on something already visible in full.
  const searchable = stations.length >= 12
  const needle = query.trim().toLowerCase()
  const shown = needle ? stations.filter(station => station.name.toLowerCase().includes(needle)) : stations

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {searchable && (
        <div style={{ padding: '8px 12px' }}>
          <Input size="sm" placeholder="Find a station…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      )}

      {stations.length === 0 && (
        <p style={{ padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
          No stations yet. Use the Add station tool.
        </p>
      )}

      {stations.length > 0 && shown.length === 0 && (
        <p style={{ padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
          No station matches “{query.trim()}”.
        </p>
      )}

      {shown.map(station => {
        const isSelected = station.id === selectedStationId
        // The same three questions the canvas asks of a stop, answered the same way, so a row and
        // the marker it stands for can't disagree. A stop no line has reached yet has only its own
        // mode to go on.
        const calling = linesCallingAt(station.id)
        const interchange = isTransferStation(station, lines)
        const rail = calling.length > 0 ? calling.some(isRailLine) : station.mode === 'rail'
        const kind = stationMarkKind(interchange, rail)
        const color = stationMarkColor(interchange, calling[0]?.color)
        const badges = calling.slice(0, MAX_BADGES)
        const overflow = calling.length - badges.length
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
            <StationMark kind={kind} color={color} />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {station.name}
            </span>
            {/* Which lines call here, in the same numbered badges the Lines tab identifies them by.
                This is what the old single dot could never say: it took its colour from whichever
                line happened to be found first, so a junction of three looked like a stop on one. */}
            {badges.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                {badges.map(line => (
                  <LineBadge key={line.id} line={line} shape="circle" size="xs" />
                ))}
                {overflow > 0 && (
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>+{overflow}</span>
                )}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
