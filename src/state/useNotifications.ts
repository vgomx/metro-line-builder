import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The Transit Authority Gazette — a running feed of a city's big moments, kept for engagement
 * rather than for the record. A new city, a line opening, a concession to a private operator: each
 * earns a headline.
 *
 * The feed belongs to the map it reports on, filed under the same map ids the library uses. A
 * city's history is about that city — carrying one map's opening lines over onto another would
 * make the panel read as someone else's news — so opening another map shows its own run, and a map
 * generated from nothing starts with only its founding headline. Whether the Gazette runs at all
 * is the reader's preference rather than the city's, so that one stays global.
 *
 * Deliberately unobtrusive: a headline shows briefly at the top of the canvas and then retires to
 * the panel behind the top-bar icon, where the whole run is always readable. It can be switched
 * off entirely, and switching it off is remembered.
 */

export interface Notification {
  id: string
  /** The headline, already written in the Gazette's voice. */
  text: string
  at: number
  /** Retired from the top-of-canvas banner (either dismissed or aged out); still in the panel. */
  dismissed: boolean
}

const STORE_KEY = 'metro-line-builder:gazette'
/** Where the feed lived when there was one of it for the whole browser. Read once, then retired. */
const LEGACY_ITEMS_KEY = 'metro-line-builder:notifications'
const LEGACY_READ_KEY = 'metro-line-builder:notifications-read'
/** Not per city: whether the Gazette runs is about the reader, not the map. */
const ENABLED_KEY = 'metro-line-builder:notifications-enabled'
/** The feed is a highlight reel, not a ledger — old headlines fall off the end. */
const MAX_ITEMS = 40
/** How many headlines the banner shows at once before the oldest is pushed down to the panel. */
export const MAX_BANNER = 3
/** Comfortably more than the library keeps, so a city's run is still there if it is re-opened,
 * without the store growing without end behind a library that has long since dropped it. */
const MAX_RECORDS = 24

interface GazetteRecord {
  items: Notification[]
  /** When the reader last opened the panel on this city — drives its unread badge. */
  readAt: number
  /** Last touched, so the store can shed the coldest cities rather than an arbitrary few. */
  at: number
}

function emptyRecord(): GazetteRecord {
  return { items: [], readAt: 0, at: 0 }
}

function coerceItems(raw: unknown): Notification[] {
  if (!Array.isArray(raw)) return []
  return (raw as Notification[])
    .filter(n => n && typeof n.id === 'string' && typeof n.text === 'string')
    .slice(0, MAX_ITEMS)
}

function readStore(): Record<string, GazetteRecord> {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const store: Record<string, GazetteRecord> = {}
    for (const [id, record] of Object.entries(parsed as Record<string, GazetteRecord>)) {
      store[id] = { items: coerceItems(record?.items), readAt: Number(record?.readAt) || 0, at: Number(record?.at) || 0 }
    }
    return store
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, GazetteRecord>) {
  const ids = Object.keys(store).sort((a, b) => (store[b].at || 0) - (store[a].at || 0))
  const trimmed: Record<string, GazetteRecord> = {}
  for (const id of ids.slice(0, MAX_RECORDS)) trimmed[id] = store[id]
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(trimmed))
  } catch {
    // A blocked localStorage shouldn't cost the feed this session — it just won't outlive it.
  }
}

/**
 * This city's run, adopting the old single global feed the first time one is asked for.
 *
 * Those headlines were written about whatever city was open while the Gazette was still one feed
 * for the whole browser, so they belong to that city — handing them to the map being opened right
 * now keeps a reader's history rather than blanking it. Consumed once: the legacy keys are cleared
 * as they're adopted, so the next map to open starts with a clean front page.
 */
function loadFor(mapId: string): GazetteRecord {
  const store = readStore()
  const existing = store[mapId]
  if (existing) return existing

  try {
    const legacy = localStorage.getItem(LEGACY_ITEMS_KEY)
    if (legacy) {
      const adopted: GazetteRecord = {
        items: coerceItems(JSON.parse(legacy)),
        readAt: Number(localStorage.getItem(LEGACY_READ_KEY)) || 0,
        at: Date.now(),
      }
      localStorage.removeItem(LEGACY_ITEMS_KEY)
      localStorage.removeItem(LEGACY_READ_KEY)
      store[mapId] = adopted
      writeStore(store)
      return adopted
    }
  } catch {
    // A corrupt legacy feed is not worth failing over — this city simply starts with no news.
  }
  return emptyRecord()
}

/** Drop a city's front page, for when its map is dropped from the library. */
export function forgetGazette(mapId: string) {
  const store = readStore()
  if (!(mapId in store)) return
  delete store[mapId]
  writeStore(store)
}

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== 'off'
  } catch {
    return true
  }
}

export interface NotificationsApi {
  items: Notification[]
  /** The still-showing headlines, newest first, capped for the banner. */
  bannerItems: Notification[]
  /** How many the reader hasn't opened the panel to see yet — drives the top-bar badge. */
  unreadCount: number
  enabled: boolean
  /** Post a headline. A no-op while notifications are off. */
  announce: (text: string) => void
  /** Retire one headline from the banner; it stays in the panel. */
  dismiss: (id: string) => void
  /** Retire every headline from the banner at once. */
  dismissAll: () => void
  /** Mark the whole feed seen — clears the badge. Called when the panel opens. */
  markRead: () => void
  /** Empty the feed entirely. */
  clearAll: () => void
  setEnabled: (next: boolean) => void
  /** Follow the app onto another city — its own front page, from its own record. */
  switchTo: (mapId: string) => void
}

export function useNotifications(initialMapId: string): NotificationsApi {
  const mapIdRef = useRef(initialMapId)
  const initial = useRef<GazetteRecord | null>(null)
  if (initial.current === null) initial.current = loadFor(initialMapId)
  const [items, setItems] = useState<Notification[]>(initial.current.items)
  const [readAt, setReadAt] = useState<number>(initial.current.readAt)
  const [enabled, setEnabledState] = useState<boolean>(loadEnabled)

  // announce is handed to a detection effect that shouldn't be re-subscribed every time the feed
  // changes, so it reads `enabled` through a ref and updates state functionally.
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const seqRef = useRef(0)

  // Filed under whichever city is open as this runs, which is what keeps a switch from writing one
  // map's headlines into another's record: switchTo moves the id and the feed in the same breath.
  useEffect(() => {
    const store = readStore()
    store[mapIdRef.current] = { items, readAt, at: Date.now() }
    writeStore(store)
  }, [items, readAt])

  const announce = useCallback((text: string) => {
    if (!enabledRef.current) return
    // Ids can't lean on Date.now alone: two headlines from one action land in the same millisecond.
    const id = `n-${Date.now()}-${seqRef.current++}`
    setItems(prev => [{ id, text, at: Date.now(), dismissed: false }, ...prev].slice(0, MAX_ITEMS))
  }, [])

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, dismissed: true } : n)))
  }, [])

  const dismissAll = useCallback(() => {
    setItems(prev => prev.map(n => (n.dismissed ? n : { ...n, dismissed: true })))
  }, [])

  const markRead = useCallback(() => setReadAt(Date.now()), [])

  const clearAll = useCallback(() => setItems([]), [])

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next)
    try {
      localStorage.setItem(ENABLED_KEY, next ? 'on' : 'off')
    } catch {
      // Non-fatal.
    }
  }, [])

  const switchTo = useCallback((mapId: string) => {
    if (mapId === mapIdRef.current) return
    mapIdRef.current = mapId
    const record = loadFor(mapId)
    setItems(record.items)
    setReadAt(record.readAt)
  }, [])

  const bannerItems = items.filter(n => !n.dismissed).slice(0, MAX_BANNER)
  const unreadCount = items.filter(n => n.at > readAt).length

  return { items, bannerItems, unreadCount, enabled, announce, dismiss, dismissAll, markRead, clearAll, setEnabled, switchTo }
}
