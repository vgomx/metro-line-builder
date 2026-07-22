import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Button, LineIndicator } from 'metro-ds'
import { EyeIcon, EyeOffIcon, GripIcon, PlusIcon, TrainIcon } from '../icons'
import { stationIdsOfLine } from '../canvas/lineNodes'
import type { Line } from '../types'

export type SortKey = 'manual' | 'name' | 'number' | 'length' | 'created'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'manual', label: 'Manual' },
  { key: 'name', label: 'Name' },
  { key: 'number', label: 'Number' },
  { key: 'length', label: 'Length' },
  { key: 'created', label: 'Created' },
]

/**
 * The "Sort by" control. Lives apart from the list so it can sit up on the panel's title row —
 * its state is owned by RightPanel and handed to both this and the list.
 */
export function LineSortControl({ value, onChange }: { value: SortKey; onChange: (key: SortKey) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Sort by</span>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          height: '24px',
          padding: '0 8px',
          fontSize: 'var(--text-xs)',
          fontWeight: 500,
          color: 'var(--text-primary)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        {SORT_OPTIONS.find(o => o.key === value)?.label}
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}>
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '28px',
            right: 0,
            zIndex: 50,
            minWidth: '120px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            padding: '4px 0',
          }}
        >
          {SORT_OPTIONS.map(option => (
            <div
              key={option.key}
              role="option"
              aria-selected={option.key === value}
              onClick={() => {
                onChange(option.key)
                setOpen(false)
              }}
              style={{
                padding: '5px 12px',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                background: option.key === value ? 'var(--color-info-bg)' : 'transparent',
                fontWeight: option.key === value ? 500 : 400,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = option.key === value ? 'var(--color-info-bg)' : 'var(--bg-subtle)')}
              onMouseLeave={e => (e.currentTarget.style.background = option.key === value ? 'var(--color-info-bg)' : 'transparent')}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface LinesPanelProps {
  lines: Line[]
  selectedLineId: string | null
  /** The line currently being ridden, so its row can show the ride as live. */
  ridingLineId: string | null
  /** The active sort, owned by RightPanel so its control can live on the title row. */
  sortBy: SortKey
  onSelect: (lineId: string) => void
  /** Board this line's train — the camera follows it and the trip view lights up. */
  onRide: (lineId: string) => void
  onToggleVisibility: (lineId: string) => void
  onAddLine: () => void
  /** Move a line to a new position in the manual order. */
  onReorder: (lineId: string, toIndex: number) => void
}

/**
 * The list of lines.
 *
 * Its manual order is not decoration. Where two lines share a stretch of track the renderer fans
 * them into parallel lanes, and a line's position in the manual order is what picks its lane — so
 * dragging a row rearranges which side of a shared corridor each line runs on. It's the one
 * control a map-maker has over a shared corridor, which is why the "Manual" sort keeps the drag
 * handle and spells out what it does.
 *
 * The other sorts — Name, Number, Length, Created — are for finding a line in a long list. They
 * only reorder what's shown; the manual order (and so every lane on the map) is left untouched,
 * and dragging is put away because a row's position no longer means anything the map reads.
 *
 * Dragged with pointer events rather than HTML5 drag-and-drop, which doesn't fire on touch. The
 * handle is a real button, so reordering also works from the keyboard: focus it and use the arrows.
 */
export function LinesPanel({ lines, selectedLineId, ridingLineId, sortBy, onSelect, onRide, onToggleVisibility, onAddLine, onReorder }: LinesPanelProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const manual = sortBy === 'manual'

  // The sorts read off the line itself; only "Created" needs a fallback, for lines drawn before
  // the timestamp existed — they take their place in the manual order, which for an untouched map
  // is the order they were drawn in anyway.
  const positionOf = new Map(lines.map((line, i) => [line.id, i]))
  const nameKey = (line: Line) => (line.name.trim() || `Line ${line.number}`).toLowerCase()
  const createdKey = (line: Line) => line.createdAt ?? positionOf.get(line.id) ?? 0

  const displayLines = (() => {
    if (manual) return lines
    const copy = [...lines]
    if (sortBy === 'name') copy.sort((a, b) => nameKey(a).localeCompare(nameKey(b)))
    else if (sortBy === 'number') copy.sort((a, b) => a.number - b.number)
    else if (sortBy === 'length') copy.sort((a, b) => stationIdsOfLine(b).length - stationIdsOfLine(a).length)
    else if (sortBy === 'created') copy.sort((a, b) => createdKey(a) - createdKey(b))
    return copy
  })()

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

      {/* Say what the manual order is for — otherwise the drag handle reads as busy-work rather
          than the one lever over a shared corridor. */}
      {manual && lines.length > 0 && (
        <span style={{ padding: '8px 12px 4px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
          Drag to set which lane each line takes where they share track.
        </span>
      )}

      {displayLines.map((line, index) => {
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
            {/* The drag handle belongs to the manual order alone; a sorted view puts it away,
                since a row's position there is display, not lane. */}
            {manual && (
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
            )}
            {/* Carries the line's number rather than a bare swatch, so the list identifies a
                line the same way the canvas does. */}
            <LineIndicator id={String(line.number)} color={line.color} shape="pill" size="sm" />
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
            {/* Board this line's train. Disabled while the line is hidden — there's no car on the
                map to follow. When this is the line being ridden, the glyph lights up in its colour. */}
            <button
              type="button"
              aria-label={ridingLineId === line.id ? `Riding ${line.name}` : `Ride ${line.name}`}
              disabled={!line.visible}
              onClick={e => {
                e.stopPropagation()
                onRide(line.id)
              }}
              style={{
                display: 'flex',
                background: 'none',
                border: 'none',
                cursor: line.visible ? 'pointer' : 'default',
                padding: '2px',
                color: ridingLineId === line.id ? line.color : line.visible ? 'var(--text-muted)' : 'var(--text-disabled)',
              }}
            >
              <TrainIcon />
            </button>
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
