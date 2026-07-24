import { useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Button } from 'metro-ds'
import { LineBadge } from './LineBadge'
import { SortControl } from './SortControl'
import type { SortOption } from './SortControl'
import { EyeIcon, EyeOffIcon, GripIcon, PlusIcon, TrainIcon } from '../icons'
import { stationIdsOfLine } from '../canvas/lineNodes'
import type { Line, LineKind } from '../types'
import { lineKind } from '../types'

export type SortKey = 'manual' | 'name' | 'number' | 'length' | 'created'

const SORT_OPTIONS: SortOption<SortKey>[] = [
  { key: 'manual', label: 'Manual' },
  { key: 'name', label: 'Name' },
  { key: 'number', label: 'Number' },
  { key: 'length', label: 'Length' },
  { key: 'created', label: 'Created' },
]

/** The lines' own sort vocabulary, on the shared control. */
export function LineSortControl({ value, onChange }: { value: SortKey; onChange: (key: SortKey) => void }) {
  return <SortControl value={value} options={SORT_OPTIONS} onChange={onChange} />
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
  /** Draw a new line of the given type — the section its "Add" button belongs to. */
  onAddLine: (kind: LineKind) => void
  /** Move a line to a new position in the manual order. */
  onReorder: (lineId: string, toIndex: number) => void
}

/** The list's two divisions, in the order they stack: metro first as the default and the majority,
 * rail beneath it. Numbering runs independently inside each — a Metro 1 and a Rail 1 both exist. */
const SECTIONS: { kind: LineKind; title: string; add: string }[] = [
  { kind: 'metro', title: 'Metro', add: 'Add metro line' },
  { kind: 'rail', title: 'Rail', add: 'Add rail line' },
]

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

  /** The sort applied within a section. Manual leaves the lines in their map order (which is the
   * lane order); the rest only rearrange what's shown. */
  const sortWithin = (arr: Line[]): Line[] => {
    if (manual) return arr
    const copy = [...arr]
    if (sortBy === 'name') copy.sort((a, b) => nameKey(a).localeCompare(nameKey(b)))
    else if (sortBy === 'number') copy.sort((a, b) => a.number - b.number)
    else if (sortBy === 'length') copy.sort((a, b) => stationIdsOfLine(b).length - stationIdsOfLine(a).length)
    else if (sortBy === 'created') copy.sort((a, b) => createdKey(a) - createdKey(b))
    return copy
  }

  const globalIndex = (lineId: string) => lines.findIndex(l => l.id === lineId)

  /** Which same-kind row the pointer is over. Rows are measured rather than assumed equal-height —
   * a wrapped name grows its row — and only this line's own section counts, because a line's type
   * is fixed and can't be dragged into the other. */
  const dropRowInKind = (clientY: number, kind: LineKind): HTMLElement | null => {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-line-row]') ?? [])].filter(
      r => r.dataset.lineKind === kind,
    )
    if (rows.length === 0) return null
    for (const row of rows) {
      const box = row.getBoundingClientRect()
      if (clientY < box.top + box.height / 2) return row
    }
    return rows[rows.length - 1]
  }

  const startDrag = (e: ReactPointerEvent<HTMLButtonElement>, lineId: string) => {
    e.preventDefault()
    e.stopPropagation()
    // Captured on the handle, so the drag survives a pointer that outruns a short row.
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraggingId(lineId)
  }

  const moveDrag = (e: ReactPointerEvent<HTMLButtonElement>, line: Line) => {
    if (draggingId !== line.id) return
    const row = dropRowInKind(e.clientY, lineKind(line))
    const targetId = row?.dataset.lineId
    if (!targetId || targetId === line.id) return
    // The target row's own position in the map order — dropping the dragged line there reorders it
    // among its own kind while every other-kind line keeps its place.
    onReorder(line.id, globalIndex(targetId))
  }

  const endDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setDraggingId(null)
  }

  const nudge = (e: ReactKeyboardEvent<HTMLButtonElement>, line: Line, kindLines: Line[], localIndex: number) => {
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
    if (delta === 0) return
    e.preventDefault()
    e.stopPropagation()
    const neighbour = kindLines[localIndex + delta]
    if (neighbour) onReorder(line.id, globalIndex(neighbour.id))
  }

  return (
    <div ref={listRef} style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Say what the manual order is for — otherwise the drag handle reads as busy-work rather
          than the one lever over a shared corridor. Shown once; it holds for both sections. */}
      {manual && lines.length > 0 && (
        <span style={{ padding: '8px 12px 4px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
          Drag to set which lane each line takes where they share track.
        </span>
      )}

      {SECTIONS.map(section => {
        const kindLines = sortWithin(lines.filter(line => lineKind(line) === section.kind))
        return (
          <div key={section.kind} style={{ display: 'flex', flexDirection: 'column' }}>
            {/* The division header. Always shown, so the empty section still offers its "Add" —
                the only way to draw the first line of a type. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px 4px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
              }}
            >
              {section.title}
              <span style={{ color: 'var(--text-muted)', fontWeight: 500, letterSpacing: 0 }}>{kindLines.length}</span>
            </div>

            {kindLines.map((line, index) => {
              const isSelected = line.id === selectedLineId
              const isDragging = line.id === draggingId
              return (
                <div
                  key={line.id}
                  data-line-row=""
                  data-line-id={line.id}
                  data-line-kind={section.kind}
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
                    background: isDragging ? 'var(--bg-subtle)' : undefined,
                    opacity: isDragging ? 0.85 : 1,
                  }}
                >
                  {/* The drag handle belongs to the manual order alone; a sorted view puts it away,
                      since a row's position there is display, not lane. */}
                  {manual && kindLines.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Reorder ${line.name} — drag, or use the arrow keys`}
                      onPointerDown={e => startDrag(e, line.id)}
                      onPointerMove={e => moveDrag(e, line)}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      onKeyDown={e => nudge(e, line, kindLines, index)}
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
                        touchAction: 'none',
                      }}
                    >
                      <GripIcon />
                    </button>
                  )}
                  {/* Carries the line's number rather than a bare swatch, so the list identifies a
                      line the same way the canvas does — metro filled, rail double-ruled. */}
                  <LineBadge line={line} shape="pill" size="sm" />
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
                  {/* Board this line's train. Disabled while the line is hidden. When this is the
                      line being ridden, the glyph lights up in its colour. */}
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

            <div style={{ padding: '4px 12px 8px' }}>
              <Button
                size="sm"
                variant="ghost"
                icon={<PlusIcon />}
                onClick={() => onAddLine(section.kind)}
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                {section.add}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
