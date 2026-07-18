import type { OpenMojiIcon } from './openmojiManifest'

/**
 * Landmark symbols drawn for this project, in OpenMoji's visual language: the same 72×72
 * canvas, the same stone/white/window-blue palette, the same 2px black line layer over a flat
 * colour layer. They fill gaps the travel-places set leaves — a generic obelisk, monument,
 * tower and statue, where OpenMoji ships only named ones (Tokyo tower, the Statue of Liberty).
 *
 * They are NOT OpenMoji artwork and are kept in their own directory and manifest so that stays
 * unambiguous: nothing here is attributed to OpenMoji's authors, and OpenMoji's own files
 * remain byte-for-byte as published. Matching a style is not copying a work — no path data was
 * taken from their files — but these ship under CC BY-SA 4.0 all the same, so a set that reads
 * as one set is licensed as one set.
 *
 * `hexcode` is a misnomer for these (they have no codepoint), but it's the field the picker,
 * the renderer and every saved map key an icon by, and inventing a parallel identity for four
 * files would cost more than the borrowed name does. The `mlb-` prefix keeps them from ever
 * colliding with a real codepoint.
 */
export const CUSTOM_ICONS: OpenMojiIcon[] = [
  { hexcode: 'mlb-obelisk', emoji: '', name: 'obelisk', subgroup: 'place-other' },
  { hexcode: 'mlb-monument', emoji: '', name: 'monument', subgroup: 'place-other' },
  { hexcode: 'mlb-old-tower', emoji: '', name: 'old tower', subgroup: 'place-other' },
  { hexcode: 'mlb-statue', emoji: '', name: 'statue', subgroup: 'place-other' },
]
