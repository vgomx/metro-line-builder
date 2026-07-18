import { Button } from 'metro-ds'
import { ParkIcon, PoiIcon, RiverIcon } from '../icons'
import { openMojiUrl } from '../openmoji'
import type { GeoFeature, PointOfInterest } from '../types'

interface GeoPanelProps {
  geoFeatureList: GeoFeature[]
  poiList: PointOfInterest[]
  selectedGeoFeatureId: string | null
  selectedPoiId: string | null
  onSelect: (geoFeatureId: string) => void
  onSelectPoi: (poiId: string) => void
  onAddRiver: () => void
  onAddPark: () => void
  onAddPoi: () => void
}

export function GeoPanel({
  geoFeatureList,
  poiList,
  selectedGeoFeatureId,
  selectedPoiId,
  onSelect,
  onSelectPoi,
  onAddRiver,
  onAddPark,
  onAddPoi,
}: GeoPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {geoFeatureList.length === 0 && poiList.length === 0 && (
        <p style={{ padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
          No geography yet. Draw a river or park on the canvas, or drop a point of interest.
        </p>
      )}

      {geoFeatureList.map(feature => {
        const isSelected = feature.id === selectedGeoFeatureId
        return (
          <div
            key={feature.id}
            onClick={() => onSelect(feature.id)}
            className="mlb-row"
            data-selected={isSelected}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-sm)',
              padding: '8px 12px',
              cursor: 'pointer',
              borderLeft: `3px solid ${isSelected ? 'var(--interactive-primary)' : 'transparent'}`,
              color: feature.type === 'river' ? '#3B82F6' : '#16A34A',
            }}
          >
            {feature.type === 'river' ? <RiverIcon /> : <ParkIcon />}
            <span
              style={{
                flex: 1,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                fontWeight: isSelected ? 500 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {feature.name}
            </span>
          </div>
        )
      })}

      {/* Landmarks share this tab with rivers and parks: all three are the city the network
          runs through rather than the network itself. */}
      {poiList.map(poi => {
        const isSelected = poi.id === selectedPoiId
        const url = openMojiUrl(poi.icon)
        return (
          <div
            key={poi.id}
            onClick={() => onSelectPoi(poi.id)}
            className="mlb-row"
            data-selected={isSelected}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-sm)',
              padding: '8px 12px',
              cursor: 'pointer',
              borderLeft: `3px solid ${isSelected ? 'var(--interactive-primary)' : 'transparent'}`,
            }}
          >
            {url ? <img src={url} alt="" width={16} height={16} /> : <PoiIcon />}
            <span
              style={{
                flex: 1,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                fontWeight: isSelected ? 500 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {poi.name}
            </span>
          </div>
        )
      })}

      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Button size="sm" variant="ghost" icon={<RiverIcon />} onClick={onAddRiver} style={{ width: '100%', justifyContent: 'flex-start' }}>
          Add river
        </Button>
        <Button size="sm" variant="ghost" icon={<ParkIcon />} onClick={onAddPark} style={{ width: '100%', justifyContent: 'flex-start' }}>
          Add park
        </Button>
        <Button size="sm" variant="ghost" icon={<PoiIcon />} onClick={onAddPoi} style={{ width: '100%', justifyContent: 'flex-start' }}>
          Add point of interest
        </Button>
      </div>
    </div>
  )
}
