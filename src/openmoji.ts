import { OPENMOJI_ICONS } from './openmojiManifest'
import type { OpenMojiIcon } from './openmojiManifest'

export type { OpenMojiIcon }
export { OPENMOJI_ICONS }

/**
 * Every shipped icon's URL, keyed by the path Vite globs it under.
 *
 * `query: '?url'` is what keeps these out of the JS bundle: each SVG is emitted as its own
 * hashed asset and this map holds only the URLs, so the ~470kB of artwork is fetched by the
 * browser on demand and cached, rather than parsed as part of the app. Eager, because the
 * URLs themselves are tiny and a picker wants them all at once without a waterfall.
 */
const ICON_URLS = import.meta.glob('./assets/openmoji/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

/** The asset URL for an icon, or undefined if that codepoint isn't one we ship. */
export function openMojiUrl(hexcode: string): string | undefined {
  return ICON_URLS[`./assets/openmoji/${hexcode}.svg`]
}

/**
 * The icons sectioned by OpenMoji's own subgrouping, in the order the manifest lists them —
 * which is how a picker would naturally lay them out (all the buildings together, all the
 * ground transport together) rather than as one undifferentiated grid of 141.
 */
export function openMojiBySubgroup(): { subgroup: string; icons: OpenMojiIcon[] }[] {
  const sections: { subgroup: string; icons: OpenMojiIcon[] }[] = []
  for (const icon of OPENMOJI_ICONS) {
    const last = sections[sections.length - 1]
    if (last && last.subgroup === icon.subgroup) last.icons.push(icon)
    else sections.push({ subgroup: icon.subgroup, icons: [icon] })
  }
  return sections
}

/**
 * Readable section headings for OpenMoji's subgroup slugs. Anything not listed falls back to
 * the slug itself, so a future icon set widening the groups degrades to something legible
 * rather than to nothing.
 */
export const SUBGROUP_LABELS: Record<string, string> = {
  hotel: 'Hotels',
  'place-building': 'Buildings',
  'place-geographic': 'Landscape',
  'place-map': 'Maps & markers',
  'place-other': 'Landmarks',
  'place-religious': 'Places of worship',
  'transport-air': 'Air',
  'transport-ground': 'Ground',
  'transport-water': 'Water',
}

/** What the point-of-interest tool starts on. OpenMoji's map pin lives in a group we don't
 * ship, so the neutral stand-in is the classical building — a civic landmark, which is what
 * most things worth marking on a transit map turn out to be. */
export const DEFAULT_POI_ICON = '1F3DB'

/** The icon's own name, title-cased — the default label for a landmark just dropped. */
export function openMojiLabel(hexcode: string): string {
  const entry = OPENMOJI_ICONS.find(i => i.hexcode === hexcode)
  if (!entry) return 'Point of interest'
  return entry.name.charAt(0).toUpperCase() + entry.name.slice(1)
}

/**
 * The drag payload a picker swatch carries and the canvas reads back on drop: an icon's
 * hexcode under a private MIME type. Private rather than text/plain so the canvas can tell
 * "a symbol from our palette" from any old dragged text — the drop is only offered, and only
 * accepted, when this type is present.
 */
export const POI_DRAG_MIME = 'application/x-metro-poi'
