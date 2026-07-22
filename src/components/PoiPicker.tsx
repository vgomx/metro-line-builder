import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCoarsePointer } from '../useCoarsePointer'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Input } from 'metro-ds'
import { openMojiBySubgroup, openMojiUrl, SUBGROUP_LABELS } from '../openmoji'
import { POI_ICON_SIZE } from '../canvas/PoiNode'

interface PoiPickerProps {
  /** The symbol currently waiting to be tapped onto the map (touch only), or null. */
  armedIcon: string | null
  /** Pick a symbol up, or put it back down by picking the same one again. */
  onArm: (hexcode: string | null) => void
  /** The canvas's current zoom, so the tile carried over the palette is the size the landmark will be. */
  scale: number
  /** Place this symbol without a pointer — the keyboard's way onto the map. */
  onPlaceByKeyboard: (hexcode: string) => void
  /** A drag has lifted this symbol off the palette. */
  onPlacementBegin: (hexcode: string) => void
  /** The drag has moved to this screen point; overCanvas says whether it's over the map. */
  onPlacementMove: (clientX: number, clientY: number, overCanvas: boolean) => void
  /** The drag ended here; when overCanvas, this is where the symbol lands. */
  onPlacementEnd: (hexcode: string, clientX: number, clientY: number, overCanvas: boolean) => void
}

/**
 * The palette that stands beside the toolbar while the point-of-interest tool is live.
 * Symbols are dragged straight from here onto the map: what you pick up is what lands, and
 * it lands where you let go — no mode to arm and nothing to remember between the two halves
 * of the gesture. The tool is modal, so the picker is too: it appears with the tool and
 * leaves with it.
 *
 * The drag is one gesture for mouse and finger alike, driven by pointer events rather than
 * HTML5 drag-and-drop (which never fires on touch, and whose free-floating ghost never matched
 * how a landmark already on the map moves). Once the pointer crosses onto the canvas, the map
 * itself shows the landmark snapped to the grid cell it would land on, stepping and ticking
 * exactly as an existing one does when it's slid around — see MapCanvas's poiPreview. Over the
 * palette, before it reaches the map, a small tile carries under the pointer so you can see what
 * you've picked up.
 */
const MIN_DRAG_TILE = 18

/** A drag only begins on a pull past this — small enough that the lift feels immediate, large
 * enough not to trip on the wobble of a tap. On touch the pull must also be more sideways than
 * vertical, since the palette scrolls vertically (touch-action: pan-y) and an up/down swipe is
 * a browse, not a lift. */
const DRAG_THRESHOLD = 8

interface DragState {
  hexcode: string
  url?: string
  startX: number
  startY: number
  pointerId: number
  started: boolean
}

export function PoiPicker({ scale, onPlaceByKeyboard, armedIcon, onArm, onPlacementBegin, onPlacementMove, onPlacementEnd }: PoiPickerProps) {
  const [query, setQuery] = useState('')
  const coarse = useCoarsePointer()
  const groups = useMemo(() => openMojiBySubgroup(), [])

  // The live gesture, held in a ref so the pointer handlers read it without a stale closure.
  // `preview` — the tile under the pointer while it's still over the palette — is the only part
  // that re-renders. `dragged` guards the click that follows a drag, so a drag doesn't also arm.
  const drag = useRef<DragState | null>(null)
  const dragged = useRef(false)
  const [preview, setPreview] = useState<{ x: number; y: number; url?: string; size: number } | null>(null)

  const isOverCanvas = (x: number, y: number) => !!document.elementFromPoint(x, y)?.closest('svg[data-map-canvas]')

  // Over the map, the canvas draws the snapped ghost, so the carry tile steps aside; over the
  // palette, the tile is all there is to show what's in hand.
  const updatePlacement = (x: number, y: number, d: DragState) => {
    const over = isOverCanvas(x, y)
    onPlacementMove(x, y, over)
    setPreview(over ? null : { x, y, url: d.url, size: Math.max(MIN_DRAG_TILE, POI_ICON_SIZE * scale) + 2 })
  }

  const onSwatchPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, hexcode: string, url?: string) => {
    dragged.current = false
    drag.current = { hexcode, url, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId, started: false }
    // Capture the mouse up front: a quick pull throws the pointer off the little swatch in one
    // move, and without capture already in hand that move lands on the canvas and the swatch
    // never sees it. Touch waits until the gesture is a confirmed sideways lift, so an up/down
    // swipe is left to the palette's own scroll (the browser cancels our pointer when it takes
    // that over).
    if (!coarse) e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onSwatchPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.started) {
      const beyond = Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD
      // On touch a lift has to beat the palette's own vertical scroll; a mouse never scrolls the
      // palette by dragging, so any pull past the threshold lifts.
      const lifts = coarse ? Math.abs(dx) > DRAG_THRESHOLD && Math.abs(dx) > Math.abs(dy) : beyond
      if (!lifts) return
      d.started = true
      dragged.current = true
      if (coarse) e.currentTarget.setPointerCapture(e.pointerId)
      onPlacementBegin(d.hexcode)
      updatePlacement(e.clientX, e.clientY, d)
      return
    }
    updatePlacement(e.clientX, e.clientY, d)
  }

  const onSwatchPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    drag.current = null
    // Release even when no drag started — the mouse was captured on the way down.
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!d || !d.started) return
    setPreview(null)
    onPlacementEnd(d.hexcode, e.clientX, e.clientY, isOverCanvas(e.clientX, e.clientY))
  }

  const onSwatchPointerCancel = () => {
    const d = drag.current
    drag.current = null
    setPreview(null)
    // The browser reclaimed the gesture (a scroll it decided was one after all): tear the ghost
    // down with nothing placed.
    if (d?.started) onPlacementEnd(d.hexcode, -1, -1, false)
  }

  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? groups
        .map(group => ({ ...group, icons: group.icons.filter(i => i.name.includes(needle)) }))
        .filter(group => group.icons.length > 0)
    : groups

  return (
    <div
      className="mlb-poi-picker"
      style={{
        position: 'absolute',
        top: 'var(--space-3)',
        left: 76,
        width: 268,
        maxHeight: 'calc(100% - var(--space-3) * 2)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--panel-glass)',
        backdropFilter: 'var(--panel-blur)',
        WebkitBackdropFilter: 'var(--panel-blur)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 'var(--gap-md)', display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Point of interest
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          {coarse
            ? armedIcon
              ? 'Now tap the map. Tap the symbol again to put it back.'
              : 'Drag a symbol onto the map, or tap it then tap where it goes.'
            : 'Drag a symbol onto the map, or press Enter to drop one in the middle.'}
        </div>
        <Input size="sm" placeholder="Search…" value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div style={{ overflowY: 'auto', padding: '0 var(--gap-md) var(--gap-md)' }}>
        {filtered.map(group => (
          <div key={group.subgroup} style={{ marginBottom: 'var(--gap-md)' }}>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--gap-xs)',
              }}
            >
              {SUBGROUP_LABELS[group.subgroup] ?? group.subgroup}
            </div>
            {/* Five to a row rather than six. These are pictograms being told apart, not
                swatches being counted, and a bus at 26px reads as an orange smudge — the
                width the row gives back goes straight into the artwork. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
              {group.icons.map(entry => {
                const url = openMojiUrl(entry.hexcode)
                return (
                  // A button rather than a div, so the palette is reachable by Tab and each
                  // symbol can be fired with Enter or Space. Placing is a drag (pointer) or, for
                  // the keyboard, Enter — a plain mouse click does nothing, which is why the click
                  // handler only acts on a keyboard activation or a touch arm.
                  <button
                    type="button"
                    key={entry.hexcode}
                    className="mlb-poi-swatch"
                    title={entry.name}
                    aria-label={coarse ? `${entry.name} — tap to pick up, or drag onto the map` : `${entry.name} — drag onto the map, or press Enter to place`}
                    data-dragging={entry.hexcode === drag.current?.hexcode && drag.current?.started}
                    data-armed={entry.hexcode === armedIcon}
                    // pan-y so an up/down swipe still scrolls the palette while a sideways pull is
                    // left free to become a drag onto the map.
                    style={coarse ? { touchAction: 'pan-y' } : undefined}
                    onPointerDown={e => onSwatchPointerDown(e, entry.hexcode, url)}
                    onPointerMove={onSwatchPointerMove}
                    onPointerUp={onSwatchPointerUp}
                    onPointerCancel={onSwatchPointerCancel}
                    onClick={e => {
                      // A drag that just happened isn't a tap, so it neither arms nor places.
                      if (dragged.current) { dragged.current = false; return }
                      if (coarse) onArm(entry.hexcode === armedIcon ? null : entry.hexcode)
                      else if (e.detail === 0) onPlaceByKeyboard(entry.hexcode)
                    }}
                  >
                    {/* draggable={false} so the browser's own image drag can't hijack the pointer
                        gesture before our handlers see it. */}
                    {url && <img src={url} alt="" width={34} height={34} draggable={false} />}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Nothing matches “{query}”.</div>
        )}
      </div>

      {preview &&
        createPortal(
          <div
            className="mlb-poi-drag-tile"
            style={{
              position: 'fixed',
              left: preview.x - preview.size / 2,
              top: preview.y - preview.size / 2,
              width: preview.size,
              height: preview.size,
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            {preview.url && <img src={preview.url} width={preview.size - 2} height={preview.size - 2} alt="" />}
          </div>,
          document.body,
        )}
    </div>
  )
}
