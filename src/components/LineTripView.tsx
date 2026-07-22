import { useEffect, useRef } from 'react'
import { Badge } from 'metro-ds'
import { TrainIcon } from '../icons'
import { prefersReducedMotion } from '../useReducedMotion'
import type { RideProgress } from '../canvas/trainMotion'

export interface TripStop {
  id: string
  name: string
  transfer: boolean
}

interface LineTripViewProps {
  color: string
  stops: TripStop[]
  /** The live ride on this line, or null for the resting route diagram. */
  ride: RideProgress | null
}

/** Fixed so the spine geometry is predictable: the glyph slides exactly one row per hop, and the
 * connectors can be single elements rather than two half-height pieces. */
const ROW_H = 32

/**
 * A line's stations drawn as a route strip rather than a flat list: a coloured spine threading
 * station nodes top to bottom, the way a carriage's line diagram reads. At rest it's just a
 * nicer way to see the route. During a ride it becomes a live trip — the stops behind the train
 * dim (in solid colour, so nothing shows through), the one it's pulling into is called out, and
 * a train glyph slides down the spine to the next stop over the real travel time, arriving as
 * the actual train does.
 */
export function LineTripView({ color, stops, ride }: LineTripViewProps) {
  const currentIndex = ride ? stops.findIndex(s => s.id === ride.nextStationId) : -1
  const riding = ride !== null && currentIndex >= 0
  const dir = riding ? ride!.direction : 1

  // A solid, opaque dim — a wash of the line colour over the surface, never see-through, so a
  // passed leg can't reveal whatever sits behind the panel.
  const muted = `color-mix(in srgb, ${color} 30%, var(--bg-surface))`

  // A station is behind the train (dim) when it's on the far side of the current stop from the
  // direction of travel. The current stop itself is the highlight; everything the other way is
  // the journey still ahead, drawn in full colour.
  const isPassed = (i: number) => riding && (dir === 1 ? i < currentIndex : i > currentIndex)
  // A leg is dim only once the train has cleared both its ends; the leg being travelled and the
  // road ahead stay full colour, so nothing flips to dim under the sliding glyph.
  const legPassed = (a: number) => riding && (dir === 1 ? a + 1 < currentIndex : a > currentIndex)

  // Auto-follow: keep the current stop in view as the trip advances.
  const currentRowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!riding) return
    currentRowRef.current?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [currentIndex, riding])

  const terminusIndex = riding ? (dir === -1 ? 0 : stops.length - 1) : -1
  const terminusName = terminusIndex >= 0 ? stops[terminusIndex]?.name : null
  const remaining = riding ? stops.filter((_, i) => !isPassed(i)).length : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {riding && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: '6px 10px',
            marginBottom: '6px',
            borderRadius: '8px',
            background: `color-mix(in srgb, ${color} 12%, var(--bg-surface))`,
            border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            {terminusName ? `Toward ${terminusName}` : 'On the line'}
          </span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {ride!.atStation ? 'Now at ' : 'Next stop: '}
            <span style={{ color }}>{stops[currentIndex]?.name}</span>
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {remaining} {remaining === 1 ? 'stop' : 'stops'} to {terminusName ?? 'the end'}
          </span>
        </div>
      )}

      {/* position:relative so the sliding train glyph can be laid over the whole spine. */}
      <div style={{ position: 'relative' }}>
        {stops.map((stop, i) => {
          const passed = isPassed(i)
          const current = riding && i === currentIndex
          const nodeColor = passed ? muted : color
          // The leg leaving this row (to the next node): dim only once fully behind the train.
          const legColor = legPassed(i) ? muted : color
          return (
            <div key={`${stop.id}-${i}`} ref={current ? currentRowRef : undefined} style={{ display: 'flex', alignItems: 'center', height: ROW_H }}>
              <div style={{ position: 'relative', width: '22px', height: '100%', flex: 'none' }}>
                {/* One connector per gap, drawn from this node down into the next row — so a leg is
                    a single element that recolours as a whole, with a soft fade when it dims. */}
                {i < stops.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      width: '2px',
                      height: `${ROW_H}px`,
                      background: legColor,
                      transition: 'background-color 400ms ease',
                    }}
                  />
                )}
                <div
                  style={{
                    position: 'absolute',
                    left: '4px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: current ? '15px' : '13px',
                    height: current ? '15px' : '13px',
                    marginLeft: current ? '-1px' : 0,
                    borderRadius: '50%',
                    border: `2.5px solid ${nodeColor}`,
                    background: stop.transfer ? nodeColor : 'var(--bg-surface)',
                    boxShadow: current ? `0 0 0 3px color-mix(in srgb, ${color} 25%, transparent)` : 'none',
                    transition: 'width 150ms ease, box-shadow 150ms ease, border-color 400ms ease, background-color 400ms ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-tight)', flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: current ? 600 : 400,
                    color: current ? 'var(--text-primary)' : passed ? 'var(--text-muted)' : 'var(--text-secondary)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    transition: 'color 400ms ease',
                  }}
                  title={stop.name}
                >
                  {stop.name}
                </span>
                {stop.transfer && (
                  <Badge variant="primary" style={{ fontSize: '9px', padding: '1px 5px' }}>
                    Transfer
                  </Badge>
                )}
              </div>
            </div>
          )
        })}

        {/* The train itself, sliding down the spine to the stop it's pulling into. Its target is the
            current node; a persistent element means each new leg transitions from where it already
            is — the previous stop — over exactly the travel time the sample reported, so it lands
            in step with the real train. ease-in-out mirrors how the train accelerates out of a
            station and decelerates into the next. */}
        {riding && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: '4px',
              top: 0,
              width: '13px',
              height: '13px',
              marginTop: '-6.5px',
              transform: `translateY(${currentIndex * ROW_H + ROW_H / 2}px)`,
              transition: ride!.atStation || prefersReducedMotion() ? 'none' : `transform ${Math.max(120, ride!.msToNextStation)}ms ease-in-out`,
              color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <TrainIcon />
          </div>
        )}
      </div>
    </div>
  )
}
