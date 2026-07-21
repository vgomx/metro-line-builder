import { useEffect, useRef, useState } from 'react'
import { IconButton, Tabs } from 'metro-ds'
import { BackIcon } from '../icons'
import { LinesPanel } from './LinesPanel'
import { StationsPanel } from './StationsPanel'
import { GeoPanel } from './GeoPanel'
import { CompaniesPanel } from './CompaniesPanel'
import { Inspector } from './Inspector'
import { HoverTip } from './HoverTip'
import type { Company, GeoFeature, Line, PointOfInterest, Station } from '../types'

interface RightPanelProps {
  mapName: string
  authorityName: string
  authorityDisplayName: string
  lineList: Line[]
  stationList: Station[]
  geoFeatureList: GeoFeature[]
  poiList: PointOfInterest[]
  companyList: Company[]
  lines: Record<string, Line>
  stations: Record<string, Station>
  selectedLine: Line | null
  selectedStation: Station | null
  selectedGeoFeature: GeoFeature | null
  selectedPoi: PointOfInterest | null
  selectedCompany: Company | null
  onSelectLine: (lineId: string) => void
  onSelectStation: (stationId: string) => void
  onSelectGeoFeature: (geoFeatureId: string) => void
  onSelectPoi: (poiId: string) => void
  onSelectCompany: (companyId: string) => void
  onToggleLineVisibility: (lineId: string) => void
  onReorderLine: (lineId: string, toIndex: number) => void
  onAddLine: () => void
  onAddRiver: () => void
  onAddPark: () => void
  onAddPoi: () => void
  onAddCompany: () => void
  onSetAuthorityName: (name: string) => void
  onRenameLine: (lineId: string, name: string) => void
  onSetLineNumber: (lineId: string, number: number) => void
  onRecolorLine: (lineId: string, color: string) => void
  onSetLineCompany: (lineId: string, companyId: string | null) => void
  onExtendLine: (lineId: string, end: 'start' | 'end') => void
  onDeleteLine: (lineId: string, withStations: boolean) => void
  onRenameStation: (stationId: string, name: string) => void
  /** Changes when the canvas asks for the selected stop's name to be put in hand. */
  focusNameToken: number
  onAddStationToLine: (lineId: string, stationId: string) => void
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

/**
 * Properties isn't among them. Five tabs measured 422px inside a 270px strip, so two of them
 * were always scrolled out of sight — and Properties was the one that least needed to be
 * there: it is a detail view, reached by selecting something rather than by browsing to it,
 * and the subheader's back arrow is how you leave. The four that remain are the four lists,
 * which is a coherent thing for a tab strip to be.
 */
const TABS = ['Lines', 'Stations', 'Geography', 'Companies']
/** The tabs in strip order, plus Properties last — the deep view a selection opens into. The
 * slide direction reads off this: a higher index enters from the right, a lower one from the
 * left. */
const TAB_ORDER = [...TABS, 'Properties']

export const RIGHT_PANEL_WIDTH = 272

export function RightPanel({
  mapName,
  authorityName,
  authorityDisplayName,
  lineList,
  stationList,
  geoFeatureList,
  poiList,
  companyList,
  lines,
  stations,
  selectedLine,
  selectedStation,
  selectedGeoFeature,
  selectedPoi,
  selectedCompany,
  onSelectLine,
  onSelectStation,
  onSelectGeoFeature,
  onSelectPoi,
  onSelectCompany,
  onToggleLineVisibility,
  onReorderLine,
  onAddLine,
  onAddRiver,
  onAddPark,
  onAddPoi,
  onAddCompany,
  onSetAuthorityName,
  onRenameLine,
  onSetLineNumber,
  onRecolorLine,
  onSetLineCompany,
  onExtendLine,
  onDeleteLine,
  onRenameStation,
  focusNameToken,
  onAddStationToLine,
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
}: RightPanelProps) {
  const [tab, setTab] = useState('Lines')

  // Which way the content slides when the tab changes: rightward through the strip (and on to
  // Properties, which is the deepest view) enters from the right, back the other way from the
  // left. Recomputed only when the tab actually changes and frozen in a ref otherwise, so an
  // unrelated re-render — selecting a row, say — doesn't replay the slide.
  const slide = useRef<{ tab: string; dir: 'left' | 'right' }>({ tab, dir: 'right' })
  if (tab !== slide.current.tab) {
    slide.current = { tab, dir: TAB_ORDER.indexOf(tab) >= TAB_ORDER.indexOf(slide.current.tab) ? 'right' : 'left' }
  }

  // Catches selections made out on the canvas, where there's no row to hang the navigation
  // off. It can only react to the selection *changing*, which is why the lists below don't
  // rely on it.
  useEffect(() => {
    if (selectedLine || selectedStation || selectedGeoFeature || selectedPoi || selectedCompany) setTab('Properties')
  }, [selectedLine, selectedStation, selectedGeoFeature, selectedPoi, selectedCompany])

  /**
   * Picking a row is a request to see that thing, so the click navigates rather than leaving
   * it to the effect above. Re-picking whatever is already selected leaves every one of that
   * effect's dependencies identical — same id, same object — so it never re-runs, and the
   * click would appear to do nothing at all. Going back and clicking the same row again is
   * exactly the gesture the back arrow invites, which is what made this worth fixing.
   */
  const openDetail = (select: (id: string) => void) => (id: string) => {
    select(id)
    setTab('Properties')
  }

  // What Properties is currently showing, and which list it was reached from. Selecting
  // something is the only way to land there, so the selection itself is the trail back —
  // no navigation history to keep, and the answer can't go stale.
  const detail = selectedLine
    ? { title: selectedLine.name.trim() || `Line ${selectedLine.number}`, from: 'Lines' }
    : selectedStation
      ? { title: selectedStation.name.trim() || 'Station', from: 'Stations' }
      : selectedGeoFeature
        ? { title: selectedGeoFeature.name.trim() || (selectedGeoFeature.type === 'river' ? 'River' : 'Park'), from: 'Geography' }
        : selectedPoi
          ? { title: selectedPoi.name.trim() || 'Point of interest', from: 'Geography' }
          : selectedCompany
            ? { title: selectedCompany.name.trim() || 'Company', from: 'Companies' }
            : null

  // Only Properties-with-a-selection has anywhere to go back to. Everywhere else the
  // subheader is just a title, rather than a dead arrow that reads as broken.
  const showBack = tab === 'Properties' && detail !== null

  return (
    <div
      style={{
        // Height comes from the surrounding column, which reserves the space below for the
        // authority mark; minHeight lets the tab lists scroll instead of pushing it off.
        flex: 1,
        minHeight: 0,
        background: 'var(--panel-glass)',
        backdropFilter: 'var(--panel-blur)',
        WebkitBackdropFilter: 'var(--panel-blur)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      {/* Tighter than the design system's own padding, which is sized for a wider column than
          this panel has. Even four tabs overflow at 16px a side. */}
      <div className="mlb-tabs" style={{ borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <Tabs tabs={TABS} activeTab={tab} onChange={setTab} />
      </div>

      {/* Says where you are on every tab, and on Properties offers the way back out. The
          selection is left alone on the way back — the list highlights whatever you were
          just looking at, which is the point of going back to it. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--gap-tight)',
          // Tighter on the left when the button is there: its own padding supplies the rest,
          // so the title starts in the same place either way.
          padding: showBack ? '5px 12px 5px 6px' : '5px 12px',
          minHeight: '34px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        {showBack && (
          <HoverTip label={`Back to ${detail.from}`} placement="bottom">
            <IconButton icon={<BackIcon />} label={`Back to ${detail.from}`} size="sm" onClick={() => setTab(detail.from)} />
          </HoverTip>
        )}
        <span
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {detail && tab === 'Properties' ? detail.title : tab}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        {/* Keyed by tab so switching remounts and replays the slide; the class carries the
            direction frozen above. */}
        <div key={tab} className={slide.current.dir === 'right' ? 'mlb-tab-in-right' : 'mlb-tab-in-left'}>
        {tab === 'Lines' && (
          <LinesPanel
            lines={lineList}
            selectedLineId={selectedLine?.id ?? null}
            onSelect={openDetail(onSelectLine)}
            onToggleVisibility={onToggleLineVisibility}
            onAddLine={onAddLine}
            onReorder={onReorderLine}
          />
        )}
        {tab === 'Stations' && (
          <StationsPanel
            stations={stationList}
            lines={lineList}
            selectedStationId={selectedStation?.id ?? null}
            onSelect={openDetail(onSelectStation)}
          />
        )}
        {tab === 'Geography' && (
          <GeoPanel
            geoFeatureList={geoFeatureList}
            poiList={poiList}
            selectedGeoFeatureId={selectedGeoFeature?.id ?? null}
            selectedPoiId={selectedPoi?.id ?? null}
            onSelect={openDetail(onSelectGeoFeature)}
            onSelectPoi={openDetail(onSelectPoi)}
            onAddRiver={onAddRiver}
            onAddPark={onAddPark}
            onAddPoi={onAddPoi}
          />
        )}
        {tab === 'Companies' && (
          <CompaniesPanel
            companies={companyList}
            selectedCompanyId={selectedCompany?.id ?? null}
            onSelect={openDetail(onSelectCompany)}
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
            selectedPoi={selectedPoi}
            selectedCompany={selectedCompany}
            stations={stations}
            lines={lines}
            companyList={companyList}
            authorityDisplayName={authorityDisplayName}
            onRenameLine={onRenameLine}
            onSetLineNumber={onSetLineNumber}
            onRecolorLine={onRecolorLine}
            onSetLineCompany={onSetLineCompany}
            onExtendLine={onExtendLine}
            onDeleteLine={onDeleteLine}
            onRenameStation={onRenameStation}
            focusNameToken={focusNameToken}
            onAddStationToLine={onAddStationToLine}
            onToggleTransfer={onToggleTransfer}
            onToggleMain={onToggleMain}
            onDeleteStation={onDeleteStation}
            onRenameGeoFeature={onRenameGeoFeature}
            onExtendGeoFeature={onExtendGeoFeature}
            onDeleteGeoFeature={onDeleteGeoFeature}
            onRenamePoi={onRenamePoi}
            onSetPoiIcon={onSetPoiIcon}
            onDeletePoi={onDeletePoi}
            onRenameCompany={onRenameCompany}
            onSetCompanyType={onSetCompanyType}
            onSetCompanySymbol={onSetCompanySymbol}
            onDeleteCompany={onDeleteCompany}
          />
        )}
        </div>
      </div>
    </div>
  )
}
