import type { CompanySymbol } from './types'

/** What a company wears before anyone picks — a plain direction sign. */
export const DEFAULT_COMPANY_SYMBOL: CompanySymbol = 'arrow'

/**
 * Ten transit-operator emblems, drawn as little illustrations in OpenMoji's house style: a
 * black outline around every element, flat colour fills, rounded geometry. Not a glyph in a
 * coloured circle — actual objects a railway is made of, which is what a company badges
 * itself with: the track, the points, a colour-light signal, a level-crossing buck, a buffer
 * stop, a turntable, a tunnel portal, a junction, a direction sign, and a compass for the
 * authority.
 *
 * They replaced a set of thin monochrome marks that were too plain to read as logos. Coloured
 * on purpose — like the map's landmarks they keep their own colour rather than following the
 * theme's ink — and the fills carry against a light or a dark tile alike.
 *
 * Rails use a black underlay stroke with a lighter one on top, which is how a line gets an
 * outline without being drawn as a closed shape. Everything sits on a 72×72 grid, OpenMoji's
 * own, so the proportions and stroke weights match its icons. The ten keys are unchanged from
 * the marks they replace, so a saved company keeps its slot even though the art is new; the
 * key names no longer describe the picture, so SYMBOL_LABEL carries the real name.
 */
export const SYMBOL_LABEL: Record<CompanySymbol, string> = {
  arrow: 'Direction sign',
  chevrons: 'Tunnel',
  converge: 'Buffer stop',
  diverge: 'Signal',
  compass: 'Compass',
  loop: 'Turntable',
  junction: 'Junction',
  switch: 'Track switch',
  crossing: 'Level crossing',
  rails: 'Railway track',
}

const INK = '#000000'

const SYMBOL_ART = {
  /** A direction sign: an arrow-shaped board on a post. */
  arrow: (
    <>
      <rect x="26" y="61" width="22" height="5" rx="2" fill="#9B9B9A" stroke={INK} strokeWidth={2.4} />
      <rect x="34" y="34" width="6" height="28" rx="2" fill="#9B9B9A" stroke={INK} strokeWidth={2.4} />
      <path d="M12 12H48L60 24L48 36H12Z" fill="#1E88E5" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      <path d="M20 24H40M34 18l6 6-6 6" fill="none" stroke="#ffffff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  /** A tunnel portal cut into a green hillside, with the track running in. */
  chevrons: (
    <>
      <rect x="8" y="57" width="56" height="9" rx="2" fill="#A57939" stroke={INK} strokeWidth={2.4} />
      <path d="M12 60V40A24 24 0 0 1 60 40V60Z" fill="#7FB04A" stroke={INK} strokeWidth={2.8} strokeLinejoin="round" />
      <path d="M23 60V44A13 13 0 0 1 49 44V60Z" fill="#2B2B2B" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M30 60V50M42 60V50" fill="none" stroke="#8C8C8A" strokeWidth={2.6} strokeLinecap="round" />
    </>
  ),
  /** A buffer stop at the end of the line — where two rails run out. */
  converge: (
    <>
      <path d="M28 64V36M44 64V36" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <path d="M28 64V36M44 64V36" fill="none" stroke="#C4C3C1" strokeWidth={3.4} strokeLinecap="round" />
      <path d="M24 36 33 26M48 36 39 26" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      <rect x="19" y="22" width="34" height="10" rx="3" fill="#EA5A47" stroke={INK} strokeWidth={2.6} />
      <rect x="26" y="32" width="7" height="6" rx="2" fill="#3F3F3F" stroke={INK} strokeWidth={2} />
      <rect x="39" y="32" width="7" height="6" rx="2" fill="#3F3F3F" stroke={INK} strokeWidth={2} />
    </>
  ),
  /** A colour-light signal — red over amber over green on a post. */
  diverge: (
    <>
      <rect x="26" y="61" width="20" height="5" rx="2" fill="#9B9B9A" stroke={INK} strokeWidth={2.4} />
      <rect x="33" y="34" width="6" height="28" rx="2" fill="#7A7A78" stroke={INK} strokeWidth={2.4} />
      <rect x="26" y="8" width="20" height="30" rx="5" fill="#3F3F3F" stroke={INK} strokeWidth={2.6} />
      <circle cx="36" cy="15" r="4" fill="#EA5A47" stroke={INK} strokeWidth={1.6} />
      <circle cx="36" cy="23" r="4" fill="#F1B31C" stroke={INK} strokeWidth={1.6} />
      <circle cx="36" cy="31" r="4" fill="#5C9E31" stroke={INK} strokeWidth={1.6} />
    </>
  ),
  /** A compass rose — the authority's seal, its needle pointing north. */
  compass: (
    <>
      <circle cx="36" cy="36" r="26" fill="#F3F1EC" stroke={INK} strokeWidth={2.8} />
      <path d="M36 12 42.5 34 36 60 29.5 34Z" fill="#EA5A47" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M12 36 34 29.5 60 36 34 42.5Z" fill="#ffffff" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
    </>
  ),
  /** A turntable: the round pit that swings a locomotive about, track laid across it. */
  loop: (
    <>
      <circle cx="36" cy="36" r="25" fill="#D0CFCE" stroke={INK} strokeWidth={2.8} />
      <path d="M13 36H59" fill="none" stroke={INK} strokeWidth={8} />
      <path d="M13 36H59" fill="none" stroke="#8C8C8A" strokeWidth={4} />
      <path d="M22 31v10M31 31v10M41 31v10M50 31v10" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <circle cx="36" cy="36" r="3.5" fill="#3F3F3F" stroke={INK} strokeWidth={2} />
    </>
  ),
  /** A junction — a single track dividing into two. */
  junction: (
    <>
      <rect x="26" y="56" width="20" height="6" rx="2" fill="#A57939" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M30 63V42L18 20M42 63V42L54 20" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30 63V42L18 20M42 63V42L54 20" fill="none" stroke="#C4C3C1" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  /** Railway points: the switch that sends a train onto the diverging road, worked by its stand. */
  switch: (
    <>
      <g stroke={INK} strokeWidth={2.4} strokeLinejoin="round" fill="#A57939">
        <rect x="22" y="52" width="30" height="6" rx="2" />
        <rect x="25" y="40" width="26" height="5.5" rx="2" />
      </g>
      <path d="M30 60V16M44 60V40C44 30 52 24 60 22" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <path d="M30 60V16M44 60V40C44 30 52 24 60 22" fill="none" stroke="#C4C3C1" strokeWidth={3.4} strokeLinecap="round" />
      <circle cx="18" cy="40" r="5.5" fill="#EA5A47" stroke={INK} strokeWidth={2.4} />
      <path d="M18 34.5V26" fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round" />
    </>
  ),
  /** A level crossing — the white crossbuck on its post, a red lamp at the cross. */
  crossing: (
    <>
      <rect x="24" y="61" width="24" height="5" rx="2" fill="#9B9B9A" stroke={INK} strokeWidth={2.4} />
      <rect x="33" y="30" width="6" height="32" rx="2" fill="#9B9B9A" stroke={INK} strokeWidth={2.4} />
      <g stroke={INK} strokeWidth={2.4} strokeLinejoin="round" fill="#ffffff">
        <rect x="10" y="15" width="52" height="9" rx="3" transform="rotate(28 36 20)" />
        <rect x="10" y="15" width="52" height="9" rx="3" transform="rotate(-28 36 20)" />
      </g>
      <circle cx="36" cy="20" r="4" fill="#EA5A47" stroke={INK} strokeWidth={2} />
    </>
  ),
  /** The track itself — sleepers laddered between two rails, receding into the distance. */
  rails: (
    <>
      <g stroke={INK} strokeWidth={2.6} strokeLinejoin="round" fill="#A57939">
        <rect x="13" y="54" width="46" height="7" rx="2" />
        <rect x="19" y="42" width="34" height="6" rx="2" />
        <rect x="24" y="32" width="24" height="5" rx="1.6" />
        <rect x="28" y="24" width="16" height="4.4" rx="1.4" />
      </g>
      <path d="M25 63 31 20M47 63 41 20" fill="none" stroke={INK} strokeWidth={7.5} strokeLinecap="round" />
      <path d="M25 63 31 20M47 63 41 20" fill="none" stroke="#C4C3C1" strokeWidth={3.6} strokeLinecap="round" />
    </>
  ),
} satisfies Record<CompanySymbol, JSX.Element>

export function CompanySymbolIcon({ symbol, size = 14 }: { symbol: CompanySymbol; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72">
      {SYMBOL_ART[symbol] ?? SYMBOL_ART[DEFAULT_COMPANY_SYMBOL]}
    </svg>
  )
}
