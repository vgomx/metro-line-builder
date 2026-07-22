import { Badge } from 'metro-ds'
import { TrainIcon } from '../icons'
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

type StopStatus = 'passed' | 'current' | 'ahead' | 'none'

/**
 * A line's stations drawn as a route strip rather than a flat list: a coloured spine threading
 * station nodes top to bottom, the way a carriage's line diagram reads. At rest it's just a
 * nicer way to see the route. During a ride it becomes a live trip — the stops behind the train
 * dim away, the one it's pulling into is called out, and the ones still ahead read as the
 * remaining journey toward the terminus it's currently heading for.
 */
export function LineTripView({ color, stops, ride }: LineTripViewProps) {
  const nextIndex = ride ? stops.findIndex(s => s.id === ride.nextStationId) : -1
  const riding = ride !== null && nextIndex >= 0

  const statusOf = (i: number): StopStatus => {
    if (!riding) return 'none'
    if (i === nextIndex) return 'current'
    // "Behind" depends on which way the train is running: heading toward the last station,
    // lower indices are behind; heading toward the first, higher indices are.
    const behind = ride!.direction === 1 ? i < nextIndex : i > nextIndex
    return behind ? 'passed' : 'ahead'
  }

  // Everything from the train's next stop to the end of its current direction is the journey left.
  const terminusIndex = riding ? (ride!.direction === 1 ? stops.length - 1 : 0) : -1
  const terminusName = terminusIndex >= 0 ? stops[terminusIndex]?.name : null
  const remaining = riding ? stops.filter((_, i) => statusOf(i) !== 'passed').length : 0

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
            <span style={{ color }}>{stops[nextIndex]?.name}</span>
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {remaining} {remaining === 1 ? 'stop' : 'stops'} to {terminusName ?? 'the end'}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {stops.map((stop, i) => {
          const status = statusOf(i)
          const passed = status === 'passed'
          const current = status === 'current'
          const dim = passed ? 0.45 : 1
          return (
            <div key={`${stop.id}-${i}`} style={{ display: 'flex', alignItems: 'stretch', minHeight: '30px' }}>
              {/* The rail: a spine that connects node to node, trimmed to a half-length at the two
                  termini so it starts and ends on a station rather than dangling into space. */}
              <div style={{ position: 'relative', width: '22px', flex: 'none' }}>
                {i > 0 && (
                  <div style={{ position: 'absolute', left: '10px', top: 0, width: '2px', height: '50%', background: color, opacity: passed || statusOf(i - 1) === 'passed' ? 0.45 : 1 }} />
                )}
                {i < stops.length - 1 && (
                  <div style={{ position: 'absolute', left: '10px', top: '50%', width: '2px', height: '50%', background: color, opacity: passed ? 0.45 : 1 }} />
                )}
                {/* The station node — filled for an interchange, hollow otherwise. */}
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
                    border: `2.5px solid ${color}`,
                    background: stop.transfer ? color : 'var(--bg-surface)',
                    opacity: dim,
                    boxShadow: current ? `0 0 0 3px color-mix(in srgb, ${color} 25%, transparent)` : 'none',
                    transition: 'width 150ms ease, box-shadow 150ms ease',
                  }}
                />
                {/* The train, riding the node it's pulling into (or sitting at). */}
                {current && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      color,
                      display: 'flex',
                    }}
                  >
                    <TrainIcon />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-tight)', flex: 1, padding: '4px 0', opacity: dim }}>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: current ? 600 : 400,
                    color: current ? 'var(--text-primary)' : 'var(--text-secondary)',
                    flex: 1,
                  }}
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
