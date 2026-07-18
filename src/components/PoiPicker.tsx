import { useMemo, useState } from 'react'
import { Input } from 'metro-ds'
import { openMojiBySubgroup, openMojiUrl, POI_DRAG_MIME, SUBGROUP_LABELS } from '../openmoji'

/**
 * The palette that stands beside the toolbar while the point-of-interest tool is live.
 * Symbols are dragged straight from here onto the map: what you pick up is what lands, and
 * it lands where you let go — no mode to arm and nothing to remember between the two halves
 * of the gesture. The tool is modal, so the picker is too: it appears with the tool and
 * leaves with it.
 */
export function PoiPicker() {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => openMojiBySubgroup(), [])

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
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
                    onDragStart={e => {
                      e.dataTransfer.setData(POI_DRAG_MIME, entry.hexcode)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                  >
                    {/* The img is the drag image the browser lifts, so it carries the whole
                        gesture's feedback — draggable={false} on it would kill the drag the
                        moment the pointer went down on the artwork rather than the padding. */}
                    {url && <img src={url} alt="" width={26} height={26} />}
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
