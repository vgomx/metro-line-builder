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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
