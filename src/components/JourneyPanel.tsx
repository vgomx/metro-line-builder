import { Button } from 'metro-ds'
import type { Company, Line, Station } from '../types'
import type { Journey } from '../journey'
import { CompanySymbolIcon } from '../companySymbols'
import { AuthoritySealIcon } from '../authoritySeal'
import { SwapIcon } from '../icons'
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <StationSelect
          label="From"
          value={fromId}
          stationList={stationList}
          linesByStation={linesByStation}
          onChange={onSetFrom}
        />

        {/* Reversing a journey is the commonest second question a rider asks, and retyping both
            ends to get there is busywork. It sits in the gap between the two fields, which is
            where the exchange it performs actually happens, and centred over the pair it acts on
            rather than tucked against one edge.

            Labelled rather than icon-only: two arrows passing each other is a shape you have to
            already know, and a control that appears once in a panel doesn't get the repetition
            that teaches it. The word also drops the tooltip and the aria-label, which existed to
            say what the button can now simply say. */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '-2px 0' }}>
          <Button variant="ghost" size="sm" icon={<SwapIcon />} disabled={!fromId && !toId} onClick={onSwap}>
            Swap
          </Button>
        </div>

        <StationSelect
          label="To"
          value={toId}
          stationList={stationList}
          linesByStation={linesByStation}
          onChange={onSetTo}
        />
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
        // Stacked, one operator per line. Wrapped inline they read as a run-on sentence, and with
        // names this long the wrap point moved with every journey — so which company you were
        // looking at depended on the panel's width rather than on the itinerary.
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '3px',
        marginTop: '10px',
        paddingTop: '8px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '10px',
        color: 'var(--text-muted)',
      }}
    >
      <span style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>Operated by</span>
      {operators.map(op => (
        <span key={op.key} style={{ display: 'flex', alignItems: 'center', gap: '5px', maxWidth: '100%', minWidth: 0 }}>
          {/* Every operator now leads with its own mark — the authority's included — and a mark is
              a cleaner break between names than the separator that used to stand in for one. */}
          {op.company ? <CompanySymbolIcon symbol={op.company.symbol} size={12} /> : <AuthoritySealIcon size={12} />}
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
