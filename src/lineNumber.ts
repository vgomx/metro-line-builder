import type { Line, LineKind } from './types'
import { lineKind } from './types'

/** Two digits is what a line badge can seat legibly at its smallest (the canvas chip), and
 * real networks stay well inside it — São Paulo's highest is 15. */
export const MAX_LINE_NUMBER = 99

/** A whole number a line could actually wear. The rule lives here so the field that offers
 * it and the reducer that enforces it can't drift into disagreeing about what's valid. */
export function isUsableLineNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_LINE_NUMBER
}

/**
 * The lowest number no line of this kind is using yet. Numbering stays tight to 1..N rather than
 * always climbing, so retiring a line frees its number for the next one — a map's lines read as a
 * set, and gaps in it look like an accident rather than a decision.
 *
 * Per kind, because metro and rail number independently: a map can carry a Metro 1 and a Rail 1 at
 * once, and each type fills its own 1..N. The badge tells them apart by its fill, not its digit.
 *
 * Not to be confused with `nextLineNumber` on the map state, which is an internal id sequence
 * (`line-7`) that must never be reused, and is not per-kind.
 */
export function nextFreeLineNumber(lines: Line[], kind: LineKind): number {
  const taken = new Set(lines.filter(line => lineKind(line) === kind).map(line => line.number))
  let candidate = 1
  while (taken.has(candidate)) candidate++
  return candidate
}
