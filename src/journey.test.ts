import { describe, expect, it } from 'vitest'
import type { Line, Station } from './types'
import { CHANGE_MINUTES, DWELL_MINUTES, MINUTES_PER_UNIT, planJourney } from './journey'

/**
 * A toy network, laid out on a grid so every distance is obvious by eye:
 *
 *        A(0,0) ── B(120,0) ── C(240,0) ── D(360,0)      line 1, west to east
 *                     │
 *                  E(120,120)                             line 2, meeting line 1 at B
 *
 * Every hop is 120 units, which at a minute per 60 units is 2 minutes of riding plus the dwell.
 */
const station = (id: string, x: number, y: number): Station => ({ id, name: id, x, y, transfer: false, main: false })

const STATIONS: Record<string, Station> = {
  A: station('A', 0, 0),
  B: station('B', 120, 0),
  C: station('C', 240, 0),
  D: station('D', 360, 0),
  E: station('E', 120, 120),
  Z: station('Z', 999, 999), // served by nothing
}

const line = (id: string, number: number, stationIds: string[], overrides: Partial<Line> = {}): Line => ({
  id,
  number,
  name: `Line ${number}`,
  color: '#000000',
  nodes: stationIds.map(stationId => ({ kind: 'station' as const, stationId })),
  visible: true,
  companyId: null,
  ...overrides,
})

const LINE_1 = line('l1', 1, ['A', 'B', 'C', 'D'])
const LINE_2 = line('l2', 2, ['E', 'B'])
const NETWORK = [LINE_1, LINE_2]

/** One hop: 120 units of riding, plus the stop at the far end. */
const HOP = 120 * MINUTES_PER_UNIT + DWELL_MINUTES

describe('planJourney', () => {
  it('rides a single line straight through', () => {
    const journey = planJourney('A', 'D', NETWORK, STATIONS)!
    expect(journey.legs).toHaveLength(1)
    expect(journey.changes).toBe(0)
    expect(journey.legs[0].lineId).toBe('l1')
    expect(journey.legs[0].stationIds).toEqual(['A', 'B', 'C', 'D'])
    expect(journey.totalMinutes).toBeCloseTo(3 * HOP)
  })

  it('rides backwards as happily as forwards', () => {
    const journey = planJourney('D', 'A', NETWORK, STATIONS)!
    expect(journey.legs[0].stationIds).toEqual(['D', 'C', 'B', 'A'])
    expect(journey.totalMinutes).toBeCloseTo(3 * HOP)
  })

  it('changes lines, and charges for it once', () => {
    const journey = planJourney('E', 'C', NETWORK, STATIONS)!
    expect(journey.changes).toBe(1)
    expect(journey.legs.map(l => l.lineId)).toEqual(['l2', 'l1'])
    expect(journey.legs[0].stationIds).toEqual(['E', 'B'])
    expect(journey.legs[1].stationIds).toEqual(['B', 'C'])
    // Two hops of riding and exactly one interchange — the change is not double-charged, and it
    // sits between the legs rather than inside either.
    expect(journey.totalMinutes).toBeCloseTo(2 * HOP + CHANGE_MINUTES)
    expect(journey.legs[0].minutes).toBeCloseTo(HOP)
    expect(journey.legs[1].minutes).toBeCloseTo(HOP)
  })

  it('prefers a longer ride to a needless change', () => {
    // A parallel express from A to D. Riding line 1 the whole way is 3 hops; hopping onto the
    // express and back would be shorter in distance but costs two changes.
    const express = line('l3', 3, ['B', 'C'])
    const journey = planJourney('A', 'D', [...NETWORK, express], STATIONS)!
    expect(journey.changes).toBe(0)
    expect(journey.legs[0].lineId).toBe('l1')
  })

  it('counts distance along the drawn route, not station to station', () => {
    // Same two stations, but the line detours through a waypoint far to the north, so it must
    // come out slower than the straight line between them.
    const straight = line('s', 1, ['A', 'C'])
    const scenic: Line = {
      ...straight,
      id: 'scenic',
      nodes: [
        { kind: 'station', stationId: 'A' },
        { kind: 'point', x: 120, y: 400 },
        { kind: 'station', stationId: 'C' },
      ],
    }
    const quick = planJourney('A', 'C', [straight], STATIONS)!
    const slow = planJourney('A', 'C', [scenic], STATIONS)!
    expect(slow.totalMinutes).toBeGreaterThan(quick.totalMinutes)
    // The detour is not a stop, so it adds distance without adding a dwell.
    expect(slow.legs[0].stationIds).toEqual(['A', 'C'])
  })

  it('ignores hidden lines', () => {
    const hidden = line('l2h', 2, ['E', 'B'], { visible: false })
    expect(planJourney('E', 'C', [LINE_1, hidden], STATIONS)).toBeNull()
  })

  it('returns null when there is no route, or nothing to plan', () => {
    expect(planJourney('A', 'Z', NETWORK, STATIONS)).toBeNull()
    expect(planJourney('A', 'A', NETWORK, STATIONS)).toBeNull()
    expect(planJourney('A', 'nope', NETWORK, STATIONS)).toBeNull()
  })

  it('survives a line whose node points at a deleted station', () => {
    const broken = line('b', 9, ['A', 'ghost', 'C'])
    const journey = planJourney('A', 'C', [broken], STATIONS)!
    expect(journey.legs[0].stationIds).toEqual(['A', 'C'])
  })
})
