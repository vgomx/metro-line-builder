import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Station } from '../types'
import type { LabelPlacement } from './labelPlacement'

interface StationNodeProps {
  station: Station
  selected: boolean
  inDraftLine: boolean
  /** True when the station sits on 2+ distinct lines — rendered as an interchange. */
  interchange: boolean
  /** True while this station is being actively repositioned by a drag. */
  dragging: boolean
  /** Compass direction (away from every line touching this station) to place the name in. */
  labelPlacement: LabelPlacement
  onPointerDown: (e: ReactPointerEvent<SVGGElement>, station: Station) => void
  onClick: (station: Station) => void
}

export function StationNode({ station, selected, inDraftLine, interchange, dragging, labelPlacement, onPointerDown, onClick }: StationNodeProps) {
  const isInterchange = interchange || station.transfer
  const baseRadius = isInterchange ? 10 : 6.5
  const radius = dragging ? baseRadius + 2 : baseRadius
  const labelDistance = radius + 12
  const labelX = Math.cos(labelPlacement.angle) * labelDistance
  const labelY = Math.sin(labelPlacement.angle) * labelDistance

  return (
    // Safari/WebKit fails to render (or clips) a CSS `filter` applied to the same
    // SVG element that also carries a `transform` attribute — the drag shadow needs
    // its own inner <g> with no transform of its own so it renders there too.
    <g
      transform={`translate(${station.x}, ${station.y})`}
      onPointerDown={e => onPointerDown(e, station)}
      onClick={() => onClick(station)}
      style={{ cursor: 'pointer' }}
    >
      <g
        style={{
          filter: dragging ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.35)) drop-shadow(0 1px 3px rgba(0,0,0,0.25))' : 'none',
          transition: 'filter 150ms ease',
        }}
      >
        {selected && (
          <circle
            r={radius + 5}
            fill="none"
            stroke="var(--brand-500)"
            strokeWidth={2}
            opacity={0.5}
            style={{ transition: 'r 150ms ease' }}
          />
        )}
        {isInterchange ? (
          <>
            <circle
              r={radius}
              fill={inDraftLine ? 'var(--brand-500)' : 'var(--bg-page)'}
              stroke={inDraftLine ? 'var(--brand-500)' : 'var(--text-primary)'}
              strokeWidth={3.5}
              style={{ transition: 'r 150ms ease' }}
            />
            <circle
              r={radius - 4.5}
              fill="none"
              stroke={inDraftLine ? 'var(--brand-500)' : 'var(--text-primary)'}
              strokeWidth={1.25}
              style={{ transition: 'r 150ms ease' }}
            />
          </>
        ) : (
          <circle
            r={radius}
            fill={inDraftLine ? 'var(--brand-500)' : 'var(--bg-page)'}
            stroke={inDraftLine ? 'var(--brand-500)' : 'var(--text-primary)'}
            strokeWidth={2.5}
            style={{ transition: 'r 150ms ease' }}
          />
        )}
        <text
          x={labelX}
          y={labelY}
          textAnchor={labelPlacement.anchor}
          dominantBaseline="middle"
          fontSize={11}
          fontFamily="'Barlow Condensed', system-ui, sans-serif"
          fontWeight={600}
          fill="var(--text-primary)"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {station.name}
        </text>
      </g>
    </g>
  )
}
