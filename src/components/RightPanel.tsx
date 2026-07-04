import { useEffect, useState } from 'react'
import { Tabs } from 'metro-ds'
import { LinesPanel } from './LinesPanel'
import { StationsPanel } from './StationsPanel'
import { GeoPanel } from './GeoPanel'
import { CompaniesPanel } from './CompaniesPanel'
import { Inspector } from './Inspector'
import type { Company, GeoFeature, Line, Station } from '../types'

interface RightPanelProps {
  mapName: string
  authorityName: string
  authorityDisplayName: string
  lineList: Line[]
  stationList: Station[]
  geoFeatureList: GeoFeature[]
  companyList: Company[]
  lines: Record<string, Line>
  stations: Record<string, Station>
  selectedLine: Line | null
  selectedStation: Station | null
  selectedGeoFeature: GeoFeature | null
  selectedCompany: Company | null
  onSelectLine: (lineId: string) => void
  onSelectStation: (stationId: string) => void
  onSelectGeoFeature: (geoFeatureId: string) => void
  onSelectCompany: (companyId: string) => void
  onToggleLineVisibility: (lineId: string) => void
  onAddLine: () => void
  onAddRiver: () => void
  onAddPark: () => void
  onAddCompany: () => void
  onSetAuthorityName: (name: string) => void
  onRenameLine: (lineId: string, name: string) => void
  onRecolorLine: (lineId: string, color: string) => void
  onSetLineCompany: (lineId: string, companyId: string | null) => void
  onExtendLine: (lineId: string, end: 'start' | 'end') => void
  onDeleteLine: (lineId: string) => void
  onRenameStation: (stationId: string, name: string) => void
  onToggleTransfer: (stationId: string) => void
  onDeleteStation: (stationId: string) => void
  onRenameGeoFeature: (geoFeatureId: string, name: string) => void
  onDeleteGeoFeature: (geoFeatureId: string) => void
  onRenameCompany: (companyId: string, name: string) => void
  onSetCompanyType: (companyId: string, type: Company['type']) => void
  onDeleteCompany: (companyId: string) => void
}

const TABS = ['Lines', 'Stations', 'Geography', 'Companies', 'Properties']

export function RightPanel({
  mapName,
  authorityName,
  authorityDisplayName,
  lineList,
  stationList,
  geoFeatureList,
  companyList,
  lines,
  stations,
  selectedLine,
  selectedStation,
  selectedGeoFeature,
  selectedCompany,
  onSelectLine,
  onSelectStation,
  onSelectGeoFeature,
  onSelectCompany,
  onToggleLineVisibility,
  onAddLine,
  onAddRiver,
  onAddPark,
  onAddCompany,
  onSetAuthorityName,
  onRenameLine,
  onRecolorLine,
  onSetLineCompany,
  onExtendLine,
  onDeleteLine,
  onRenameStation,
  onToggleTransfer,
  onDeleteStation,
  onRenameGeoFeature,
  onDeleteGeoFeature,
  onRenameCompany,
  onSetCompanyType,
  onDeleteCompany,
}: RightPanelProps) {
  const [tab, setTab] = useState('Lines')

  useEffect(() => {
    if (selectedLine || selectedStation || selectedGeoFeature || selectedCompany) setTab('Properties')
  }, [selectedLine, selectedStation, selectedGeoFeature, selectedCompany])

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
        {tab === 'Geography' && (
          <GeoPanel
            geoFeatureList={geoFeatureList}
            selectedGeoFeatureId={selectedGeoFeature?.id ?? null}
            onSelect={onSelectGeoFeature}
            onAddRiver={onAddRiver}
            onAddPark={onAddPark}
          />
        )}
        {tab === 'Companies' && (
          <CompaniesPanel
            companies={companyList}
            selectedCompanyId={selectedCompany?.id ?? null}
            onSelect={onSelectCompany}
            onAddCompany={onAddCompany}
            mapName={mapName}
            authorityName={authorityName}
            onSetAuthorityName={onSetAuthorityName}
          />
        )}
        {tab === 'Properties' && (
          <Inspector
            selectedLine={selectedLine}
            selectedStation={selectedStation}
            selectedGeoFeature={selectedGeoFeature}
            selectedCompany={selectedCompany}
            stations={stations}
            lines={lines}
            companyList={companyList}
            authorityDisplayName={authorityDisplayName}
            onRenameLine={onRenameLine}
            onRecolorLine={onRecolorLine}
            onSetLineCompany={onSetLineCompany}
            onExtendLine={onExtendLine}
            onDeleteLine={onDeleteLine}
            onRenameStation={onRenameStation}
            onToggleTransfer={onToggleTransfer}
            onDeleteStation={onDeleteStation}
            onRenameGeoFeature={onRenameGeoFeature}
            onDeleteGeoFeature={onDeleteGeoFeature}
            onRenameCompany={onRenameCompany}
            onSetCompanyType={onSetCompanyType}
            onDeleteCompany={onDeleteCompany}
          />
        )}
      </div>
    </div>
  )
}
