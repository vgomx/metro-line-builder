import { OPENMOJI_ICONS } from './openmojiManifest'
import type { OpenMojiIcon } from './openmojiManifest'
import { CUSTOM_ICONS } from './customIcons'

export type { OpenMojiIcon }
export { OPENMOJI_ICONS }

/** Everything the picker offers: OpenMoji's travel-places set plus the landmarks drawn here. */
export const ALL_ICONS: OpenMojiIcon[] = [...OPENMOJI_ICONS, ...CUSTOM_ICONS]

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

/** The same treatment for the landmarks drawn here. A separate directory, and so a separate
 * glob, because the two sets have different authors and different provenance — see
 * customIcons.ts. */
const CUSTOM_ICON_URLS = import.meta.glob('./assets/landmarks/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

/** The asset URL for an icon, or undefined if it isn't one we ship. */
export function openMojiUrl(hexcode: string): string | undefined {
  return ICON_URLS[`./assets/openmoji/${hexcode}.svg`] ?? CUSTOM_ICON_URLS[`./assets/landmarks/${hexcode}.svg`]
}

/**
 * The icons sectioned by subgroup, each section in the order it first appears — which is how a
 * picker would naturally lay them out (all the buildings together, all the ground transport
 * together) rather than as one undifferentiated grid.
 *
 * Grouped by key rather than by consecutive run: the landmarks drawn here belong in a section
 * the manifest has already been through, and a run-based grouping would open a second
 * "Landmarks" further down the list instead of putting them where they belong.
 */
export function openMojiBySubgroup(): { subgroup: string; icons: OpenMojiIcon[] }[] {
  const sections: { subgroup: string; icons: OpenMojiIcon[] }[] = []
  const bySubgroup = new Map<string, OpenMojiIcon[]>()
  for (const icon of ALL_ICONS) {
    let bucket = bySubgroup.get(icon.subgroup)
    if (!bucket) {
      bucket = []
      bySubgroup.set(icon.subgroup, bucket)
      sections.push({ subgroup: icon.subgroup, icons: bucket })
    }
    bucket.push(icon)
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
  const entry = ALL_ICONS.find(i => i.hexcode === hexcode)
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
