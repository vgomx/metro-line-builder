import { useEffect, useRef } from 'react'
import { Badge } from 'metro-ds'
import { prefersReducedMotion } from '../useReducedMotion'
import type { RideProgress } from '../canvas/trainMotion'

export interface TripStop {
  id: string
  name: string
  transfer: boolean
}

interface LineTripViewProps {
  color: string
  /** A rail line's stops are drawn as rounded squares, matching the mark they wear on the map. */
  rail?: boolean
  stops: TripStop[]
  /** The live ride on this line, or null for the resting route diagram. */
  ride: RideProgress | null
}

/** Fixed so the spine geometry is predictable: each leg is a single element spanning exactly one
 * row, and the travelling leg's fade can sweep it end to end. */
const ROW_H = 32

/**
 * A line's stations drawn as a route strip rather than a flat list: a coloured spine threading
 * station nodes top to bottom, the way a carriage's line diagram reads. At rest it's just a
 * nicer way to see the route. During a ride it becomes a live trip — the stops behind the train
 * dim (in solid colour, so nothing shows through), the one it's pulling into is called out, and
 * the leg the train is on fades from full colour to the passed tint as it crosses, the fading
 * edge marking where the train is, landing muted exactly as it pulls in.
 */
export function LineTripView({ color, rail = false, stops, ride }: LineTripViewProps) {
  const currentIndex = ride ? stops.findIndex(s => s.id === ride.nextStationId) : -1
  const riding = ride !== null && currentIndex >= 0
  const dir = riding ? ride!.direction : 1
  const reduce = prefersReducedMotion()

  // A solid, opaque dim — a wash of the line colour over the surface, never see-through, so a
  // passed leg can't reveal whatever sits behind the panel.
  const muted = `color-mix(in srgb, ${color} 30%, var(--bg-surface))`

  // A station is behind the train (dim) when it's on the far side of the current stop from the
  // direction of travel. The current stop itself is the highlight; everything the other way is
  // the journey still ahead, drawn in full colour.
  const isPassed = (i: number) => riding && (dir === 1 ? i < currentIndex : i > currentIndex)

  // The state of the leg leaving row `a` (the connector from node a down to node a+1). 'active'
  // is the one leg the train is on right now — full colour, with a fade sweeping across it; the
  // moment it arrives that leg is 'passed' and simply muted.
  const legState = (a: number): 'passed' | 'active' | 'ahead' => {
    if (!riding) return 'ahead'
    if (dir === 1) {
      if (a + 1 < currentIndex) return 'passed'
      if (a + 1 === currentIndex) return ride!.atStation ? 'passed' : 'active'
      return 'ahead'
    }
    if (a > currentIndex) return 'passed'
    if (a === currentIndex) return ride!.atStation ? 'passed' : 'active'
    return 'ahead'
  }

  // Auto-follow: keep the current stop in view as the trip advances.
  const currentRowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!riding) return
    currentRowRef.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }, [currentIndex, riding, reduce])

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

      <div style={{ position: 'relative' }}>
        {stops.map((stop, i) => {
          const passed = isPassed(i)
          const current = riding && i === currentIndex
          const nodeColor = passed ? muted : color
          const state = i < stops.length - 1 ? legState(i) : 'ahead'
          // Base of the leg: full colour ahead, muted once passed. The active leg's base is the
          // *muted* trail — the full-colour overlay sits on top of it and recedes toward the next
          // stop, so what's revealed behind is already the passed tint (no flip on arrival).
          // Under reduced motion there's no sweep, so the active leg just stays full until it's passed.
          const legBase = state === 'ahead' ? color : state === 'passed' ? muted : reduce ? color : muted
          const sweeping = state === 'active' && !reduce
          return (
            <div key={`${stop.id}-${i}`} ref={current ? currentRowRef : undefined} style={{ display: 'flex', alignItems: 'center', height: ROW_H }}>
              <div style={{ position: 'relative', width: '22px', height: '100%', flex: 'none' }}>
                {/* One connector per gap, drawn from this node down into the next row. */}
                {i < stops.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      width: '2px',
                      height: `${ROW_H}px`,
                      background: legBase,
                      overflow: 'hidden',
                      transition: 'background-color 400ms ease',
                    }}
                  >
                    {/* The un-travelled remainder of the leg the train is on: full colour, anchored
                        at the next-stop end, receding toward it over the real travel time. As it
                        collapses it uncovers the muted base behind, and its shrinking edge is where
                        the train is. Keyed by leg so each new hop restarts the sweep from full. */}
                    {sweeping && (
                      <div
                        key={`sweep-${currentIndex}-${dir}`}
                        style={{
                          position: 'absolute',
                          left: 0,
                          width: '100%',
                          height: '100%',
                          ...(dir === 1 ? { bottom: 0 } : { top: 0 }),
                          background: color,
                          transformOrigin: dir === 1 ? 'bottom' : 'top',
                          animation: `mlb-trip-recede ${Math.max(120, ride!.msToNextStation)}ms linear forwards`,
                        }}
                      />
                    )}
                  </div>
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
                    // A square (softly rounded) for rail, a disc for metro — the same shape language
                    // the canvas marks use, so a stop reads the same in the strip as on the map. A
                    // transfer stays a disc even on a rail line, matching the canvas rule that an
                    // interchange is a circle whatever mode meets there.
                    borderRadius: rail && !stop.transfer ? '4px' : '50%',
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
      </div>
    </div>
  )
}
