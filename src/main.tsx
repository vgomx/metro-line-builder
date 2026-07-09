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
window.addEventListener('gesturestart', e => e.preventDefault())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
