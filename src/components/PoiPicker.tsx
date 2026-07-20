import { useMemo, useRef, useState } from 'react'
import { useCoarsePointer } from '../useCoarsePointer'
import type { DragEvent as ReactDragEvent } from 'react'
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

export function PoiPicker({ scale, onPlaceByKeyboard, armedIcon, onArm }: PoiPickerProps) {
  const [query, setQuery] = useState('')
  const [draggingIcon, setDraggingIcon] = useState<string | null>(null)
  const coarse = useCoarsePointer()
  const groups = useMemo(() => openMojiBySubgroup(), [])

  // The tile the browser snapshots as the drag image. It has to be a real, rendered element
  // at snapshot time — display:none or a detached node yields nothing — so it's parked
  // off-screen for the length of the gesture and taken away on dragend. Held in a ref rather
  // than state because it must exist before setDragImage runs, and a render is too late.
  const ghostRef = useRef<HTMLDivElement | null>(null)

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
              : 'Tap a symbol, then tap where it goes.'
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
                    aria-label={coarse ? `${entry.name} — tap to pick up` : `${entry.name} — press Enter to place`}
                    data-dragging={entry.hexcode === draggingIcon}
                    data-armed={entry.hexcode === armedIcon}
                    onDragStart={coarse ? undefined : e => startDrag(e, entry.hexcode, url)}
                    onDragEnd={coarse ? undefined : endDrag}
                    onClick={e => {
                      // On touch there is no drag to start, so the tap picks the symbol up and
                      // the next tap on the map puts it down. Tapping the armed one again is
                      // how you change your mind without placing anything.
                      if (coarse) onArm(entry.hexcode === armedIcon ? null : entry.hexcode)
                      else if (e.detail === 0) onPlaceByKeyboard(entry.hexcode)
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
    </div>
  )
}
