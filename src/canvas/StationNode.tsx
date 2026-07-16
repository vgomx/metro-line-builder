import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Station } from '../types'
import type { LabelPlacement } from './labelPlacement'

const LABEL_FONT_SIZE = 11
const LABEL_FONT = `600 ${LABEL_FONT_SIZE}px 'Barlow Condensed', system-ui, sans-serif`
const CARD_PAD_X = 5
const CARD_PAD_Y = 2.5
/** A main station's plate is fully rounded, so its ends curve away where the text would
 * otherwise sit; it needs more room than a square-ish card to keep the name off the arc. */
const MAIN_PAD_X = 10

let measureCanvas: HTMLCanvasElement | null = null

/** Pixel width of a label in the exact face it renders with, so the backing card can
 * be sized to fit. Canvas measureText can't read a CSS var for its font, but this
 * label uses a literal family string, so it measures directly. A little horizontal
 * padding on top absorbs the small canvas-vs-layout metric drift. */
function measureLabelWidth(text: string): number {
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return text.length * (LABEL_FONT_SIZE * 0.55)
  ctx.font = LABEL_FONT
  return ctx.measureText(text).width
}

interface StationNodeProps {
  station: Station
  selected: boolean
  inDraftLine: boolean
  /** True when the station sits on 2+ distinct lines — rendered as an interchange. */
  interchange: boolean
  /** True while this station is being actively repositioned by a drag. */
  dragging: boolean
  /** True for one animation cycle right after the station first appears — pops the marker in. */
  entering?: boolean
  /** Compass direction (away from every line touching this station) to place the name in. */
  labelPlacement: LabelPlacement
  onPointerDown: (e: ReactPointerEvent<SVGGElement>, station: Station) => void
  onClick: (station: Station) => void
}

const POP_MS = 300

export function StationNode({ station, selected, inDraftLine, interchange, dragging, entering, labelPlacement, onPointerDown, onClick }: StationNodeProps) {
  const isInterchange = interchange || station.transfer
  const baseRadius = isInterchange ? 10 : 6.5
  const radius = dragging ? baseRadius + 2 : baseRadius
  const labelDistance = radius + 12
  const labelX = Math.cos(labelPlacement.angle) * labelDistance
  const labelY = Math.sin(labelPlacement.angle) * labelDistance

  // Rounded card sized to the measured label, aligned to the same anchor edge the
  // text uses (start → extends right, end → extends left, middle → centred), so it
  // sits squarely behind the name and lifts it off busy lines/fills for legibility.
  //
  // A main station wears the same card as a nameplate instead: fully rounded, the pill shape
  // LineIndicator gives a named line, in neutral ink. text-primary/text-inverse rather than
  // the fixed ink-900/ink-0 the transient chips use — those are always dark because they only
  // ever flash over the map, but a plate that lives on it has to invert with the theme or it
  // sinks into a dark canvas and leaves the name floating with no plate at all.
  //
  // Nothing about the marker changes: a principal station is one the eye should find by name,
  // and the map already spends its marker vocabulary on what the lines are doing.
  const isMain = station.main
  const padX = isMain ? MAIN_PAD_X : CARD_PAD_X
  const name = station.name.trim()
  const textWidth = name ? measureLabelWidth(name) : 0
  const cardW = textWidth + padX * 2
  const cardH = LABEL_FONT_SIZE + CARD_PAD_Y * 2
  const cardX =
    labelPlacement.anchor === 'start'
      ? labelX - padX
      : labelPlacement.anchor === 'end'
        ? labelX - textWidth - padX
        : labelX - cardW / 2
  const cardY = labelY - cardH / 2

  return (
    <g
      transform={`translate(${station.x}, ${station.y})`}
      onPointerDown={e => onPointerDown(e, station)}
      onClick={() => onClick(station)}
      style={{ cursor: 'pointer' }}
    >
      {/* Safari doesn't reliably render CSS drop-shadow() filters on SVG content, so
          the drag shadow is a real SVG <filter> (defined once in MapCanvas) applied
          via the filter attribute — feDropShadow works across all engines. */}
      <g filter={dragging ? 'url(#station-drag-shadow)' : undefined}>
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
        {/* Marker circles pop in on first appearance. The group's bounding box is symmetric
            about the origin, so fill-box + centre origin scales it around the station. */}
        <g
          style={
            entering
              ? { transformBox: 'fill-box', transformOrigin: 'center', animation: `mlb-station-pop ${POP_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) both` }
              : undefined
          }
        >
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
        </g>
        {name && (
          <rect
            x={cardX}
            y={cardY}
            width={cardW}
            height={cardH}
            rx={isMain ? cardH / 2 : 4}
            fill={isMain ? 'var(--text-primary)' : 'var(--bg-surface)'}
            stroke={isMain ? 'none' : 'var(--border-subtle)'}
            strokeWidth={1}
            opacity={isMain ? 1 : 0.92}
            style={{ pointerEvents: 'none' }}
          />
        )}
        <text
          x={labelX}
          y={labelY}
          textAnchor={labelPlacement.anchor}
          dominantBaseline="middle"
          fontSize={LABEL_FONT_SIZE}
          fontFamily="'Barlow Condensed', system-ui, sans-serif"
          fontWeight={isMain ? 700 : 600}
          fill={isMain ? 'var(--text-inverse)' : 'var(--text-primary)'}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {station.name}
        </text>
      </g>
    </g>
  )
}
