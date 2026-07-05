import { Badge, Button, Divider, Input, Select, Tag, Toggle } from 'metro-ds'
import { BuildingIcon, ParkIcon, PenIcon, RiverIcon, TrashIcon } from '../icons'
import { LINE_COLORS } from '../lineColors'
import type { Company, GeoFeature, Line, Station } from '../types'
import { connectedLineCount, isTransferStation, lineHasStation, stationIdsOfLine } from '../canvas/lineNodes'

interface InspectorProps {
  selectedLine: Line | null
  selectedStation: Station | null
  selectedGeoFeature: GeoFeature | null
  selectedCompany: Company | null
  stations: Record<string, Station>
  lines: Record<string, Line>
  companyList: Company[]
  authorityDisplayName: string
  onRenameLine: (lineId: string, name: string) => void
  onRecolorLine: (lineId: string, color: string) => void
  onSetLineCompany: (lineId: string, companyId: string | null) => void
  onExtendLine: (lineId: string, end: 'start' | 'end') => void
  onDeleteLine: (lineId: string) => void
  onRenameStation: (stationId: string, name: string) => void
  onToggleTransfer: (stationId: string) => void
  onDeleteStation: (stationId: string) => void
  onRenameGeoFeature: (geoFeatureId: string, name: string) => void
  onExtendGeoFeature: (geoFeatureId: string, end: 'start' | 'end') => void
  onDeleteGeoFeature: (geoFeatureId: string) => void
  onRenameCompany: (companyId: string, name: string) => void
  onSetCompanyType: (companyId: string, type: Company['type']) => void
  onDeleteCompany: (companyId: string) => void
}

export function Inspector({
  selectedLine,
  selectedStation,
  selectedGeoFeature,
  selectedCompany,
  stations,
  lines,
  companyList,
  authorityDisplayName,
  onRenameLine,
  onRecolorLine,
  onSetLineCompany,
  onExtendLine,
  onDeleteLine,
  onRenameStation,
  onToggleTransfer,
  onDeleteStation,
  onRenameGeoFeature,
  onExtendGeoFeature,
  onDeleteGeoFeature,
  onRenameCompany,
  onSetCompanyType,
  onDeleteCompany,
}: InspectorProps) {
  if (!selectedLine && !selectedStation && !selectedGeoFeature && !selectedCompany) {
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
          <span style={{ color: 'var(--text-muted)' }}>
            <BuildingIcon />
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
        <Button variant="destructive" size="sm" icon={<TrashIcon />} onClick={() => onDeleteLine(line.id)}>
          Delete line
        </Button>
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

        <Divider />
        <Button variant="destructive" size="sm" icon={<TrashIcon />} onClick={() => onDeleteStation(station.id)}>
          Delete station
        </Button>
      </div>
    )
  }

  return null
}
