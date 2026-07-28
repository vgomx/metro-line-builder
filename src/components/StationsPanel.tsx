import { useState } from 'react'
import { Input } from 'metro-ds'
import type { Line, Station } from '../types'
import { isRailLine } from '../types'
import { isTransferStation, lineHasStation } from '../canvas/lineNodes'
import { LineBadge, MoreLinesBadge } from './LineBadge'
import { StationMark, stationMarkColor, stationMarkKind } from './StationMark'
import { SortControl } from './SortControl'
import type { SortOption } from './SortControl'

export type StationSortKey = 'map' | 'name'

/** Which mode's stops the list is narrowed to, or all of them. Kept apart from the sort: choosing a
 * mode hides the others, which is a filter, not an ordering — the two were muddled while both lived
 * in one dropdown. */
export type StationFilter = 'all' | 'metro' | 'rail'

const SORT_OPTIONS: SortOption<StationSortKey>[] = [
  { key: 'map', label: 'Map order' },
  { key: 'name', label: 'Name' },
]

/** The stations' own sort vocabulary, on the shared control. */
export function StationSortControl({ value, onChange }: { value: StationSortKey; onChange: (key: StationSortKey) => void }) {
  return <SortControl value={value} options={SORT_OPTIONS} onChange={onChange} />
}

const FILTERS: { key: StationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'metro', label: 'Metro' },
  { key: 'rail', label: 'Rail' },
]

interface StationsPanelProps {
  stations: Station[]
  lines: Line[]
  selectedStationId: string | null
  /** The active sort, owned by RightPanel so its control can live on the title row. */
  sortBy: StationSortKey
  /** The active mode filter, owned by RightPanel so it survives leaving and returning to the tab. */
  filterMode: StationFilter
  onFilterChange: (filter: StationFilter) => void
  onSelect: (stationId: string) => void
}

/** Past this many, the badges would crowd the name out of its own row; the rest fold into a +N
 * that says how many more call here without spelling each one out. */
const MAX_BADGES = 3

export function StationsPanel({ stations, lines, selectedStationId, sortBy, filterMode, onFilterChange, onSelect }: StationsPanelProps) {
  const [query, setQuery] = useState('')
  const linesCallingAt = (stationId: string) => lines.filter(l => lineHasStation(l, stationId))

  // Whether a stop is served by a given mode — a rail line calls there, or a metro one; a stop no
  // line has reached yet answers to the mode it was placed as. An interchange serves both, so it
  // passes either filter, which is the right answer: it is one of each, and hiding it from the rail
  // list would lose a place a rail rider can actually change.
  const servesMode = (station: Station, mode: 'metro' | 'rail') => {
    const calling = linesCallingAt(station.id)
    if (calling.length === 0) return (station.mode ?? 'metro') === mode
    return mode === 'rail' ? calling.some(isRailLine) : calling.some(l => !isRailLine(l))
  }

  // The sort is stable, so stops that tie keep the order the map put them in — which is the order
  // this list has always used, and the only one a station really has of its own.
  const ordered = sortBy === 'name' ? [...stations].sort((a, b) => a.name.localeCompare(b.name)) : stations

  // The filter offers itself only when there's a mix to sift — an all-metro map has nothing to
  // narrow, so a Metro/Rail choice there would be a control that does nothing.
  const bothModes = stations.some(s => servesMode(s, 'metro')) && stations.some(s => servesMode(s, 'rail'))
  const filtered = filterMode === 'all' ? ordered : ordered.filter(s => servesMode(s, filterMode))

  // Only once there are enough stops for the list to be a problem. On a small map the field
  // would be a control asking to be used on something already visible in full.
  const searchable = stations.length >= 12
  const needle = query.trim().toLowerCase()
  const shown = needle ? filtered.filter(station => station.name.toLowerCase().includes(needle)) : filtered

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {bothModes && (
        <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          {FILTERS.map(f => {
            const active = filterMode === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onFilterChange(f.key)}
                aria-pressed={active}
                style={{
                  flex: 1,
                  height: '26px',
                  padding: '0 8px',
                  fontSize: 'var(--text-xs)',
                  fontWeight: active ? 600 : 500,
                  color: active ? 'var(--interactive-primary)' : 'var(--text-secondary)',
                  background: active ? 'var(--color-info-bg)' : 'transparent',
                  border: `1px solid ${active ? 'transparent' : 'var(--border-default)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background 100ms ease, color 100ms ease',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      )}

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
          {needle
            ? `No station matches “${query.trim()}”.`
            : filterMode === 'rail'
              ? 'No rail stations.'
              : filterMode === 'metro'
                ? 'No metro stations.'
                : 'No stations.'}
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
                {overflow > 0 && <MoreLinesBadge count={overflow} />}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
