import { useState } from 'react'
import { Badge, Button, Divider, Input, Select, Tag, Toggle } from 'metro-ds'
import { ParkIcon, PenIcon, PoiIcon, RiverIcon, TrashIcon } from '../icons'
import { LINE_COLORS } from '../lineColors'
import { isUsableLineNumber, MAX_LINE_NUMBER } from '../lineNumber'
import type { Company, GeoFeature, Line, PointOfInterest, Station } from '../types'
import { COMPANY_SYMBOLS } from '../types'
import { CompanySymbolIcon } from '../companySymbols'
import { DeleteStationsDialog } from './DeleteStationsDialog'
import { openMojiBySubgroup, openMojiUrl, SUBGROUP_LABELS } from '../openmoji'
import { connectedLineCount, exclusiveStationIds, isTransferStation, lineHasStation, stationIdsOfLine } from '../canvas/lineNodes'

/** Why `draft` can't be committed, or undefined if it can. One rule drives both the message
 * and whether the edit lands, so the field can never show an error while having applied the
 * value anyway — or vice versa. */
function lineNumberError(draft: string, line: Line, lines: Record<string, Line>): string | undefined {
  const trimmed = draft.trim()
  if (trimmed === '') return 'Enter a number'
  const parsed = Number(trimmed)
  if (!isUsableLineNumber(parsed)) return `Use a whole number from 1 to ${MAX_LINE_NUMBER}`
  const clash = Object.values(lines).find(other => other.id !== line.id && other.number === parsed)
  if (!clash) return undefined
  return `Already used by ${clash.name.trim() || `line ${clash.number}`}`
}

/**
 * The line's number, held as a local draft rather than driven straight from `line.number`.
 * Typing "12" passes through "1" on the way, which may well be another line's number — so a
 * controlled field would either reject the keystroke or briefly commit the wrong number. The
 * draft lets an in-progress or clashing entry sit in the field and explain itself, and only
 * a valid one is dispatched. Caller keys this by line id, so selecting another line remounts
 * it with that line's number.
 */
function LineNumberField({
  line,
  lines,
  onSetLineNumber,
}: {
  line: Line
  lines: Record<string, Line>
  onSetLineNumber: (lineId: string, number: number) => void
}) {
  const [draft, setDraft] = useState(String(line.number))

  return (
    <Input
      label="Line number"
      type="number"
      value={draft}
      error={lineNumberError(draft, line, lines)}
      onChange={e => {
        const next = e.target.value
        setDraft(next)
        if (!lineNumberError(next, line, lines)) onSetLineNumber(line.id, Number(next.trim()))
      }}
    />
  )
}


/**
 * "Delete line", and the question that goes with it: a line's stations outlive it by default,
 * but the ones it alone served are usually rubble the user then has to clear by hand.
 *
 * The question is only worth asking when there's something to ask about — a line whose every
 * stop is shared with another line has nothing that could go with it, so that case deletes
 * straight away rather than opening a dialog with one real answer.
 */
function DeleteLineButton({
  line,
  lines,
  stations,
  onDeleteLine,
}: {
  line: Line
  lines: Record<string, Line>
  stations: Record<string, Station>
  onDeleteLine: (lineId: string, withStations: boolean) => void
}) {
  const [asking, setAsking] = useState(false)

  const others = Object.values(lines).filter(other => other.id !== line.id)
  const ownStationIds = [...new Set(stationIdsOfLine(line))]
  const exclusive = exclusiveStationIds([line], others)
  const name = line.name.trim() || `Line ${line.number}`

  const remove = (withStations: boolean) => {
    setAsking(false)
    onDeleteLine(line.id, withStations)
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        icon={<TrashIcon />}
        onClick={() => (exclusive.length > 0 ? setAsking(true) : remove(false))}
      >
        Delete line
      </Button>

      <DeleteStationsDialog
        open={asking}
        title={`Delete ${name}?`}
        totalStationCount={ownStationIds.length}
        atRisk={exclusive.map(id => stations[id]?.name ?? id)}
        onCancel={() => setAsking(false)}
        onKeep={() => remove(false)}
        onDeleteAll={() => remove(true)}
      />
    </>
  )
}

interface InspectorProps {
  selectedLine: Line | null
  selectedStation: Station | null
  selectedGeoFeature: GeoFeature | null
  selectedPoi: PointOfInterest | null
  selectedCompany: Company | null
  stations: Record<string, Station>
  lines: Record<string, Line>
  companyList: Company[]
  authorityDisplayName: string
  onRenameLine: (lineId: string, name: string) => void
  onSetLineNumber: (lineId: string, number: number) => void
  onRecolorLine: (lineId: string, color: string) => void
  onSetLineCompany: (lineId: string, companyId: string | null) => void
  onExtendLine: (lineId: string, end: 'start' | 'end') => void
  onDeleteLine: (lineId: string, withStations: boolean) => void
  onRenameStation: (stationId: string, name: string) => void
  onToggleTransfer: (stationId: string) => void
  onToggleMain: (stationId: string) => void
  onDeleteStation: (stationId: string) => void
  onRenameGeoFeature: (geoFeatureId: string, name: string) => void
  onExtendGeoFeature: (geoFeatureId: string, end: 'start' | 'end') => void
  onDeleteGeoFeature: (geoFeatureId: string) => void
  onRenamePoi: (poiId: string, name: string) => void
  onSetPoiIcon: (poiId: string, icon: string) => void
  onDeletePoi: (poiId: string) => void
  onRenameCompany: (companyId: string, name: string) => void
  onSetCompanyType: (companyId: string, type: Company['type']) => void
  onSetCompanySymbol: (companyId: string, symbol: Company['symbol']) => void
  onDeleteCompany: (companyId: string) => void
}

export function Inspector({
  selectedLine,
  selectedStation,
  selectedGeoFeature,
  selectedPoi,
  selectedCompany,
  stations,
  lines,
  companyList,
  authorityDisplayName,
  onRenameLine,
  onSetLineNumber,
  onRecolorLine,
  onSetLineCompany,
  onExtendLine,
  onDeleteLine,
  onRenameStation,
  onToggleTransfer,
  onToggleMain,
  onDeleteStation,
  onRenameGeoFeature,
  onExtendGeoFeature,
  onDeleteGeoFeature,
  onRenamePoi,
  onSetPoiIcon,
  onDeletePoi,
  onRenameCompany,
  onSetCompanyType,
  onSetCompanySymbol,
  onDeleteCompany,
}: InspectorProps) {
  if (!selectedLine && !selectedStation && !selectedGeoFeature && !selectedCompany && !selectedPoi) {
    return (
      <div style={{ padding: 'var(--space-5)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
        Select a line, station, company, or geography feature to inspect its properties.
      </div>
    )
  }

  if (selectedCompany) {
    const company = selectedCompany
    const companyLines = Object.values(lines).filter(l => l.companyId === company.id)

    return (
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
          <span style={{ color: 'var(--text-muted)', display: 'flex' }}>
            <CompanySymbolIcon symbol={company.symbol} />
          </span>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Company properties</span>
        </div>
        <Divider />

        <Input label="Company name" value={company.name} onChange={e => onRenameCompany(company.id, e.target.value)} />

        <Toggle
          checked={company.type === 'private'}
          onChange={checked => onSetCompanyType(company.id, checked ? 'private' : 'public')}
          label={company.type === 'private' ? 'Private company' : 'Public company'}
          size="sm"
        />

        {/* Same picker idiom as a line's colour swatches, but the tiles stay monochrome —
            the mark is drawn in the current ink wherever it appears, so the picker shows it
            the way the panel will actually wear it. Tiles run five to a row at 44px: these
            are logos being chosen, not swatches, so they get room to read as one. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)' }}>Symbol</label>
          <div style={{ display: 'flex', gap: 'var(--gap-tight)', flexWrap: 'wrap' }}>
            {COMPANY_SYMBOLS.map(symbol => {
              const active = company.symbol === symbol
              return (
                <button
                  key={symbol}
                  type="button"
                  aria-label={`Set company symbol ${symbol}`}
                  onClick={() => onSetCompanySymbol(company.id, symbol)}
                  style={{
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${active ? 'var(--interactive-primary)' : 'var(--border-default)'}`,
                    background: active ? 'var(--color-info-bg)' : 'var(--bg-surface)',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    outline: active ? '1px solid var(--interactive-primary)' : 'none',
                    outlineOffset: '-2px',
                    transition: 'border-color 100ms ease, background 100ms ease',
                  }}
                >
                  <CompanySymbolIcon symbol={symbol} size={26} />
                </button>
              )
            })}
          </div>
        </div>

        <Divider label="Lines" />
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {companyLines.length === 0 && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>No lines assigned yet</span>
          )}
          {companyLines.map(l => (
            <Tag key={l.id} color={l.color}>
              {l.name}
            </Tag>
          ))}
        </div>

        <Divider />
        <Button variant="destructive" size="sm" icon={<TrashIcon />} onClick={() => onDeleteCompany(company.id)}>
          Delete company
        </Button>
      </div>
    )
  }

  if (selectedPoi) {
    const poi = selectedPoi
    const url = openMojiUrl(poi.icon)
    return (
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
          <span style={{ color: 'var(--text-muted)', display: 'flex' }}>
            {url ? <img src={url} alt="" width={16} height={16} /> : <PoiIcon />}
          </span>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Point of interest
          </span>
        </div>
        <Divider />

        <Input label="Name" value={poi.name} onChange={e => onRenamePoi(poi.id, e.target.value)} />

        {/* The same grid the placement picker offers, so changing a landmark's symbol after
            the fact is the gesture that placed it. Kept scrollable rather than paged: the
            sections are the map of the set, and hiding them behind a dropdown would cost
            more than the height it saves. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)' }}>Symbol</label>
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {openMojiBySubgroup().map(group => (
              <div key={group.subgroup} style={{ marginBottom: 'var(--gap-sm)' }}>
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
                    const entryUrl = openMojiUrl(entry.hexcode)
                    return (
                      <button
                        key={entry.hexcode}
                        type="button"
                        className="mlb-poi-swatch"
                        data-selected={entry.hexcode === poi.icon}
                        title={entry.name}
                        aria-label={entry.name}
                        aria-pressed={entry.hexcode === poi.icon}
                        onClick={() => onSetPoiIcon(poi.id, entry.hexcode)}
                      >
                        {entryUrl && <img src={entryUrl} alt="" width={24} height={24} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Divider />
        <Button variant="destructive" size="sm" icon={<TrashIcon />} onClick={() => onDeletePoi(poi.id)}>
          Delete point of interest
        </Button>
      </div>
    )
  }

  if (selectedGeoFeature) {
    const feature = selectedGeoFeature
    return (
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
          <span style={{ color: feature.type === 'river' ? '#3B82F6' : '#16A34A' }}>
            {feature.type === 'river' ? <RiverIcon /> : <ParkIcon />}
          </span>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {feature.type === 'river' ? 'River' : 'Park'} properties
          </span>
        </div>
        <Divider />

        <Input
          label="Name"
          value={feature.name}
          onChange={e => onRenameGeoFeature(feature.id, e.target.value)}
        />

        <Divider />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Extend {feature.type} from
          </label>
          <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<PenIcon />}
              style={{ flex: 1 }}
              onClick={() => onExtendGeoFeature(feature.id, 'start')}
            >
              Start
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<PenIcon />}
              style={{ flex: 1 }}
              onClick={() => onExtendGeoFeature(feature.id, 'end')}
            >
              End
            </Button>
          </div>
        </div>

        <Divider />
        <Button variant="destructive" size="sm" icon={<TrashIcon />} onClick={() => onDeleteGeoFeature(feature.id)}>
          Delete {feature.type}
        </Button>
      </div>
    )
  }

  if (selectedLine) {
    const line = selectedLine
    const lineStations = stationIdsOfLine(line).map(id => stations[id]).filter((s): s is Station => Boolean(s))

    return (
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: 'var(--radius-sm)', background: line.color, flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Line properties</span>
        </div>
        <Divider />

        <LineNumberField key={line.id} line={line} lines={lines} onSetLineNumber={onSetLineNumber} />

        <Input label="Line name" value={line.name} onChange={e => onRenameLine(line.id, e.target.value)} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)' }}>Color</label>
          <div style={{ display: 'flex', gap: 'var(--gap-tight)', flexWrap: 'wrap' }}>
            {LINE_COLORS.map(color => (
              <button
                key={color}
                type="button"
                aria-label={`Set line color ${color}`}
                onClick={() => onRecolorLine(line.id, color)}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: 'var(--radius-sm)',
                  background: color,
                  border: 'none',
                  cursor: 'pointer',
                  outline: line.color === color ? `2px solid ${color}` : 'none',
                  outlineOffset: '2px',
                  transition: 'outline 100ms ease',
                }}
              />
            ))}
          </div>
        </div>

        <Select
          label="Company"
          size="sm"
          value={line.companyId ?? ''}
          options={[
            { label: `${authorityDisplayName} (Local Transport Authority)`, value: '' },
            ...companyList.map(c => ({ label: c.name, value: c.id })),
          ]}
          onChange={value => onSetLineCompany(line.id, value === '' ? null : String(value))}
        />

        <Divider label="Stations" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {lineStations.map(s => {
            const transfer = isTransferStation(s, Object.values(lines))
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-tight)', padding: '4px 0' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: 'var(--radius-full)',
                    border: `2px solid ${line.color}`,
                    background: transfer ? line.color : 'var(--bg-surface)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', flex: 1 }}>{s.name}</span>
                {transfer && (
                  <Badge variant="primary" style={{ fontSize: '9px', padding: '1px 5px' }}>
                    Transfer
                  </Badge>
                )}
              </div>
            )
          })}
        </div>

        <Divider />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Extend line from
          </label>
          <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
            <div title={`Extend from ${lineStations[0]?.name ?? 'start'}`} style={{ flex: 1, minWidth: 0 }}>
              <Button
                variant="secondary"
                size="sm"
                icon={<PenIcon />}
                style={{ width: '100%' }}
                onClick={() => onExtendLine(line.id, 'start')}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lineStations[0]?.name ?? 'Start'}
                </span>
              </Button>
            </div>
            <div
              title={`Extend from ${lineStations[lineStations.length - 1]?.name ?? 'end'}`}
              style={{ flex: 1, minWidth: 0 }}
            >
              <Button
                variant="secondary"
                size="sm"
                icon={<PenIcon />}
                style={{ width: '100%' }}
                onClick={() => onExtendLine(line.id, 'end')}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lineStations[lineStations.length - 1]?.name ?? 'End'}
                </span>
              </Button>
            </div>
          </div>
        </div>
        <DeleteLineButton line={line} lines={lines} stations={stations} onDeleteLine={onDeleteLine} />
      </div>
    )
  }

  if (selectedStation) {
    const station = selectedStation
    const lineValues = Object.values(lines)
    const stationLines = lineValues.filter(l => lineHasStation(l, station.id))
    const lineCount = connectedLineCount(station.id, lineValues)
    const autoTransfer = lineCount >= 2
    const transfer = station.transfer || autoTransfer

    return (
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: 'var(--radius-full)',
              border: `2px solid ${stationLines[0]?.color ?? 'var(--border-strong)'}`,
              background: transfer ? (stationLines[0]?.color ?? 'var(--border-strong)') : 'var(--bg-surface)',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Station properties</span>
        </div>
        <Divider />

        <Input label="Station name" value={station.name} onChange={e => onRenameStation(station.id, e.target.value)} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)' }}>Lines</label>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {stationLines.length === 0 && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Not on a line yet</span>
            )}
            {stationLines.map(l => (
              <Tag key={l.id} color={l.color}>
                {l.name}
              </Tag>
            ))}
          </div>
        </div>

        <Toggle
          checked={transfer}
          disabled={autoTransfer}
          onChange={() => onToggleTransfer(station.id)}
          label="Transfer station"
          hint={autoTransfer ? `Automatic — connected to ${lineCount} lines` : undefined}
          size="sm"
        />

        {/* No automatic counterpart, unlike transfer above: serving many lines doesn't make a
            station principal, so this one is never derived and never disabled. */}
        <Toggle
          checked={station.main}
          onChange={() => onToggleMain(station.id)}
          label="Main station"
          hint="One of the network's principal stations"
          size="sm"
        />

        <Divider />
        <Button variant="destructive" size="sm" icon={<TrashIcon />} onClick={() => onDeleteStation(station.id)}>
          Delete station
        </Button>
      </div>
    )
  }

  return null
}
