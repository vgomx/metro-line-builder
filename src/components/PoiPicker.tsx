import { useMemo, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent } from 'react'
import { Input } from 'metro-ds'
import { openMojiBySubgroup, openMojiUrl, POI_DRAG_MIME, SUBGROUP_LABELS } from '../openmoji'

/**
 * The palette that stands beside the toolbar while the point-of-interest tool is live.
 * Symbols are dragged straight from here onto the map: what you pick up is what lands, and
 * it lands where you let go — no mode to arm and nothing to remember between the two halves
 * of the gesture. The tool is modal, so the picker is too: it appears with the tool and
 * leaves with it.
 */
/** Side of the tile the pointer carries, in px. Larger than a swatch and close to the
 * marker's drawn size, so what's in hand reads as the thing that will land. */
const DRAG_TILE = 40
const DRAG_TILE_ICON = 30

export function PoiPicker() {
  const [query, setQuery] = useState('')
  const [draggingIcon, setDraggingIcon] = useState<string | null>(null)
  const groups = useMemo(() => openMojiBySubgroup(), [])

  // The tile the browser snapshots as the drag image. It has to be a real, rendered element
  // at snapshot time — display:none or a detached node yields nothing — so it's parked
  // off-screen for the length of the gesture and taken away on dragend. Held in a ref rather
  // than state because it must exist before setDragImage runs, and a render is too late.
  const ghostRef = useRef<HTMLDivElement | null>(null)

  const startDrag = (e: ReactDragEvent<HTMLDivElement>, hexcode: string, url: string | undefined) => {
    e.dataTransfer.setData(POI_DRAG_MIME, hexcode)
    e.dataTransfer.effectAllowed = 'copy'
    setDraggingIcon(hexcode)
    if (!url) return

    const ghost = document.createElement('div')
    ghost.className = 'mlb-poi-drag-tile'
    const img = document.createElement('img')
    img.src = url
    img.width = DRAG_TILE_ICON
    img.height = DRAG_TILE_ICON
    img.alt = ''
    ghost.appendChild(img)
    document.body.appendChild(ghost)
    // Centred under the pointer: the gesture ends by pointing at where the landmark goes, so
    // the tile should sit on that spot rather than hang below and to the right of it.
    e.dataTransfer.setDragImage(ghost, DRAG_TILE / 2, DRAG_TILE / 2)
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
          Drag a symbol onto the map to place it.
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
                  <div
                    key={entry.hexcode}
                    className="mlb-poi-swatch"
                    draggable
                    title={entry.name}
                    role="img"
                    aria-label={entry.name}
                    data-dragging={entry.hexcode === draggingIcon}
                    onDragStart={e => startDrag(e, entry.hexcode, url)}
                    onDragEnd={endDrag}
                  >
                    {/* No draggable={false} on the img: the pointer usually goes down on the
                        artwork rather than the padding around it, and opting the img out would
                        kill the drag before it started. */}
                    {url && <img src={url} alt="" width={34} height={34} />}
                  </div>
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
