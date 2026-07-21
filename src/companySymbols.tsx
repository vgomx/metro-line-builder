import type { CompanySymbol } from './types'

/** What a company wears before anyone picks — the plainest mark in the set. */
export const DEFAULT_COMPANY_SYMBOL: CompanySymbol = 'arrow'

/**
 * Ten minimalist company logos, all built from one vocabulary: track, direction, movement.
 * Real operators badge themselves this way — São Paulo's interlocking arrows, Montréal's
 * arrow-in-circle, the railway switch on half of Europe's infrastructure liveries — so the
 * set reads as ten plausible transit identities rather than ten generic glyphs.
 *
 * Redrawn against OpenMoji's transit iconography — the railway-track, the roundabout, the
 * arrows — so each mark is bolder and reads at a glance: the rails recede in perspective
 * like the OpenMoji track rather than sitting flat, the loop wears a clear notch of travel,
 * the compass stamps as a solid star. The ten keys are unchanged, so a saved company keeps
 * whatever it was already wearing.
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
      <path d="M3 8h8.5" />
      <path d="M8 4.5 11.5 8 8 11.5" />
    </>
  ),
  /** Motion as pure repetition — two chevrons driving right. */
  chevrons: <path d="M4 4l4 4-4 4M8.5 4l4 4-4 4" />,
  /** Two flows funnelling into one — the interchange operator, the São Paulo idea. */
  converge: (
    <>
      <path d="M2.5 4.5 7 8 2.5 11.5" />
      <path d="M7 8h6" />
      <path d="M10.5 5.8 13.2 8 10.5 10.2" />
    </>
  ),
  /** Two-way running: up and down on their own tracks. */
  diverge: (
    <>
      <path d="M5 13.5V4M3 6l2-2 2 2" />
      <path d="M11 2.5v9.5M9 10l2 2 2-2" />
    </>
  ),
  /** Service in every direction — a four-point star, filled solid so it stamps like a seal. */
  compass: (
    <path
      d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  /** The circle line: a ring wearing a notch of its direction of travel. */
  loop: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M6.3 1.9 9.3 3 6.9 5.1" />
    </>
  ),
  /** A route dividing — the branch diagram every network map draws. */
  junction: (
    <>
      <path d="M8 14V8M8 8 4.2 4.2M8 8l3.8-3.8" />
      <circle cx="4.2" cy="4.2" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="11.8" cy="4.2" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  /** Railway points: a rail peeling smoothly off the main line. */
  switch: (
    <>
      <path d="M6 2v12" />
      <path d="M6 8.5C6.4 6 8 4.3 11.5 3.5" />
    </>
  ),
  /** Two routes crossing at a shared station. */
  crossing: (
    <>
      <path d="M3 3l10 10M13 3 3 13" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  /** The track itself, receding into the distance — sleepers between two rails. */
  rails: (
    <>
      <path d="M5 13.6 6.8 3" />
      <path d="M11 13.6 9.2 3" />
      <path d="M4.2 12h7.6M5.4 8.4h5.2M6.4 4.9h3.2" />
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
