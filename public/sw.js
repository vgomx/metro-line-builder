/*
 * Service worker — offline capability, which is also what makes the app installable.
 *
 * Deliberately small. A cache that guesses wrong is worse than no cache at all: it serves a
 * stale app to someone who has no idea why the thing they just changed didn't change. So the
 * rules here are narrow and follow what each kind of file actually promises.
 *
 * - The HTML document is the one file whose URL never changes, so it is fetched from the
 *   network first and only falls back to the cached copy when there's no network. That means
 *   a deploy is picked up on the next load rather than whenever the cache happens to expire.
 * - Vite's build puts a content hash in every asset filename, so those URLs are immutable by
 *   construction: if the name matches, the bytes match. Those are safe to serve from cache
 *   first, and they're the bulk of the bytes.
 * - Everything else — the OpenMoji artwork, the icons — is fetched and then kept, since a
 *   landmark symbol is the same symbol forever.
 *
 * Nothing is precached at install. A precache list has to be generated at build time to stay
 * honest, and this project has no build step for it; caching on demand costs one slow first
 * visit and can never be out of step with what was actually deployed.
 */

const CACHE = 'mlb-v1'

self.addEventListener('install', () => {
  // Take over straight away rather than waiting for every tab to close. Safe here because
  // hashed asset URLs can't collide across versions, so a half-updated page isn't possible.
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

/** Vite names built assets `index-C0ffee12.js` — a hash long enough not to be a coincidence. */
function isImmutable(url) {
  return /\/assets\/.*-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(url.pathname)
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request, fallbackToRoot) {
  try {
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) return cached
    // A navigation to any path in scope is this single-page app, so the cached document
    // answers it — without this, going offline on a deep link gets the browser's error page.
    if (fallbackToRoot) {
      const root = await caches.match(new URL('./', self.registration.scope).href)
      if (root) return root
    }
    throw error
  }
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, true))
    return
  }
  event.respondWith(isImmutable(url) ? cacheFirst(request) : networkFirst(request, false))
})
