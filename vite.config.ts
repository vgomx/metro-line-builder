import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages project site serves this app from /metro-line-builder/, not the
  // domain root, so asset URLs need the matching base path in production.
  base: process.env.GITHUB_PAGES ? '/metro-line-builder/' : '/',
  plugins: [react()],
  // metro-ds is a local `file:` dependency (symlinked) with its own node_modules/react.
  // Without dedupe, the production build (Rollup) bundles two separate React copies —
  // only one gets activated by react-dom, so components using the other's hooks get a
  // null dispatcher ("Cannot read properties of null (reading 'useState')"). Dev mode
  // doesn't hit this (Vite's dev resolution collapses them), only `vite build` does.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  // metro-ds is a local `file:` dependency (symlinked). Without these, Vite's
  // dependency optimizer treats its linked node_modules as churning source and
  // repeatedly re-optimizes/full-reloads the page.
  optimizeDeps: {
    exclude: ['metro-ds'],
  },
  server: {
    watch: {
      ignored: ['**/metro-ds/node_modules/**'],
    },
  },
})
