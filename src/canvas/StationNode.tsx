import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Station } from '../types'
import type { LabelPlacement } from './labelPlacement'

interface StationNodeProps {
  station: Station
  selected: boolean
  inDraftLine: boolean
  /** True when the station sits on 2+ distinct lines — rendered as an interchange. */
  interchange: boolean
  /** Compass direction (away from every line touching this station) to place the name in. */
  labelPlacement: LabelPlacement
  onPointerDown: (e: ReactPointerEvent<SVGGElement>, station: Station) => void
  onClick: (station: Station) => void
}

export function StationNode({ station, selected, inDraftLine, interchange, labelPlacement, onPointerDown, onClick }: StationNodeProps) {
  const isInterchange = interchange || station.transfer
  const radius = isInterchange ? 10 : 6.5
  const labelDistance = radius + 12
  const labelX = Math.cos(labelPlacement.angle) * labelDistance
  const labelY = Math.sin(labelPlacement.angle) * labelDistance

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
            fill={inDraftLine ? 'var(--brand-500)' : 'var(--bg-page)'}
            stroke={inDraftLine ? 'var(--brand-500)' : 'var(--text-primary)'}
            strokeWidth={3.5}
          />
          <circle r={radius - 4.5} fill="none" stroke={inDraftLine ? 'var(--brand-500)' : 'var(--text-primary)'} strokeWidth={1.25} />
        </>
      ) : (
        <circle
          r={radius}
          fill={inDraftLine ? 'var(--brand-500)' : 'var(--bg-page)'}
          stroke={inDraftLine ? 'var(--brand-500)' : 'var(--text-primary)'}
          strokeWidth={2.5}
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
  )
}
