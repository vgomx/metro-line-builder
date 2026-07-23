import type { Company, Line, Station } from '../types'
import type { Journey } from '../journey'
import { CompanySymbolIcon } from '../companySymbols'
import { HoverTip } from './HoverTip'
import { StationSelect } from './StationSelect'

interface JourneyPanelProps {
  fromId: string | null
  toId: string | null
  /** Planned upstream, so the map's highlight and this itinerary can't disagree. */
  journey: Journey | null
  stationList: Station[]
  lineList: Line[]
  companyList: Company[]
  /** What the authority is called on this map — the operator every unassigned line falls back to. */
  authorityDisplayName: string
  stations: Record<string, Station>
  onSetFrom: (id: string | null) => void
  onSetTo: (id: string | null) => void
  onSwap: () => void
}

/** Minutes are a promise the map can't really keep, so they're rounded rather than shown to a
 * decimal — "14 min" is a claim about a model, "13.6 min" pretends to a precision nothing here has. */
function formatMinutes(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes))
  if (rounded < 60) return `${rounded} min`
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`
}

function stops(count: number): string {
  return count === 1 ? '1 stop' : `${count} stops`
}

export function JourneyPanel({
  fromId,
  toId,
  journey,
  stationList,
  lineList,
  companyList,
  authorityDisplayName,
  stations,
  onSetFrom,
  onSetTo,
  onSwap,
}: JourneyPanelProps) {
  // Which lines call at each station, in list order. Built once here rather than rescanned for
  // every option — a select of 26 stations would otherwise walk the whole network 26 times.
  const linesByStation = new Map<string, Line[]>()
  for (const line of lineList) {
    if (!line.visible) continue
    for (const node of line.nodes) {
      if (node.kind !== 'station') continue
      const existing = linesByStation.get(node.stationId)
      if (existing) {
        if (!existing.includes(line)) existing.push(line)
      } else {
        linesByStation.set(node.stationId, [line])
      }
    }
  }

  const nameOf = (id: string) => stations[id]?.name?.trim() || 'Unnamed station'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)', padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
          <StationSelect
            label="From"
            value={fromId}
            stationList={stationList}
            linesByStation={linesByStation}
            onChange={onSetFrom}
          />
          <StationSelect
            label="To"
            value={toId}
            stationList={stationList}
            linesByStation={linesByStation}
            onChange={onSetTo}
          />
        </div>
        {/* Reversing a journey is the commonest second question a rider asks, and retyping both
            ends to get there is busywork. Sits beside the pair it acts on, not under them. */}
        <HoverTip label="Swap" placement="bottom">
          <button
            type="button"
            aria-label="Swap from and to"
            onClick={onSwap}
            disabled={!fromId && !toId}
            style={{
              width: '34px',
              height: '34px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '5px',
              color: 'var(--text-secondary)',
              cursor: fromId || toId ? 'pointer' : 'default',
              opacity: fromId || toId ? 1 : 0.5,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4.5 2.5v9M4.5 2.5 2.5 4.6M4.5 2.5l2 2.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9.5 11.5v-9M9.5 11.5l2-2.1M9.5 11.5l-2-2.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </HoverTip>
      </div>

      <Hint fromId={fromId} toId={toId} journey={journey} />

      {journey && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              padding: '8px 0 2px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {formatMinutes(journey.totalMinutes)}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {journey.changes === 0 ? 'direct' : journey.changes === 1 ? '1 change' : `${journey.changes} changes`}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {journey.legs.map((leg, index) => {
              const line = lineList.find(l => l.id === leg.lineId)
              const color = line?.color ?? 'var(--text-muted)'
              const ridden = leg.stationIds.length - 1
              return (
                <div key={`${leg.lineId}-${index}`}>
                  {/* The change between legs, named at the station it happens at — the one thing a
                      rider has to actually do, so it gets its own line rather than a footnote. */}
                  {index > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 0 6px 3px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M2.5 5h9L9.2 2.6M11.5 9h-9l2.3 2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Change at {nameOf(leg.stationIds[0])}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px' }}>
                    {/* The line's own colour, drawn as the track it is: a stop at each end and the
                        ride between them. */}
                    <div style={{ position: 'relative', width: '12px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                      <div style={{ position: 'absolute', top: '7px', bottom: '7px', width: '4px', background: color, borderRadius: '2px' }} />
                      <Stop color={color} top="4px" />
                      <Stop color={color} bottom="4px" />
                    </div>

                    <div style={{ flex: 1, minWidth: 0, paddingBottom: '4px' }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {nameOf(leg.stationIds[0])}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            height: '18px',
                            padding: '0 7px',
                            borderRadius: '9px',
                            background: color,
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {line ? line.name.trim() || `Line ${line.number}` : 'Line'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {stops(ridden)} · {formatMinutes(leg.minutes)}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {nameOf(leg.stationIds[leg.stationIds.length - 1])}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <Operators
            journey={journey}
            lineList={lineList}
            companyList={companyList}
            authorityDisplayName={authorityDisplayName}
          />
        </>
      )}
    </div>
  )
}

/**
 * Who runs the trains on this journey — the small print at the foot of a ticket.
 *
 * Deliberately quiet: it answers a question a rider only sometimes has, and it must not compete
 * with the itinerary above it. Each operator appears once however many of the journey's lines it
 * runs, in the order first ridden, so it reads as a list of companies rather than a list of legs.
 */
function Operators({
  journey,
  lineList,
  companyList,
  authorityDisplayName,
}: {
  journey: Journey
  lineList: Line[]
  companyList: Company[]
  authorityDisplayName: string
}) {
  const seen = new Set<string>()
  const operators: { key: string; name: string; company: Company | null }[] = []

  for (const leg of journey.legs) {
    const line = lineList.find(l => l.id === leg.lineId)
    // An unassigned line is the authority's, which is what the map says everywhere else too.
    const company = (line?.companyId ? companyList.find(c => c.id === line.companyId) : null) ?? null
    const key = company?.id ?? 'authority'
    if (seen.has(key)) continue
    seen.add(key)
    operators.push({ key, name: company ? company.name.trim() || 'Unnamed company' : authorityDisplayName, company })
  }

  if (operators.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '4px 10px',
        marginTop: '10px',
        paddingTop: '8px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '10px',
        color: 'var(--text-muted)',
      }}
    >
      <span style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Operated by</span>
      {operators.map((op, index) => (
        <span key={op.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
          {/* Separates two operators when the row wraps and the gap alone stops reading as a
              break. The authority wears no seal — it isn't a company — so without this the
              names can run together into one apparent title. */}
          {index > 0 && <span aria-hidden style={{ opacity: 0.5 }}>·</span>}
          {op.company && <CompanySymbolIcon symbol={op.company.symbol} size={12} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.name}</span>
        </span>
      ))}
    </div>
  )
}

function Stop({ color, top, bottom }: { color: string; top?: string; bottom?: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        bottom,
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: 'var(--bg-surface)',
        border: `3px solid ${color}`,
        boxSizing: 'border-box',
      }}
    />
  )
}

/** What to say when there's no itinerary to show — which is most of the time, and is a state worth
 * writing for rather than leaving blank. */
function Hint({ fromId, toId, journey }: { fromId: string | null; toId: string | null; journey: unknown }) {
  const message = !fromId
    ? 'Pick a starting station, or click one on the map.'
    : !toId
      ? 'Now pick where you are going.'
      : fromId === toId
        ? 'That is the same station — pick somewhere to go.'
        : journey === null
          ? 'No route between these two. They may be on separate networks, or a connecting line is hidden.'
          : null

  if (!message) return null
  return <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4, paddingTop: '2px' }}>{message}</div>
}
