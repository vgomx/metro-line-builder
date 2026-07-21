import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCoarsePointer } from '../useCoarsePointer'
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Input } from 'metro-ds'
import { openMojiBySubgroup, openMojiUrl, POI_DRAG_MIME, SUBGROUP_LABELS } from '../openmoji'
import { POI_ICON_SIZE } from '../canvas/PoiNode'

interface PoiPickerProps {
  /** The symbol currently waiting to be tapped onto the map (touch only), or null. */
  armedIcon: string | null
  /** Pick a symbol up, or put it back down by picking the same one again. */
  onArm: (hexcode: string | null) => void
  /** The canvas's current zoom, so the dragged tile can be the size the landmark will be. */
  scale: number
  /** Place this symbol without a pointer — the keyboard's way onto the map. */
  onPlaceByKeyboard: (hexcode: string) => void
  /** Drop a dragged symbol at a screen point — the touch drag's way onto the map, since HTML5
   * drop never fires on a finger. */
  onDragPlace: (hexcode: string, clientX: number, clientY: number) => void
}

/**
 * The palette that stands beside the toolbar while the point-of-interest tool is live.
 * Symbols are dragged straight from here onto the map: what you pick up is what lands, and
 * it lands where you let go — no mode to arm and nothing to remember between the two halves
 * of the gesture. The tool is modal, so the picker is too: it appears with the tool and
 * leaves with it.
 */
/** Below this the tile is too small to see under the pointer at all. Only bites when the map
 * is zoomed a long way out, where the landmark really would be a speck. */
const MIN_DRAG_TILE = 18

export function PoiPicker({ scale, onPlaceByKeyboard, armedIcon, onArm, onDragPlace }: PoiPickerProps) {
  const [query, setQuery] = useState('')
  const [draggingIcon, setDraggingIcon] = useState<string | null>(null)
  const coarse = useCoarsePointer()
  const groups = useMemo(() => openMojiBySubgroup(), [])

  // The tile the browser snapshots as the drag image. It has to be a real, rendered element
  // at snapshot time — display:none or a detached node yields nothing — so it's parked
  // off-screen for the length of the gesture and taken away on dragend. Held in a ref rather
  // than state because it must exist before setDragImage runs, and a render is too late.
  const ghostRef = useRef<HTMLDivElement | null>(null)

  // A finger drag from the palette onto the map, since HTML5 drag-and-drop doesn't fire on
  // touch at all. The live gesture is held in a ref so the pointer handlers read it without a
  // stale closure; `preview` is the only part that has to re-render — the tile under the
  // finger. `dragged` guards the click that follows a drag, so a drag doesn't also arm.
  const touchDrag = useRef<{ hexcode: string; url?: string; startX: number; startY: number; pointerId: number; started: boolean } | null>(null)
  const dragged = useRef(false)
  const [preview, setPreview] = useState<{ x: number; y: number; url?: string; size: number } | null>(null)

  // A drag only begins on a sideways pull — the palette scrolls vertically (touch-action:
  // pan-y lets it), so an up/down swipe browses and a pull toward the map, out to the side,
  // lifts the symbol. Small enough that the lift feels immediate, large enough not to trip on
  // the wobble of a tap.
  const DRAG_THRESHOLD = 8

  const onSwatchPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, hexcode: string, url?: string) => {
    dragged.current = false
    touchDrag.current = { hexcode, url, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId, started: false }
  }

  const onSwatchPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = touchDrag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.started) {
      // A sideways pull that beats the vertical is a lift; anything more vertical is a scroll,
      // which pan-y hands to the browser and which ends this gesture on pointercancel.
      if (Math.abs(dx) > DRAG_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        d.started = true
        dragged.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        setPreview({ x: e.clientX, y: e.clientY, url: d.url, size: Math.max(MIN_DRAG_TILE, POI_ICON_SIZE * scale) + 2 })
      }
      return
    }
    setPreview(prev => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev))
  }

  const onSwatchPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = touchDrag.current
    touchDrag.current = null
    if (!d || !d.started) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setPreview(null)
    // Only a release over the map lands anything — let go over the palette and the symbol
    // simply goes back, no harm done. The tile carries pointer-events: none, so it isn't what
    // the point hits.
    const under = document.elementFromPoint(e.clientX, e.clientY)
    if (under?.closest('svg[data-map-canvas]')) onDragPlace(d.hexcode, e.clientX, e.clientY)
  }

  const onSwatchPointerCancel = () => {
    touchDrag.current = null
    setPreview(null)
  }

  const startDrag = (e: ReactDragEvent<HTMLElement>, hexcode: string, url: string | undefined) => {
    e.dataTransfer.setData(POI_DRAG_MIME, hexcode)
    e.dataTransfer.effectAllowed = 'copy'
    setDraggingIcon(hexcode)
    if (!url) return

    // Sized at the map's current zoom rather than at some fixed picker size, so the tile in
    // hand is the landmark that will land — zoomed out it's a speck, zoomed in it's a slab,
    // and either way you can see what you're about to commit to before letting go.
    const iconPx = Math.max(MIN_DRAG_TILE, POI_ICON_SIZE * scale)
    const tilePx = iconPx + 2

    const ghost = document.createElement('div')
    ghost.className = 'mlb-poi-drag-tile'
    ghost.style.width = `${tilePx}px`
    ghost.style.height = `${tilePx}px`
    ghost.style.borderRadius = `${Math.max(3, 6 * scale)}px`
    const img = document.createElement('img')
    img.src = url
    img.width = iconPx
    img.height = iconPx
    img.alt = ''
    ghost.appendChild(img)
    document.body.appendChild(ghost)
    // Centred under the pointer: the gesture ends by pointing at where the landmark goes, so
    // the tile should sit on that spot rather than hang below and to the right of it.
    e.dataTransfer.setDragImage(ghost, tilePx / 2, tilePx / 2)
    ghostRef.current = ghost
  }

  const endDrag = () => {
    setDraggingIcon(null)
    ghostRef.current?.remove()
    ghostRef.current = null
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
                  // symbol can be fired with Enter or Space. Dragging still works from a
                  // button; what it couldn't do as a div was be focused at all, which left
                  // placing a landmark the one thing in the app a mouse was required for.
                  //
                  // Only keyboard activation places: a click carries detail >= 1, a keyboard
                  // Enter carries 0. So a mouse user's click still does nothing, and dragging
                  // remains the way a pointer places a symbol.
                  <button
                    type="button"
                    key={entry.hexcode}
                    className="mlb-poi-swatch"
                    draggable={!coarse}
                    title={entry.name}
                    aria-label={coarse ? `${entry.name} — tap to pick up, or drag onto the map` : `${entry.name} — press Enter to place`}
                    data-dragging={entry.hexcode === draggingIcon}
                    data-armed={entry.hexcode === armedIcon}
                    // pan-y so an up/down swipe still scrolls the palette while a sideways pull
                    // is left free to become a drag onto the map.
                    style={coarse ? { touchAction: 'pan-y' } : undefined}
                    onDragStart={coarse ? undefined : e => startDrag(e, entry.hexcode, url)}
                    onDragEnd={coarse ? undefined : endDrag}
                    onPointerDown={coarse ? e => onSwatchPointerDown(e, entry.hexcode, url) : undefined}
                    onPointerMove={coarse ? onSwatchPointerMove : undefined}
                    onPointerUp={coarse ? onSwatchPointerUp : undefined}
                    onPointerCancel={coarse ? onSwatchPointerCancel : undefined}
                    onClick={e => {
                      // A tap picks the symbol up and the next tap on the map puts it down;
                      // tapping the armed one again puts it back. A drag that just happened
                      // isn't a tap, so it doesn't also arm.
                      if (coarse) {
                        if (dragged.current) { dragged.current = false; return }
                        onArm(entry.hexcode === armedIcon ? null : entry.hexcode)
                      } else if (e.detail === 0) onPlaceByKeyboard(entry.hexcode)
                    }}
                  >
                    {/* No draggable={false} on the img: the pointer usually goes down on the
                        artwork rather than the padding around it, and opting the img out would
                        kill the drag before it started. */}
                    {url && <img src={url} alt="" width={34} height={34} />}
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
