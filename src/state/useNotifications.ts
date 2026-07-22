import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The Transit Authority Gazette — a running feed of the map's big moments, kept for engagement
 * rather than for the record. A new city, a line opening, a concession to a private operator:
 * each earns a headline. It's a running feed across the session's work, not per-map, capped so
 * it can't grow without bound.
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

const ITEMS_KEY = 'metro-line-builder:notifications'
const ENABLED_KEY = 'metro-line-builder:notifications-enabled'
const READ_KEY = 'metro-line-builder:notifications-read'
/** The feed is a highlight reel, not a ledger — old headlines fall off the end. */
const MAX_ITEMS = 40
/** How many headlines the banner shows at once before the oldest is pushed down to the panel. */
export const MAX_BANNER = 3

function loadItems(): Notification[] {
  try {
    const raw = localStorage.getItem(ITEMS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(n => n && typeof n.id === 'string' && typeof n.text === 'string')
  } catch {
    return []
  }
}

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== 'off'
  } catch {
    return true
  }
}

function loadReadAt(): number {
  try {
    return Number(localStorage.getItem(READ_KEY)) || 0
  } catch {
    return 0
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
}

export function useNotifications(): NotificationsApi {
  const [items, setItems] = useState<Notification[]>(loadItems)
  const [enabled, setEnabledState] = useState<boolean>(loadEnabled)
  const [readAt, setReadAt] = useState<number>(loadReadAt)

  // announce is handed to a detection effect that shouldn't be re-subscribed every time the feed
  // changes, so it reads `enabled` through a ref and updates state functionally.
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const seqRef = useRef(0)

  useEffect(() => {
    try {
      localStorage.setItem(ITEMS_KEY, JSON.stringify(items))
    } catch {
      // A blocked localStorage shouldn't cost the feed this session — it just won't outlive it.
    }
  }, [items])

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

  const markRead = useCallback(() => {
    const now = Date.now()
    setReadAt(now)
    try {
      localStorage.setItem(READ_KEY, String(now))
    } catch {
      // Non-fatal: the badge just won't remember it was cleared.
    }
  }, [])

  const clearAll = useCallback(() => setItems([]), [])

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next)
    try {
      localStorage.setItem(ENABLED_KEY, next ? 'on' : 'off')
    } catch {
      // Non-fatal.
    }
  }, [])

  const bannerItems = items.filter(n => !n.dismissed).slice(0, MAX_BANNER)
  const unreadCount = items.filter(n => n.at > readAt).length

  return { items, bannerItems, unreadCount, enabled, announce, dismiss, dismissAll, markRead, clearAll, setEnabled }
}
