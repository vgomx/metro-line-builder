import type { ReactNode } from 'react'
import type { CompanySymbol } from './types'

/** What a company wears before anyone picks — the plainest mark in the set. */
export const DEFAULT_COMPANY_SYMBOL: CompanySymbol = 'arrow'

/**
 * Ten transit-operator badges, drawn new in OpenMoji's house style — a bold dark rim, a flat
 * colour fill, a simple white mark inside — from the vocabulary a rail company badges itself
 * with: track, rail, the points, arrows, direction. Each takes its own operator colour so a
 * list of companies reads as a row of liveries rather than ten variations of one glyph.
 *
 * This replaced an earlier set of thin monochrome line-marks, which were too faint and too
 * abstract to carry as logos. These are coloured on purpose and don't follow the theme's ink
 * the way a UI glyph would — the same way the map's landmarks keep their own colour — but the
 * bright fills read against both a light and a dark tile, which the dark rim alone would not.
 *
 * The ten keys are unchanged from the line-mark set, so a saved company keeps its slot. The
 * 32×32 grid gives the rounded OpenMoji geometry room the old 16×16 didn't.
 */
const RIM = { cx: 16, cy: 16, r: 13, stroke: '#000000', strokeWidth: 2 } as const
/** The white mark inside a badge — one weight across the set so the ten read as a family. */
const MARK = { fill: 'none', stroke: '#ffffff', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const SOLID = { fill: '#ffffff', stroke: 'none' } as const

/** A coloured roundel with the operator's rim, and whatever mark goes inside it. */
function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <>
      <circle {...RIM} fill={color} />
      {children}
    </>
  )
}

const SYMBOL_ART = {
  /** The plainest badge there is: one arrow, headed somewhere. */
  arrow: (
    <Badge color="#4EA3E0">
      <path d="M10 16h9.5M15 11l5 5-5 5" {...MARK} />
    </Badge>
  ),
  /** Motion as pure repetition — two chevrons driving right. */
  chevrons: (
    <Badge color="#F59100">
      <path d="M11 10.5l5.5 5.5-5.5 5.5M16.5 10.5l5.5 5.5-5.5 5.5" {...MARK} />
    </Badge>
  ),
  /** Two flows funnelling into one — the interchange operator, the São Paulo idea. */
  converge: (
    <Badge color="#16A6A6">
      <path d="M9 11 15.5 16 9 21M15.5 16H23M20 13l3 3-3 3" {...MARK} />
    </Badge>
  ),
  /** Two-way running: one line dividing into a pair of directions. */
  diverge: (
    <Badge color="#9B6FC4">
      <path
        d="M9 16h6.5M15.5 16 22 11.5M15.5 16 22 20.5M22 11.5l-2.6.1M22 11.5l-.1 2.6M22 20.5l-2.6-.1M22 20.5l-.1-2.6"
        {...MARK}
      />
    </Badge>
  ),
  /** Service in every direction — a four-point compass star, the authority's seal. */
  compass: (
    <Badge color="#F1B31C">
      <path
        d="M16 7.5 18.4 13.6 24.5 16 18.4 18.4 16 24.5 13.6 18.4 7.5 16 13.6 13.6Z"
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </Badge>
  ),
  /** The circle line: a ring wearing its direction of travel. */
  loop: (
    <Badge color="#5FA43A">
      <path d="M20.8 11.2A6.4 6.4 0 1 0 22 14.5" {...MARK} />
      <path d="M18.2 6.3 22.6 8.2 20.7 12.6Z" {...SOLID} />
    </Badge>
  ),
  /** A route dividing — the branch diagram every network map draws. */
  junction: (
    <Badge color="#E8604C">
      <path d="M16 23V16M16 16 10.5 10.5M16 16 21.5 10.5" {...MARK} />
      <circle cx="10.5" cy="10.5" r="1.9" fill="#ffffff" />
      <circle cx="21.5" cy="10.5" r="1.9" fill="#ffffff" />
    </Badge>
  ),
  /** Railway points: a rail peeling smoothly off the main line. */
  switch: (
    <Badge color="#5C6BC0">
      <path d="M13 9v14M13 16.5C14 13.5 16.5 12 20 11.5" {...MARK} />
    </Badge>
  ),
  /** Two routes crossing at a shared station. */
  crossing: (
    <Badge color="#B07A3F">
      <path d="M10 10 22 22M22 10 10 22" {...MARK} />
      <circle cx="16" cy="16" r="2.2" fill="#ffffff" />
    </Badge>
  ),
  /** The track itself — sleepers laddered between two rails. */
  rails: (
    <Badge color="#6E8494">
      <path d="M12.6 9 13.7 23M19.4 9 18.3 23M11.8 12h8.4M11.4 16h9.2M11 20h10" {...MARK} />
    </Badge>
  ),
} satisfies Record<CompanySymbol, JSX.Element>

export function CompanySymbolIcon({ symbol, size = 14 }: { symbol: CompanySymbol; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      {SYMBOL_ART[symbol] ?? SYMBOL_ART[DEFAULT_COMPANY_SYMBOL]}
    </svg>
  )
}
