import type { GeoFeatureType, Tool } from './types'

/**
 * How many points a geography feature needs before it's a feature: a river is a line and
 * needs two, a park is an area and needs three.
 *
 * One place, because three others were about to hold their own copy — the reducer that
 * enforces it, the chrome that offers the Finish button, and the canvas that answers Enter.
 * They had already drifted: Enter finished on two points whatever the tool, so pressing it on
 * a two-point park reached a reducer that requires three, which threw the draft away without
 * a word.
 */
export const MIN_GEO_POINTS: Record<GeoFeatureType, number> = {
  river: 2,
  park: 3,
}

/** The geography type a tool draws, or null if it draws something else. */
export function geoTypeOfTool(tool: Tool): GeoFeatureType | null {
  if (tool === 'draw-river') return 'river'
  if (tool === 'draw-park') return 'park'
  return null
}

/** How many points the tool in hand needs before its draft can be finished. */
export function minGeoPointsForTool(tool: Tool): number | null {
  const type = geoTypeOfTool(tool)
  return type ? MIN_GEO_POINTS[type] : null
}
