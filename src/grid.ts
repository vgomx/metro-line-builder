export const GRID_SIZE = 40

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

/**
 * Where a point of interest may sit: the same grid halved, so a landmark can take the middle
 * of a square as readily as a corner of one. Stations stay on the full grid — a line has to
 * run through them and every route angle assumes it — but a landmark is answerable to nothing
 * but the space it fits in, and the gaps between crossings are where that space usually is.
 */
export const POI_GRID_SIZE = GRID_SIZE / 2

export function snapToPoiGrid(value: number): number {
  return Math.round(value / POI_GRID_SIZE) * POI_GRID_SIZE
}
