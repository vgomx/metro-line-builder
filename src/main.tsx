import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Ctrl+wheel and trackpad pinch are the OS/browser's page-zoom gesture everywhere
// outside the canvas (which has its own d3-zoom handling, scoped to the <svg>).
// Left unblocked, pinching or ctrl-scrolling over a side panel zooms the whole
// page's layout instead of doing nothing, which reads as a broken app rather
// than an app that just doesn't support that gesture there.
window.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault() }, { passive: false })
// Safari's own pinch gesture, which is the same page-zoom problem as above on a trackpad
// and on iPadOS. It has to stay blocked over the panels, but NOT over the canvas: there the
// pinch is the map's own zoom, and swallowing it at the window left an iPad unable to zoom
// the one thing worth zooming.
window.addEventListener('gesturestart', e => {
  if ((e.target as HTMLElement | null)?.closest('svg[data-map-canvas]')) return
  e.preventDefault()
})

// The blue selection rectangle on an iPad pinch — reported three times, because the first
// two fixes were aimed at the wrong layer. CSS `user-select: none` governs whether a
// selection is *drawn*; a preventDefault on touchstart tried to stop the *gesture*. Neither
// cancels the selection itself, and WebKit starts one from a two-finger gesture regardless.
//
// `selectstart` is the event that fires the instant a selection begins, and preventing it is
// the one lever that stops the selection at its source — the piece both earlier attempts
// missed. It's blocked everywhere except inside the fields you actually type into, which is
// the whole of the app's selectable text; a canvas tool has nothing else worth selecting.
document.addEventListener('selectstart', e => {
  const target = e.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable="true"]')) return
  e.preventDefault()
})

// The service worker is what makes the app installable, and what lets a map be worked on
// with no connection — which for something that keeps its data in the browser anyway is the
// natural state, not an edge case.
//
// Production only. In development a cache sitting in front of the dev server means editing a
// file and reloading onto the previous version, which is a long afternoon before anyone
// suspects the service worker. BASE_URL rather than a fixed path because the app is served
// from a subdirectory on GitHub Pages, and a worker can only control its own directory down.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // An install that fails costs offline support and nothing else, so it stays quiet
      // rather than putting a console error in front of someone drawing a map.
    })
  })
}

/** Long enough that the splash reads as a thing that happened rather than a flash of
 * something. On a warm cache the app is ready well inside this. */
const SPLASH_MIN_MS = 480
/** How long to hold for the webfont before giving up on it. Barlow arrives from a CDN, so on
 * a bad connection it may not arrive at all, and a splash that waits forever is worse than
 * labels that restyle themselves a moment late. */
const FONT_WAIT_CAP_MS = 1400
/** Matches the fade in the splash's own stylesheet. */
const SPLASH_FADE_MS = 320

/**
 * Takes the splash away once there's something worth showing underneath.
 *
 * It waits on the webfont as well as on React, because the map is mostly labels: letting it
 * through early means a canvas full of fallback text that reflows to Barlow a moment later,
 * which is precisely the flicker a splash is for. The wait is capped, and every path ends
 * with the element gone — a splash that outlives its welcome covers the whole app.
 */
function dismissSplash() {
  const splash = document.getElementById('splash')
  if (!splash) return

  const started = performance.now()
  const fonts = document.fonts
    ? Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, FONT_WAIT_CAP_MS))])
    : Promise.resolve()

  void fonts.then(() => {
    const remaining = Math.max(0, SPLASH_MIN_MS - (performance.now() - started))
    setTimeout(() => {
      splash.dataset.ready = 'true'
      setTimeout(() => splash.remove(), SPLASH_FADE_MS)
    }, remaining)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// After render, so the app is mounted and laying out behind the splash while it's still up.
dismissSplash()
