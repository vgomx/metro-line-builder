import type { Line } from './types'

/** Two digits is what a line badge can seat legibly at its smallest (the canvas chip), and
 * real networks stay well inside it — São Paulo's highest is 15. */
export const MAX_LINE_NUMBER = 99

/** A whole number a line could actually wear. The rule lives here so the field that offers
 * it and the reducer that enforces it can't drift into disagreeing about what's valid. */
export function isUsableLineNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_LINE_NUMBER
}

/**
 * The lowest number no line is using yet. Numbering stays tight to 1..N rather than always
 * climbing, so retiring a line frees its number for the next one — a map's lines read as a
 * set, and gaps in it look like an accident rather than a decision.
 *
 * Not to be confused with `nextLineNumber` on the map state, which is an internal id
 * sequence (`line-7`) that must never be reused.
 */
export function nextFreeLineNumber(lines: Line[]): number {
  const taken = new Set(lines.map(line => line.number))
  let candidate = 1
  while (taken.has(candidate)) candidate++
  return candidate
}
