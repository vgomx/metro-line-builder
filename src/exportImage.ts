import condensedBoldUrl from 'metro-ds/assets/fonts/BarlowCondensed-Bold.ttf?url'

export type ImageFormat = 'png' | 'svg'

/** Space left around the network, in world units. Roughly a station label's width, so a name
 * at the outer edge of the map isn't shaved by the crop. */
const MARGIN = 48

/** PNG pixels per world unit. At 2 the biggest maps land around 3000px across — big enough to
 * hold up when someone zooms into a corner, small enough to paste into a document. */
const PNG_SCALE = 2

/** The page the map is drawn on. Exports commit to the light theme whatever the editor is
 * wearing: a transit map is a printed artifact, and a dark one lands badly in every document
 * it will be pasted into. */
const LIGHT_PAGE = '#F7F7F7'

/** Presentation properties worth freezing. Everything here can carry a `var()` or a
 * `color-mix()` in this app, neither of which survives outside the page that defined them. */
const FROZEN_PROPERTIES = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'font-family',
  'font-size',
  'font-weight',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'paint-order',
] as const

async function fetchAsDataUri(url: string, mimeHint?: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string | null>(resolve => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // FileReader reports whatever the server said, which for a font is often
        // application/octet-stream — no use to a browser deciding whether to parse it.
        resolve(mimeHint ? result.replace(/^data:[^;]*/, `data:${mimeHint}`) : result)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Every custom property declared on `:root`, which is where the light palette lives.
 *
 * The design system doesn't have a `[data-theme='light']` rule — light is the default on
 * `:root` and dark is an override on `[data-theme='dark']`. So marking an element as light
 * does nothing at all: it matches no rule and quietly inherits whatever the document root is
 * wearing. (This is not hypothetical. The first version of the exporter did exactly that and
 * produced a map with a light background, dark label cards and dark station centres — the
 * page colour was right only because it's hardcoded.)
 *
 * Reading the `:root` declarations straight out of the stylesheet gets the light values
 * whatever the editor is set to, with no flipping the live page to light for a frame on the
 * way past.
 */
function lightThemeVariables(): Record<string, string> {
  const variables: Record<string, string> = {}
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      // A cross-origin stylesheet — the webfont CSS — refuses to be read and has no tokens.
      continue
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule) || rule.selectorText !== ':root') continue
      for (const name of Array.from(rule.style)) {
        if (name.startsWith('--')) variables[name] = rule.style.getPropertyValue(name)
      }
    }
  }
  return variables
}

function lightThemeProbe(): HTMLElement {
  const probe = document.createElement('div')
  // Set as inline custom properties, which beat the dark override inherited from the root and
  // cascade down to the cloned map inside.
  for (const [name, value] of Object.entries(lightThemeVariables())) probe.style.setProperty(name, value)
  probe.style.position = 'absolute'
  probe.style.left = '-99999px'
  probe.style.top = '0'
  probe.style.width = '2000px'
  probe.style.height = '2000px'
  probe.style.pointerEvents = 'none'
  document.body.appendChild(probe)
  return probe
}

/**
 * Turn the live canvas into an SVG document that stands on its own.
 *
 * The editor's SVG leans on four things that exist only inside the running app: CSS custom
 * properties for every colour, `color-mix()` for the tinted ones, a webfont loaded by the
 * page, and same-origin URLs for the landmark artwork. A file that keeps any of those is a
 * file that renders as black text in a fallback face with holes where the icons were — and
 * for PNG it's worse, because an SVG rasterised through an `<img>` is sealed off from the
 * document entirely and loads none of them.
 *
 * So everything gets resolved to literals here: computed styles are read back off a clone
 * mounted under a light-themed probe and written on as plain attributes, the icons are
 * inlined as data URIs, and the font is embedded as one.
 */
async function buildStandaloneSvg(source: SVGSVGElement): Promise<{ markup: string; width: number; height: number }> {
  const probe = lightThemeProbe()
  try {
    const clone = source.cloneNode(true) as SVGSVGElement
    clone.removeAttribute('style')
    clone.removeAttribute('class')
    clone.setAttribute('width', '100%')
    clone.setAttribute('height', '100%')
    probe.appendChild(clone)

    // Scaffolding: the click-catching surface, the grid, the trains. All of it belongs to the
    // editor rather than to the map, and the click surface is 20000 units across, which would
    // otherwise decide the crop on its own.
    for (const node of Array.from(clone.querySelectorAll('[data-export="exclude"]'))) node.remove()

    // The zoom transform is where you happened to be looking, not part of the map. A direct
    // child rather than the first <g> anywhere, so a group inside <defs> can never be mistaken
    // for the map's contents.
    const content = clone.querySelector<SVGGElement>(':scope > g')
    if (!content) throw new Error('The map has nothing in it to export.')
    content.removeAttribute('transform')

    const cloneElements = [clone, ...Array.from(clone.querySelectorAll('*'))]

    // Styles come off the CLONE, which is sitting under the light-themed probe — reading the
    // original would resolve every var() against whichever theme the editor is in.
    for (const element of cloneElements) {
      if (!(element instanceof SVGElement)) continue
      const computed = window.getComputedStyle(element)
      for (const property of FROZEN_PROPERTIES) {
        const value = computed.getPropertyValue(property)
        if (!value || value === 'normal' || value === 'auto') continue
        element.setAttribute(property, value.trim())
      }
      element.removeAttribute('style')
      element.removeAttribute('class')
    }
    // Landmark artwork, fetched and inlined. Deduplicated because a map with eight cathedrals
    // shouldn't carry the cathedral eight times.
    const images = Array.from(clone.querySelectorAll('image'))
    const uniqueHrefs = Array.from(
      new Set(images.map(image => image.getAttribute('href') ?? image.getAttribute('xlink:href')).filter((h): h is string => !!h)),
    )
    const dataUris = new Map<string, string>()
    await Promise.all(
      uniqueHrefs.map(async href => {
        if (href.startsWith('data:')) return
        const uri = await fetchAsDataUri(href, 'image/svg+xml')
        if (uri) dataUris.set(href, uri)
      }),
    )
    for (const image of images) {
      const href = image.getAttribute('href') ?? image.getAttribute('xlink:href')
      const uri = href ? dataUris.get(href) : null
      if (uri) {
        image.setAttribute('href', uri)
        image.removeAttribute('xlink:href')
      } else if (href && !href.startsWith('data:')) {
        // An icon that couldn't be fetched would render as a broken-image glyph in some
        // viewers and a blank in others; leaving it out is the tidier failure.
        image.remove()
      }
    }

    // Crop to the map. Measured after the scaffolding is gone and the zoom is off, so this is
    // the network's own extent rather than the window's.
    const box = content.getBBox()
    // A blank canvas measures nothing, and cropping to nothing yields a file the size of the
    // margin — a picture of an empty page, downloaded and named after a map that isn't there.
    if (box.width === 0 && box.height === 0) throw new Error("There's nothing on the map to export yet.")

    const width = Math.max(1, box.width + MARGIN * 2)
    const height = Math.max(1, box.height + MARGIN * 2)
    const minX = box.x - MARGIN
    const minY = box.y - MARGIN

    clone.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`)
    clone.setAttribute('width', String(width))
    clone.setAttribute('height', String(height))
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

    // The page itself, as a rectangle. An SVG with no background is transparent, which reads
    // as black the moment it lands somewhere dark.
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    background.setAttribute('x', String(minX))
    background.setAttribute('y', String(minY))
    background.setAttribute('width', String(width))
    background.setAttribute('height', String(height))
    background.setAttribute('fill', LIGHT_PAGE)
    clone.insertBefore(background, clone.firstChild)

    // The typeface, carried inside the file. Only the condensed bold is shipped with the
    // design system, so the 600-weight labels export at 700 — the wrong weight in the right
    // face, which is a far smaller lie than the right weight in Helvetica. It's declared
    // across the range so no viewer decides to synthesise its own bold on top.
    const fontUri = await fetchAsDataUri(condensedBoldUrl, 'font/ttf')
    if (fontUri) {
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      style.textContent = `@font-face{font-family:'Barlow Condensed';font-style:normal;font-weight:400 700;src:url(${fontUri}) format('truetype');}`
      clone.insertBefore(style, clone.firstChild)
    }

    const markup = new XMLSerializer().serializeToString(clone)
    return { markup, width, height }
  } finally {
    probe.remove()
  }
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  // Revoked on a later turn of the loop: Safari hasn't necessarily started reading the blob
  // by the time click() returns, and pulling the URL out from under it cancels the download.
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

function fileName(mapName: string, extension: string): string {
  const base = mapName.trim().replace(/\s+/g, '-').toLowerCase() || 'metro-map'
  return `${base}.${extension}`
}

export async function exportMapAsImage(svg: SVGSVGElement, mapName: string, format: ImageFormat): Promise<void> {
  const { markup, width, height } = await buildStandaloneSvg(svg)

  if (format === 'svg') {
    download(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), fileName(mapName, 'svg'))
    return
  }

  // Base64 rather than a URL-encoded string: the markup contains quotes, angle brackets and
  // a font's worth of arbitrary bytes, and encodeURIComponent on that scale is both slower
  // and easier to get subtly wrong.
  const encoded = btoa(unescape(encodeURIComponent(markup)))
  const image = new Image()
  image.decoding = 'sync'

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('The map could not be rendered as an image.'))
    image.src = `data:image/svg+xml;base64,${encoded}`
  })

  // Some browsers only finish laying out an SVG's text after decode() resolves; without this
  // the first export of a session can rasterise before the embedded font is applied.
  if (image.decode) {
    try {
      await image.decode()
    } catch {
      // decode() rejects on some SVG sources even when the image is perfectly usable.
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * PNG_SCALE)
  canvas.height = Math.round(height * PNG_SCALE)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser has no 2D canvas to draw the map on.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The map could not be encoded as a PNG.')
  download(blob, fileName(mapName, 'png'))
}
