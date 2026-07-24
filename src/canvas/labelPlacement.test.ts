import { describe, expect, it } from 'vitest'
import type { Station } from '../types'
import { labelGeometry } from './labelPlacement'
import type { LabelPlacement } from './labelPlacement'

/**
 * What the placement search assumes, and what nothing else checks: reserving room for a main
 * station's mode glyphs must never push its card toward the marker it names.
 *
 * The search tests a candidate box against every *other* station's marker and skips the one it
 * belongs to, on the grounds that the label offset already clears it. So when the reserve grew the
 * card rightward whichever side of the marker it sat on, a label to the west grew straight back
 * over the interchange it was naming and nothing caught it.
 *
 * The assertion is deliberately relative rather than absolute — "glyphs never cost clearance",
 * not "the card never touches the marker". A card placed diagonally already grazes the marker's
 * corner by a fraction of a pixel without any glyphs at all, and pinning an absolute rule here
 * would be pinning that quirk rather than this bug.
 */

/** The eight directions the search chooses between, as labelGeometry receives them. */
const DIRECTIONS: { name: string; placement: LabelPlacement }[] = [
  { name: 'S', placement: { angle: Math.PI / 2, anchor: 'middle' } },
  { name: 'E', placement: { angle: 0, anchor: 'start' } },
  { name: 'W', placement: { angle: Math.PI, anchor: 'end' } },
  { name: 'N', placement: { angle: -Math.PI / 2, anchor: 'middle' } },
  { name: 'SE', placement: { angle: Math.PI / 4, anchor: 'start' } },
  { name: 'SW', placement: { angle: (3 * Math.PI) / 4, anchor: 'end' } },
  { name: 'NE', placement: { angle: -Math.PI / 4, anchor: 'start' } },
  { name: 'NW', placement: { angle: (-3 * Math.PI) / 4, anchor: 'end' } },
]

/** Two mode glyphs and the gap between them — what a metro/rail main station reserves. */
const TWO_GLYPHS = 26

const PLAIN_RADIUS = 6.5
const INTERCHANGE_RADIUS = 10

function station(): Station {
  return { id: 's1', name: 'Ironmonger Row', x: 0, y: 0, main: true } as Station
}

/** Geometry is station-local, so the marker sits at the origin — how much of it a box covers. */
function markerOverlap(box: { x: number; y: number; width: number; height: number }, radius: number): number {
  const w = Math.min(box.x + box.width, radius) - Math.max(box.x, -radius)
  const h = Math.min(box.y + box.height, radius) - Math.max(box.y, -radius)
  return w > 0 && h > 0 ? w * h : 0
}

function cardBox(placement: LabelPlacement, isInterchange: boolean, glyphsWidth: number) {
  const g = labelGeometry(station(), placement, isInterchange, glyphsWidth)
  return { x: g.cardX, y: g.cardY, width: g.cardW, height: g.cardH }
}

describe('mode glyphs never cost a label its clearance', () => {
  for (const { name, placement } of DIRECTIONS) {
    for (const isInterchange of [false, true]) {
      const radius = isInterchange ? INTERCHANGE_RADIUS : PLAIN_RADIUS
      const kind = isInterchange ? 'interchange' : 'stop'

      it(`${name}, ${kind}: reserving for glyphs doesn't move the card onto the marker`, () => {
        const bare = markerOverlap(cardBox(placement, isInterchange, 0), radius)
        const glyphed = markerOverlap(cardBox(placement, isInterchange, TWO_GLYPHS), radius)
        expect(glyphed).toBeLessThanOrEqual(bare + 1e-6)
      })

      it(`${name}, ${kind}: the glyph row itself stays off the marker`, () => {
        const g = labelGeometry(station(), placement, isInterchange, TWO_GLYPHS)
        const glyphs = { x: g.glyphsX, y: g.glyphsY - 6, width: TWO_GLYPHS, height: 12 }
        expect(markerOverlap(glyphs, radius)).toBe(0)
      })
    }
  }

  it('pins a westward card by the edge facing the marker and grows it away', () => {
    const west: LabelPlacement = { angle: Math.PI, anchor: 'end' }
    const bare = labelGeometry(station(), west, true, 0)
    const glyphed = labelGeometry(station(), west, true, TWO_GLYPHS)

    expect(glyphed.cardX + glyphed.cardW).toBeCloseTo(bare.cardX + bare.cardW, 5)
    expect(glyphed.cardX).toBeLessThan(bare.cardX)
  })

  it('pins an eastward card by its own facing edge and grows it away too', () => {
    const east: LabelPlacement = { angle: 0, anchor: 'start' }
    const bare = labelGeometry(station(), east, true, 0)
    const glyphed = labelGeometry(station(), east, true, TWO_GLYPHS)

    expect(glyphed.cardX).toBeCloseTo(bare.cardX, 5)
    expect(glyphed.cardX + glyphed.cardW).toBeGreaterThan(bare.cardX + bare.cardW)
  })

  it('keeps a stacked card centred on the marker whether or not it carries glyphs', () => {
    const north: LabelPlacement = { angle: -Math.PI / 2, anchor: 'middle' }
    for (const glyphsWidth of [0, TWO_GLYPHS]) {
      const g = labelGeometry(station(), north, true, glyphsWidth)
      expect(g.cardX + g.cardW / 2).toBeCloseTo(0, 5)
    }
  })
})
