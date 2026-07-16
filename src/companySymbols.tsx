import type { CompanySymbol } from './types'

/** What a company wears before anyone picks — the plainest mark in the set. */
export const DEFAULT_COMPANY_SYMBOL: CompanySymbol = 'arrow'

/**
 * Ten minimalist company logos, all built from one vocabulary: track, direction, movement.
 * Real operators badge themselves this way — São Paulo's interlocking arrows, Montréal's
 * arrow-in-circle, the railway switch on half of Europe's infrastructure liveries — so the
 * set reads as ten plausible transit identities rather than ten generic glyphs.
 *
 * Everything is drawn in currentColor so a mark takes the ink of wherever it sits — muted
 * in lists, primary in headers — never a colour of its own. Shared 16x16 grid; the stroke
 * is a touch heavier than the app's chrome icons (1.5 vs 1.3) because these render larger
 * and should carry logo weight, not UI weight. `satisfies` keeps this record and the
 * COMPANY_SYMBOLS list in types.ts locked to each other.
 */
const SYMBOL_ART = {
  /** The plainest logo there is: one arrow, headed somewhere. */
  arrow: (
    <>
      <path d="M3.5 12.5 12.5 3.5" />
      <path d="M6.5 3.5h6v6" />
    </>
  ),
  /** Motion as pure repetition — two chevrons driving right. */
  chevrons: <path d="M4.5 3.5 9 8l-4.5 4.5M9 3.5 13.5 8 9 12.5" />,
  /** Two flows meeting head-on, offset like passing trains — the São Paulo idea. */
  converge: (
    <>
      <path d="M2 5.5h8M7.5 3l2.8 2.5L7.5 8" />
      <path d="M14 10.5H6M8.5 8l-2.8 2.5L8.5 13" />
    </>
  ),
  /** Two-way running: up and down on their own tracks. */
  diverge: (
    <>
      <path d="M5.5 14V3.8M2.9 6.4l2.6-2.6 2.6 2.6" />
      <path d="M10.5 2v10.2M7.9 9.6l2.6 2.6 2.6-2.6" />
    </>
  ),
  /** Service in every direction — four points, filled solid so it stamps like a seal. */
  compass: (
    <g fill="currentColor" stroke="none">
      <path d="M8 1.4 10.3 4.9H5.7Z" />
      <path d="M8 14.6 5.7 11.1h4.6Z" />
      <path d="M14.6 8 11.1 10.3V5.7Z" />
      <path d="M1.4 8 4.9 5.7v4.6Z" />
    </g>
  ),
  /** The circle line: a ring wearing its direction of travel. */
  loop: (
    <>
      <circle cx="8" cy="8" r="5.2" />
      <path d="M6.8 0.8 10.8 2.8 6.8 4.8Z" fill="currentColor" stroke="none" />
    </>
  ),
  /** A route dividing — the branch diagram every network map draws. */
  junction: (
    <>
      <path d="M8 14V8.8M8 8.8 3.8 4.6M8 8.8l4.2-4.2" />
      <circle cx="3.8" cy="4.6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12.2" cy="4.6" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  /** Railway points: a track peeling off the main line. */
  switch: <path d="M5 2.5v11M11 13.5V9.8L5 4.8" />,
  /** Two routes crossing at a shared station. */
  crossing: (
    <>
      <path d="M3.2 3.2l9.6 9.6M12.8 3.2 3.2 12.8" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  /** The track itself, seen from above. */
  rails: (
    <>
      <path d="M5.5 2.5v11M10.5 2.5v11" />
      <path d="M4 5.2h8M4 8h8M4 10.8h8" />
    </>
  ),
} satisfies Record<CompanySymbol, JSX.Element>

export function CompanySymbolIcon({ symbol, size = 14 }: { symbol: CompanySymbol; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SYMBOL_ART[symbol] ?? SYMBOL_ART[DEFAULT_COMPANY_SYMBOL]}
    </svg>
  )
}
