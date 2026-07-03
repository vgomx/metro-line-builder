import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Station } from '../types'

interface StationNodeProps {
  station: Station
  selected: boolean
  inDraftLine: boolean
  /** True when the station sits on 2+ distinct lines — rendered as an interchange. */
  interchange: boolean
  onPointerDown: (e: ReactPointerEvent<SVGGElement>, station: Station) => void
  onClick: (station: Station) => void
}

export function StationNode({ station, selected, inDraftLine, interchange, onPointerDown, onClick }: StationNodeProps) {
  const isInterchange = interchange || station.transfer
  const radius = isInterchange ? 10 : 6.5

  return (
    <g
      transform={`translate(${station.x}, ${station.y})`}
      onPointerDown={e => onPointerDown(e, station)}
      onClick={() => onClick(station)}
      style={{ cursor: 'pointer' }}
    >
      {selected && (
        <circle r={radius + 5} fill="none" stroke="var(--brand-500)" strokeWidth={2} opacity={0.5} />
      )}
      {isInterchange ? (
        <>
          <circle
            r={radius}
            fill={inDraftLine ? 'var(--brand-500)' : '#FFFFFF'}
            stroke={inDraftLine ? 'var(--brand-500)' : 'var(--ink-900)'}
            strokeWidth={3.5}
          />
          <circle r={radius - 4.5} fill="none" stroke={inDraftLine ? 'var(--brand-500)' : 'var(--ink-900)'} strokeWidth={1.25} />
        </>
      ) : (
        <circle
          r={radius}
          fill={inDraftLine ? 'var(--brand-500)' : '#FFFFFF'}
          stroke={inDraftLine ? 'var(--brand-500)' : 'var(--ink-900)'}
          strokeWidth={2.5}
        />
      )}
      <text
        x={0}
        y={radius + 14}
        textAnchor="middle"
        fontSize={11}
        fontFamily="'Barlow Condensed', system-ui, sans-serif"
        fontWeight={600}
        fill="var(--text-primary)"
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {station.name}
      </text>
    </g>
  )
}
