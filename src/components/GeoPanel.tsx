import { Button } from 'metro-ds'
import { ParkIcon, RiverIcon } from '../icons'
import type { GeoFeature } from '../types'

interface GeoPanelProps {
  geoFeatureList: GeoFeature[]
  selectedGeoFeatureId: string | null
  onSelect: (geoFeatureId: string) => void
  onAddRiver: () => void
  onAddPark: () => void
}

export function GeoPanel({ geoFeatureList, selectedGeoFeatureId, onSelect, onAddRiver, onAddPark }: GeoPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {geoFeatureList.length === 0 && (
        <p style={{ padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
          No geography yet. Draw a river or park on the canvas.
        </p>
      )}

      {geoFeatureList.map(feature => {
        const isSelected = feature.id === selectedGeoFeatureId
        return (
          <div
            key={feature.id}
            onClick={() => onSelect(feature.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-sm)',
              padding: '8px 12px',
              cursor: 'pointer',
              background: isSelected ? 'var(--color-info-bg)' : 'transparent',
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

      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Button size="sm" variant="ghost" icon={<RiverIcon />} onClick={onAddRiver} style={{ width: '100%', justifyContent: 'flex-start' }}>
          Add river
        </Button>
        <Button size="sm" variant="ghost" icon={<ParkIcon />} onClick={onAddPark} style={{ width: '100%', justifyContent: 'flex-start' }}>
          Add park
        </Button>
      </div>
    </div>
  )
}
