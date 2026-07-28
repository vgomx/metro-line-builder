import { useState } from 'react'
import { Input } from 'metro-ds'
import type { Line, LineKind, Station } from '../types'
import { lineKind, markShapeForModes } from '../types'
import { isTransferStation, lineHasStation } from '../canvas/lineNodes'
import { LineBadge, MoreLinesBadge } from './LineBadge'
import { StationMark, stationMarkColor } from './StationMark'
import { SortControl } from './SortControl'
import type { SortOption } from './SortControl'

export type StationSortKey = 'map' | 'name'

/** Which mode's stops the list is narrowed to, or all of them. Kept apart from the sort: choosing a
 * mode hides the others, which is a filter, not an ordering — the two were muddled while both lived
 * in one dropdown. */
export type StationFilter = 'all' | LineKind

const SORT_OPTIONS: SortOption<StationSortKey>[] = [
  { key: 'map', label: 'Map order' },
  { key: 'name', label: 'Name' },
]

/** The stations' own sort vocabulary, on the shared control. */
export function StationSortControl({ value, onChange }: { value: StationSortKey; onChange: (key: StationSortKey) => void }) {
  return <SortControl value={value} options={SORT_OPTIONS} onChange={onChange} />
}

/** The mode labels the filter and the empty state read from — every mode a stop can be narrowed to. */
const MODE_LABELS: Record<LineKind, string> = { metro: 'Metro', rail: 'Rail', tram: 'Tram' }
/** The order the mode filters offer themselves in, matching the Lines panel's sections. */
const MODE_ORDER: LineKind[] = ['metro', 'rail', 'tram']

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

  // Whether a stop is served by a given mode — a line of that mode calls there; a stop no line has
  // reached yet answers to the mode it was placed as. An interchange serves each of its modes, so it
  // passes every one of their filters, which is the right answer: hiding a metro-meets-rail junction
  // from the rail list would lose a place a rail rider can actually change.
  const servesMode = (station: Station, mode: LineKind) => {
    const calling = linesCallingAt(station.id)
    if (calling.length === 0) return (station.mode ?? 'metro') === mode
    return calling.some(l => lineKind(l) === mode)
  }

  // The sort is stable, so stops that tie keep the order the map put them in — which is the order
  // this list has always used, and the only one a station really has of its own.
  const ordered = sortBy === 'name' ? [...stations].sort((a, b) => a.name.localeCompare(b.name)) : stations

  // The filter offers itself only when there's a mix to sift, and only the modes actually on the map
  // — an all-metro map has nothing to narrow, and a metro-and-tram map has no reason to show a Rail
  // button that would only ever come back empty.
  const presentModes = MODE_ORDER.filter(mode => stations.some(s => servesMode(s, mode)))
  const showFilter = presentModes.length >= 2
  const filtered = filterMode === 'all' ? ordered : ordered.filter(s => servesMode(s, filterMode))

  // Only once there are enough stops for the list to be a problem. On a small map the field
  // would be a control asking to be used on something already visible in full.
  const searchable = stations.length >= 12
  const needle = query.trim().toLowerCase()
  const shown = needle ? filtered.filter(station => station.name.toLowerCase().includes(needle)) : filtered

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {showFilter && (
        <div style={{ display: 'flex', gap: '4px', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          {(['all', ...presentModes] as StationFilter[]).map(key => {
            const active = filterMode === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => onFilterChange(key)}
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
                {key === 'all' ? 'All' : MODE_LABELS[key]}
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
            : filterMode === 'all'
              ? 'No stations.'
              : `No ${MODE_LABELS[filterMode].toLowerCase()} stations.`}
        </p>
      )}

      {shown.map(station => {
        const isSelected = station.id === selectedStationId
        // The same three questions the canvas asks of a stop, answered the same way, so a row and
        // the marker it stands for can't disagree. A stop no line has reached yet has only its own
        // mode to go on.
        const calling = linesCallingAt(station.id)
        const interchange = isTransferStation(station, lines)
        const modes = calling.length > 0 ? calling.map(lineKind) : [station.mode ?? 'metro']
        const shape = markShapeForModes(modes)
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
            <StationMark shape={shape} interchange={interchange} color={color} />
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
