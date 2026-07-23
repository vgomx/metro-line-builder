import { describe, expect, it } from 'vitest'
import { buildRandomMap } from './generate'
import { lineKind } from './types'
import type { DataSnapshot } from './state/useMapState'

/** The distinct modes calling at a station, derived the way the renderer does — from the lines. */
function stationModes(map: DataSnapshot, stationId: string): Set<string> {
  const modes = new Set<string>()
  for (const line of Object.values(map.lines)) {
    if (line.nodes.some(n => n.kind === 'station' && n.stationId === stationId)) modes.add(lineKind(line))
  }
  return modes
}

// Generation is random, so every invariant is checked across many maps rather than one.
const RUNS = 50

describe('buildRandomMap — rail', () => {
  it('threads rail through a mostly-metro network', () => {
    for (let t = 0; t < RUNS; t++) {
      const lines = Object.values(buildRandomMap().lines)
      if (lines.length < 2) continue // a one-line map is all metro by construction
      const rail = lines.filter(l => l.kind === 'rail').length
      const metro = lines.filter(l => lineKind(l) === 'metro').length
      expect(rail, `run ${t}`).toBeGreaterThanOrEqual(1)
      expect(metro, `run ${t}`).toBeGreaterThanOrEqual(1)
      // Metro stays the majority (or ties on a two-line map).
      expect(metro, `run ${t}`).toBeGreaterThanOrEqual(rail)
    }
  })

  it('numbers each mode from 1, independently', () => {
    for (let t = 0; t < RUNS; t++) {
      const lines = Object.values(buildRandomMap().lines)
      const metroNums = lines.filter(l => lineKind(l) === 'metro').map(l => l.number).sort((a, b) => a - b)
      const railNums = lines.filter(l => l.kind === 'rail').map(l => l.number).sort((a, b) => a - b)
      // Each mode's numbers are a gapless 1..N of its own — a metro Line 1 and a rail Line 1 coexist.
      expect(metroNums, `run ${t} metro`).toEqual(metroNums.map((_, i) => i + 1))
      expect(railNums, `run ${t} rail`).toEqual(railNums.map((_, i) => i + 1))
    }
  })

  it('marks a metro-meets-rail crossing as a main station', () => {
    for (let t = 0; t < RUNS; t++) {
      const map = buildRandomMap()
      if (Object.values(map.lines).length < 2) continue
      const mains = Object.values(map.stations).filter(s => s.main)
      const modalMain = mains.find(s => stationModes(map, s.id).size >= 2)
      expect(modalMain, `run ${t}: a generated map should mark its modal interchange main`).toBeTruthy()
    }
  })
})
