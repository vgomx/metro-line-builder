import { Badge, Button, Divider, Input, Tag, Toggle } from 'metro-ds'
import { TrashIcon } from '../icons'
import { LINE_COLORS } from '../lineColors'
import type { Line, Station } from '../types'

interface InspectorProps {
  selectedLine: Line | null
  selectedStation: Station | null
  stations: Record<string, Station>
  lines: Record<string, Line>
  onRenameLine: (lineId: string, name: string) => void
  onRecolorLine: (lineId: string, color: string) => void
  onDeleteLine: (lineId: string) => void
  onRenameStation: (stationId: string, name: string) => void
  onToggleTransfer: (stationId: string) => void
  onDeleteStation: (stationId: string) => void
}

export function Inspector({
  selectedLine,
  selectedStation,
  stations,
  lines,
  onRenameLine,
  onRecolorLine,
  onDeleteLine,
  onRenameStation,
  onToggleTransfer,
  onDeleteStation,
}: InspectorProps) {
  if (!selectedLine && !selectedStation) {
    return (
      <div style={{ padding: 'var(--space-5)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
        Select a line or station to inspect its properties.
      </div>
    )
  }

  if (selectedLine) {
    const line = selectedLine
    const lineStations = line.stationIds.map(id => stations[id]).filter((s): s is Station => Boolean(s))

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

        <Divider label="Stations" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {lineStations.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-tight)', padding: '4px 0' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: 'var(--radius-full)',
                  border: `2px solid ${line.color}`,
                  background: s.transfer ? line.color : 'var(--bg-surface)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', flex: 1 }}>{s.name}</span>
              {s.transfer && (
                <Badge variant="primary" style={{ fontSize: '9px', padding: '1px 5px' }}>
                  Transfer
                </Badge>
              )}
            </div>
          ))}
        </div>

        <Divider />
        <Button variant="destructive" size="sm" icon={<TrashIcon />} onClick={() => onDeleteLine(line.id)}>
          Delete line
        </Button>
      </div>
    )
  }

  if (selectedStation) {
    const station = selectedStation
    const stationLines = Object.values(lines).filter(l => l.stationIds.includes(station.id))

    return (
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-sm)' }}>
          <div
            style={{
              width: '14px',
              height: '14px',
              borderRadius: 'var(--radius-full)',
              border: `2px solid ${stationLines[0]?.color ?? 'var(--ink-300)'}`,
              background: station.transfer ? (stationLines[0]?.color ?? 'var(--ink-300)') : 'var(--bg-surface)',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Station properties</span>
        </div>
        <Divider />

        <Input label="Station name" value={station.name} onChange={e => onRenameStation(station.id, e.target.value)} />

        <div style={{ display: 'flex', gap: 'var(--gap-sm)' }}>
          <Input label="X" value={Math.round(station.x)} size="sm" style={{ flex: 1 }} disabled />
          <Input label="Y" value={Math.round(station.y)} size="sm" style={{ flex: 1 }} disabled />
        </div>

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

        <Toggle checked={station.transfer} onChange={() => onToggleTransfer(station.id)} label="Transfer station" size="sm" />

        <Divider />
        <Button variant="destructive" size="sm" icon={<TrashIcon />} onClick={() => onDeleteStation(station.id)}>
          Delete station
        </Button>
      </div>
    )
  }

  return null
}
