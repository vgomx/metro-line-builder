import type { CSSProperties } from 'react'

/**
 * The two faces karma is kept in: pleased and furious.
 *
 * From OpenMoji's colour set — the same project the landmark icons and the mode glyphs come from,
 * so the CC BY-SA credit the app already carries covers these too. Kept in their own directory
 * rather than alongside the landmarks, because `scripts/fetch-openmoji.mjs` wipes that one on every
 * run and these two aren't in the travel-places group it refetches. They ship exactly as published:
 * unlike the black mode glyphs, nothing is rewritten to `currentColor` — the yellow and the red
 * *are* the signal here, so a tinted face would say less than the face itself does.
 *
 * Fetched from https://unpkg.com/openmoji@17.0.0/color/svg/<hexcode>.svg — the same CDN and pinned
 * version the icon script uses, so refreshing them by hand is a one-line curl.
 */
const FACE_SVGS = import.meta.glob('./assets/openmoji-faces/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/** Which way karma just went — and so which face speaks for it. */
export type KarmaTone = 'glad' | 'cross'

/** 😃 grinning face with big eyes, and 😡 enraged face. */
const FACE_HEX: Record<KarmaTone, string> = { glad: '1F603', cross: '1F621' }

/** The ink each tone writes in: the running total, the figures that fly off the badge, the
 * sparkline. Drawn from the faces themselves — OpenMoji's own red for anger, and a green for
 * approval, since the face's yellow is too pale to read as text on a light panel. */
export const KARMA_COLOR: Record<KarmaTone, string> = { glad: '#1a9c5b', cross: '#d22f27' }

/** Which face a running total wears. Zero is not yet a grievance, so it stays glad. */
export function toneOf(points: number): KarmaTone {
  return points < 0 ? 'cross' : 'glad'
}

/** The face's inner markup, its outer <svg> stripped so it can nest under a fresh viewBox.
 * Computed once per face at load. */
const FACE_INNER: Partial<Record<KarmaTone, string>> = {}
for (const tone of Object.keys(FACE_HEX) as KarmaTone[]) {
  const raw = FACE_SVGS[`./assets/openmoji-faces/${FACE_HEX[tone]}.svg`]
  if (raw) FACE_INNER[tone] = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
}

/** One karma face, for the HTML side of the app — the badge, its panel, and the faces that fly. */
export function KarmaFace({ tone, size = 16, style }: { tone: KarmaTone; size?: number; style?: CSSProperties }) {
  const inner = FACE_INNER[tone]
  if (!inner) return null
  return (
    <span
      aria-hidden
      style={{ display: 'inline-block', width: size, height: size, lineHeight: 0, flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 72 72" width="100%" height="100%">${inner}</svg>` }}
    />
  )
}
