import type { CSSProperties } from 'react'
import type { LineKind } from './types'

/**
 * The transport-mode glyphs, from OpenMoji's black (monochrome) set — the same project the POI
 * icons come from, so the same CC-BY-SA credit covers them. Loaded as raw SVG the way the colour
 * icons are loaded as URLs: globbed eagerly, kept out of the JS bundle's logic, resolved by
 * hexcode. The saved files have OpenMoji's `#000` swapped for `currentColor`, so a glyph takes the
 * colour of wherever it's drawn and inverts cleanly on a dark label.
 */
const MODE_SVGS = import.meta.glob('./assets/openmoji-black/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/** Each mode's OpenMoji glyph. metro and train are the two live modes; tram (1F68A), ferry (26F4)
 * and bus (1F68C) ship alongside for when those modes exist. */
const MODE_HEX: Record<LineKind, string> = { metro: '1F687', rail: '1F686' }

export const MODE_LABEL: Record<LineKind, string> = { metro: 'Metro', rail: 'Rail' }

/** The glyph's drawn size in the label, and the gap between two of them. */
export const MODE_GLYPH_SIZE = 12
export const MODE_GLYPH_GAP = 2

/** The width a row of `count` mode glyphs occupies — what the label card reserves for them. */
export function modeGlyphsWidth(count: number): number {
  return count > 0 ? count * MODE_GLYPH_SIZE + (count - 1) * MODE_GLYPH_GAP : 0
}

/** The glyph's inner markup, its outer <svg> stripped so it can nest under the map's own SVG with a
 * fresh viewBox. Computed once per mode at load. */
const MODE_INNER: Partial<Record<LineKind, string>> = {}
for (const mode of Object.keys(MODE_HEX) as LineKind[]) {
  const raw = MODE_SVGS[`./assets/openmoji-black/${MODE_HEX[mode]}.svg`]
  if (raw) MODE_INNER[mode] = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
}

/**
 * One mode glyph drawn as a nested SVG, for use inside the map's own <svg> (station labels). Every
 * stroke in the black OpenMoji is `currentColor`, so it resolves to the `color` set here — themed,
 * and invertible on a dark pill.
 */
export function ModeGlyphSvg({ mode, x, y, size, color }: { mode: LineKind; x: number; y: number; size: number; color: string }) {
  const inner = MODE_INNER[mode]
  if (!inner) return null
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 72 72"
      style={{ color }}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

/** The same glyph for HTML contexts (a tool picker, say). */
export function ModeGlyphHtml({ mode, size = 16, style }: { mode: LineKind; size?: number; style?: CSSProperties }) {
  const inner = MODE_INNER[mode]
  if (!inner) return null
  return (
    <span
      aria-hidden
      style={{ display: 'inline-block', width: size, height: size, lineHeight: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 72 72" width="100%" height="100%">${inner}</svg>` }}
    />
  )
}
