import { useEffect, useState } from 'react'
import { Tabs } from 'metro-ds'
import { LinesPanel } from './LinesPanel'
import { StationsPanel } from './StationsPanel'
import { Inspector } from './Inspector'
import type { Line, Station } from '../types'

interface RightPanelProps {
  lineList: Line[]
  stationList: Station[]
  lines: Record<string, Line>
  stations: Record<string, Station>
  selectedLine: Line | null
  selectedStation: Station | null
  onSelectLine: (lineId: string) => void
  onSelectStation: (stationId: string) => void
  onToggleLineVisibility: (lineId: string) => void
  onAddLine: () => void
  onRenameLine: (lineId: string, name: string) => void
  onRecolorLine: (lineId: string, color: string) => void
  onDeleteLine: (lineId: string) => void
  onRenameStation: (stationId: string, name: string) => void
  onToggleTransfer: (stationId: string) => void
  onDeleteStation: (stationId: string) => void
}

const TABS = ['Lines', 'Stations', 'Properties']

export function RightPanel({
  lineList,
  stationList,
  lines,
  stations,
  selectedLine,
  selectedStation,
  onSelectLine,
  onSelectStation,
  onToggleLineVisibility,
  onAddLine,
  onRenameLine,
  onRecolorLine,
  onDeleteLine,
  onRenameStation,
  onToggleTransfer,
  onDeleteStation,
}: RightPanelProps) {
  const [tab, setTab] = useState('Lines')

  useEffect(() => {
    if (selectedLine || selectedStation) setTab('Properties')
  }, [selectedLine, selectedStation])

  return (
    <div
      style={{
        width: '272px',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {tab === 'Lines' && (
          <LinesPanel
            lines={lineList}
            selectedLineId={selectedLine?.id ?? null}
            onSelect={onSelectLine}
            onToggleVisibility={onToggleLineVisibility}
            onAddLine={onAddLine}
          />
        )}
        {tab === 'Stations' && (
          <StationsPanel
            stations={stationList}
            lines={lineList}
            selectedStationId={selectedStation?.id ?? null}
            onSelect={onSelectStation}
          />
        )}
        {tab === 'Properties' && (
          <Inspector
            selectedLine={selectedLine}
            selectedStation={selectedStation}
            stations={stations}
            lines={lines}
            onRenameLine={onRenameLine}
            onRecolorLine={onRecolorLine}
            onDeleteLine={onDeleteLine}
            onRenameStation={onRenameStation}
            onToggleTransfer={onToggleTransfer}
            onDeleteStation={onDeleteStation}
          />
        )}
      </div>
    </div>
  )
}
