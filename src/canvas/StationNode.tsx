import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { LineKind, Station } from '../types'
import { MODE_GLYPH_GAP, MODE_GLYPH_SIZE, ModeGlyphSvg, modeGlyphsWidth } from '../modeGlyphs'
import { PERSON_GAP, PERSON_SIZE, PersonGlyph, peopleRowWidth, pickPeople } from '../peopleGlyphs'
import type { LabelPlacement } from './labelPlacement'
import { BASELINE_CENTRE, labelGeometry, LABEL_FONT_SIZE } from './labelPlacement'

interface StationNodeProps {
  station: Station
  selected: boolean
  inDraftLine: boolean
  /** True when the station sits on 2+ distinct lines — rendered as an interchange. */
  interchange: boolean
  /** True when any rail line calls here — drawn as a rounded square rather than a circle, so the
   * shape says the mode while the ink still says whether it's an interchange. */
  rail: boolean
  /** The distinct transport modes calling here, metro before rail. A main station that mixes two
   * of them shows a glyph for each above its label — the modal interchange, spelled out. */
  modes: LineKind[]
  /** The colour of the one line calling here, for a stop that serves exactly one. Interchanges
   * don't get one: black is what marks them out once the ordinary stops stop using it. */
  lineColor?: string
  /** True while this station is being actively repositioned by a drag. */
  dragging: boolean
  /** A landing to play, or undefined for none. 'appear' is a station being added, which fades
   * in as it drops; 'settle' is one that was already on the map being put down somewhere else,
   * which must not blink out and back on the way. The same two a landmark uses — everything
   * the map puts down should land the same way. */
  landing?: 'appear' | 'settle'
  /** Compass direction (away from every line touching this station) to place the name in. */
  labelPlacement: LabelPlacement
  /** Which arrival of the ridden train is sitting in this station, or undefined when none is. A
   * counter rather than a flag so that pulling into the same stop twice keys a fresh crowd, instead
   * of React reusing the first one and replaying nothing. */
  boarding?: number
  onPointerDown: (e: ReactPointerEvent<SVGGElement>, station: Station) => void
  onClick: (station: Station) => void
  /** Double-clicking a stop is a request to rename it — the most repeated edit on a map. */
  onDoubleClick: (station: Station) => void
}

/** Matches the landmark's landing exactly — the two are the same gesture. */
const LAND_MS = 320

/** How much a marker swells while it's picked up, and while it's merely under the pointer —
 * the latter matching the line's own hover growth, so a station and the line through it
 * answer the cursor by the same amount. */
const DRAG_GROWTH = 2
const HOVER_GROWTH = 1.5

/**
 * A station marker, drawn as a circle for metro and a rounded square for rail. Every one of the
 * marker's rings routes through here, so the shape choice is made once — the fill/stroke logic
 * above doesn't change, only what it draws onto. A square of side `2r` reads heavier than a circle
 * of radius `r`, so rail is shrunk a touch to sit at the same visual weight as its metro neighbours.
 *
 * SVG geometry properties (r, x, y, width, height) are CSS-animatable, so the marker's hover/drag
 * swell eases either way; the transition names differ because a circle grows `r` and a rect grows
 * its box.
 */
function Mark({
  rail,
  r,
  fill,
  stroke,
  strokeWidth,
}: {
  rail: boolean
  r: number
  fill: string
  stroke: string
  strokeWidth: number
}) {
  if (rail) {
    const s = r * 0.9
    return (
      <rect
        x={-s}
        y={-s}
        width={2 * s}
        height={2 * s}
        rx={Math.max(1.5, s * 0.34)}
        fill={fill}
        stroke={stroke === 'none' ? undefined : stroke}
        strokeWidth={stroke === 'none' ? undefined : strokeWidth}
        style={{ transition: 'x 150ms ease, y 150ms ease, width 150ms ease, height 150ms ease' }}
      />
    )
  }
  return (
    <circle
      r={r}
      fill={fill}
      stroke={stroke === 'none' ? undefined : stroke}
      strokeWidth={stroke === 'none' ? undefined : strokeWidth}
      style={{ transition: 'r 150ms ease' }}
    />
  )
}

/** The gap between the name plate and the heads below it, and how many turn up for one stop. */
const BOARDER_GAP = 3
const MIN_BOARDERS = 2
const MAX_BOARDERS = 4
/** One pass of the pop, spanning the dwell — a shade under it, so the platform is clear again
 * before the train pulls out rather than figures being cut off mid-wait. */
const BOARDER_MS = 1900
/** How far apart two passengers arrive. Enough to read as arriving one after another rather than
 * as one block appearing, without the last of four still coming up as the first fades. */
const BOARDER_STAGGER = 90

/**
 * The little crowd that gathers under a station's name while a train sits in it.
 *
 * Placed on the side of the plate facing away from the marker, which for a name below or beside its
 * station is underneath it as you'd expect — but for a name sitting *above* its station, underneath
 * would mean squeezing into the few pixels between plate and marker, so it goes above instead. The
 * row is centred on the plate either way.
 *
 * Mounted only for the length of the stop, and the caller keys it per arrival, so every train that
 * pulls in brings a different handful of people rather than replaying the same one.
 */
function Boarders({
  cardX,
  cardY,
  cardW,
  cardH,
  labelY,
}: {
  cardX: number
  cardY: number
  cardW: number
  cardH: number
  labelY: number
}) {
  const [people] = useState(() => pickPeople(MIN_BOARDERS + Math.floor(Math.random() * (MAX_BOARDERS - MIN_BOARDERS + 1))))
  if (people.length === 0) return null

  const above = labelY < 0
  const rowY = above ? cardY - BOARDER_GAP - PERSON_SIZE : cardY + cardH + BOARDER_GAP
  const rowX = cardX + cardW / 2 - peopleRowWidth(people.length) / 2

  return (
    <g pointerEvents="none">
      {people.map((person, i) => (
        <g key={person} className="mlb-boarder-pop" style={{ animationDuration: `${BOARDER_MS}ms`, animationDelay: `${i * BOARDER_STAGGER}ms` }}>
          <PersonGlyph index={person} x={rowX + i * (PERSON_SIZE + PERSON_GAP)} y={rowY} size={PERSON_SIZE} />
        </g>
      ))}
    </g>
  )
}

export function StationNode({
  station,
  selected,
  inDraftLine,
  interchange,
  rail,
  modes,
  lineColor,
  dragging,
  landing,
  labelPlacement,
  boarding,
  onPointerDown,
  onClick,
  onDoubleClick,
}: StationNodeProps) {
  const [hovered, setHovered] = useState(false)
  const isInterchange = interchange || station.transfer
  const baseRadius = isInterchange ? 10 : 6.5
  const radius = dragging ? baseRadius + DRAG_GROWTH : baseRadius
  // The two don't stack: a drag is a hover too, and adding both would have the marker jump
  // again at the moment it's grabbed. Picking it up is the stronger state, so it wins.
  const drawnRadius = dragging ? radius : radius + (hovered ? HOVER_GROWTH : 0)

  // Read from the same helper the placement search uses, so the card drawn here is the exact
  // box that search resolved the overlaps against.
  //
  // A main station wears its card as a nameplate: fully rounded, the pill shape LineIndicator
  // gives a named line, in neutral ink. text-primary/text-inverse rather than the fixed
  // ink-900/ink-0 the transient chips use — those are always dark because they only ever flash
  // over the map, but a plate that lives on it has to invert with the theme or it sinks into a
  // dark canvas and leaves the name floating with no plate at all.
  //
  // Nothing about the marker changes: a principal station is one the eye should find by name,
  // and the map already spends its marker vocabulary on what the lines are doing.
  const isMain = station.main
  // A main station that mixes two modes carries a glyph for each inside its label; the card
  // reserves the room so the placement search sizes the real box.
  const showModes = isMain && modes.length >= 2
  const glyphsWidth = showModes ? modeGlyphsWidth(modes.length) : 0
  const { labelX, labelY, cardX, cardY, cardW, cardH, lines, glyphsX, glyphsY } = labelGeometry(
    station,
    labelPlacement,
    isInterchange,
    glyphsWidth,
  )

  return (
    <g
      transform={`translate(${station.x}, ${station.y})`}
      onPointerDown={e => onPointerDown(e, station)}
      onClick={() => onClick(station)}
      onDoubleClick={e => {
        // Kept off the svg's own double-click, which finishes a draft: this one only ever
        // means "rename this stop", so it stops here rather than reaching the canvas.
        e.stopPropagation()
        onDoubleClick(station)
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // The marker's own cursor wins over the svg's wherever the pointer is actually on it,
      // so the closed hand has to be repeated here or grabbing a station would keep showing
      // the arrow for as long as the pointer stayed on the marker it was dragging.
      style={{ cursor: dragging ? 'grabbing' : 'pointer' }}
    >
      {/* Safari doesn't reliably render CSS drop-shadow() filters on SVG content, so
          the drag shadow is a real SVG <filter> (defined once in MapCanvas) applied
          via the filter attribute — feDropShadow works across all engines. */}
      <g filter={dragging ? 'url(#station-drag-shadow)' : undefined}>
        {selected && (
          <circle
            r={drawnRadius + 5}
            fill="none"
            stroke="var(--brand-500)"
            strokeWidth={2}
            opacity={0.5}
            style={{ transition: 'r 150ms ease' }}
          />
        )}
        {/* The marker lands rather than appearing. The group's bounding box is symmetric about
            the origin, so fill-box + centre origin scales and drops it around the station. */}
        <g
          style={
            landing
              ? {
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  animation: `${landing === 'appear' ? 'mlb-marker-land' : 'mlb-marker-settle'} ${LAND_MS}ms cubic-bezier(0.3, 1.4, 0.5, 1) both`,
                }
              : undefined
          }
        >
          {isInterchange ? (
            // An interchange stays a circle whatever mode meets there. The double ring is the
            // "change here" mark, and it's the more important thing to say at a junction than which
            // kind of line it is — a metro/rail transfer reads as a transfer first. So the square is
            // reserved for a single rail stop; the moment a station becomes an interchange it rejoins
            // the circle vocabulary, and the rail lines through it already show themselves as rail.
            <>
              <Mark
                rail={false}
                r={drawnRadius}
                fill={inDraftLine ? 'var(--brand-500)' : 'var(--bg-page)'}
                stroke={inDraftLine ? 'var(--brand-500)' : 'var(--text-primary)'}
                strokeWidth={3.5}
              />
              <Mark
                rail={false}
                r={drawnRadius - 4.5}
                fill="none"
                stroke={inDraftLine ? 'var(--brand-500)' : 'var(--text-primary)'}
                strokeWidth={1.25}
              />
            </>
          ) : (
            // A single-line stop wears its line's colour rather than black, so the map's black is
            // spent on interchanges alone — the places where a decision is made.
            //
            // Not the raw colour, though: measured against the page, four of the ten line colours
            // fall under 2:1 in one theme or the other — yellow disappears on a light page, purple
            // and graphite on a dark one — and since the bead is a page-coloured hole inside that
            // ring, low contrast means an invisible stop. Mixing a third of the ink in pulls every
            // colour back to a legible edge while leaving the hue recognisable, and because the ink
            // is themed, the mix darkens on light pages and lightens on dark ones without a second rule.
            <Mark
              rail={rail}
              r={drawnRadius}
              fill={inDraftLine ? 'var(--brand-500)' : 'var(--bg-page)'}
              stroke={
                inDraftLine
                  ? 'var(--brand-500)'
                  : lineColor
                    ? `color-mix(in srgb, ${lineColor} 68%, var(--text-primary))`
                    : 'var(--text-primary)'
              }
              strokeWidth={2.5}
            />
          )}
        </g>
        {lines.length > 0 && (
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
        {/* One tspan per wrapped line, the block centred on the card the placement search
            sized for exactly these lines. */}
        <text
          x={labelX}
          y={labelY - ((lines.length - 1) * LABEL_FONT_SIZE) / 2 + LABEL_FONT_SIZE * BASELINE_CENTRE}
          textAnchor={labelPlacement.anchor}
          fontSize={LABEL_FONT_SIZE}
          fontFamily="'Barlow Condensed', system-ui, sans-serif"
          fontWeight={isMain ? 700 : 600}
          fill={isMain ? 'var(--text-inverse)' : 'var(--text-primary)'}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {lines.map((line, index) => (
            <tspan key={index} x={labelX} dy={index === 0 ? 0 : LABEL_FONT_SIZE}>
              {line}
            </tspan>
          ))}
        </text>

        {/* The modes that meet here, glyphed inside the label's right end — but only where a main
            station mixes two of them, which is the modal interchange the icons are for. A single-mode
            stop shows nothing: the whole map is one mode by default, so a lone glyph would say little.
            Inverted, because a main station's plate is a dark pill and the name on it is inverted too. */}
        {boarding !== undefined && lines.length > 0 && (
          <Boarders key={boarding} cardX={cardX} cardY={cardY} cardW={cardW} cardH={cardH} labelY={labelY} />
        )}

        {showModes && (
          <g pointerEvents="none">
            {modes.map((mode, i) => (
              <ModeGlyphSvg
                key={mode}
                mode={mode}
                x={glyphsX + i * (MODE_GLYPH_SIZE + MODE_GLYPH_GAP)}
                y={glyphsY - MODE_GLYPH_SIZE / 2}
                size={MODE_GLYPH_SIZE}
                color="var(--text-inverse)"
              />
            ))}
          </g>
        )}
      </g>
    </g>
  )
}
