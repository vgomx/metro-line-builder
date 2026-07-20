import { useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Button, LineIndicator } from 'metro-ds'
import { EyeIcon, EyeOffIcon, GripIcon, PlusIcon } from '../icons'
import type { Line } from '../types'

interface LinesPanelProps {
  lines: Line[]
  selectedLineId: string | null
  onSelect: (lineId: string) => void
  onToggleVisibility: (lineId: string) => void
  onAddLine: () => void
  /** Move a line to a new position in the list. */
  onReorder: (lineId: string, toIndex: number) => void
}

/**
 * The list of lines, in the order they're drawn.
 *
 * That order is not decoration. Where two lines share a stretch of track the renderer fans
 * them into parallel lanes, and a line's position in this list is what picks its lane — so
 * dragging a row here rearranges which side of a shared corridor each line runs on. It was
 * the one thing about a shared corridor a map-maker couldn't control.
 *
 * Dragged with pointer events rather than HTML5 drag-and-drop, which doesn't fire on touch —
 * the same reason the landmark palette had to be rebuilt. The handle is a real button, so the
 * whole thing also works from the keyboard: focus it and use the arrow keys.
 */
export function LinesPanel({ lines, selectedLineId, onSelect, onToggleVisibility, onAddLine, onReorder }: LinesPanelProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  /** Which row the pointer is over, by measuring the rows themselves rather than assuming
   * they're all the same height — a long line name wraps and its row grows. */
  const indexAt = (clientY: number): number | null => {
    const rows = listRef.current?.querySelectorAll('[data-line-row]')
    if (!rows || rows.length === 0) return null
    for (let i = 0; i < rows.length; i++) {
      const box = rows[i].getBoundingClientRect()
      if (clientY < box.top + box.height / 2) return i
    }
    return rows.length - 1
  }

  const startDrag = (e: ReactPointerEvent<HTMLButtonElement>, lineId: string) => {
    e.preventDefault()
    e.stopPropagation()
    // Captured on the handle, so the drag survives a pointer that outruns a 34px row.
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraggingId(lineId)
  }

  const moveDrag = (e: ReactPointerEvent<HTMLButtonElement>, lineId: string) => {
    if (draggingId !== lineId) return
    const target = indexAt(e.clientY)
    const current = lines.findIndex(l => l.id === lineId)
    if (target === null || target === current) return
    onReorder(lineId, target)
  }

  const endDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setDraggingId(null)
  }

  const nudge = (e: ReactKeyboardEvent<HTMLButtonElement>, lineId: string, index: number) => {
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
    if (delta === 0) return
    e.preventDefault()
    e.stopPropagation()
    onReorder(lineId, index + delta)
  }

  return (
    <div ref={listRef} style={{ display: 'flex', flexDirection: 'column' }}>
      {lines.length === 0 && (
        <p style={{ padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
          No lines yet — draw one on the canvas, or hit Surprise me for a whole city.
        </p>
      )}

      {lines.map((line, index) => {
        const isSelected = line.id === selectedLineId
        const isDragging = line.id === draggingId
        return (
          <div
            key={line.id}
            data-line-row=""
            onClick={() => onSelect(line.id)}
            className="mlb-row"
            data-selected={isSelected}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-sm)',
              padding: '8px 12px',
              cursor: 'pointer',
              borderLeft: `3px solid ${isSelected ? 'var(--interactive-primary)' : 'transparent'}`,
              // Lifted off the list while it's being carried, so it reads as the row that's
              // moving rather than the rows that are making way for it.
              background: isDragging ? 'var(--bg-subtle)' : undefined,
              opacity: isDragging ? 0.85 : 1,
            }}
          >
            <button
              type="button"
              aria-label={`Reorder ${line.name} — drag, or use the arrow keys`}
              onPointerDown={e => startDrag(e, line.id)}
              onPointerMove={e => moveDrag(e, line.id)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={e => nudge(e, line.id, index)}
              onClick={e => e.stopPropagation()}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                padding: '2px',
                marginLeft: '-4px',
                color: isDragging ? 'var(--text-secondary)' : 'var(--text-muted)',
                cursor: isDragging ? 'grabbing' : 'grab',
                // Without this the browser claims the gesture for a scroll before the handle
                // sees it, and the row can't be dragged on a touchscreen at all.
                touchAction: 'none',
              }}
            >
              <GripIcon />
            </button>
            {/* Carries the line's number rather than a bare swatch, so the list identifies a
                line the same way the canvas does. Sized up from the old 14px dot to seat the
                number legibly — LineIndicator picks its own text colour against the fill,
                which the pale end of the palette (the yellow) needs. */}
            <LineIndicator id={String(line.number)} color={line.color} size="sm" />
            <span
              style={{
                flex: 1,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                fontWeight: isSelected ? 500 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {line.name}
            </span>
            <button
              type="button"
              aria-label={line.visible ? `Hide ${line.name}` : `Show ${line.name}`}
              onClick={e => {
                e.stopPropagation()
                onToggleVisibility(line.id)
              }}
              style={{
                display: 'flex',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: line.visible ? 'var(--text-secondary)' : 'var(--text-disabled)',
              }}
            >
              {line.visible ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </div>
        )
      })}

      <div style={{ padding: '8px 12px' }}>
        <Button size="sm" variant="ghost" icon={<PlusIcon />} onClick={onAddLine} style={{ width: '100%', justifyContent: 'flex-start' }}>
          Add line
        </Button>
      </div>
    </div>
  )
}
