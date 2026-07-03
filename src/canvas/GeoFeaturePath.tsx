import type { MouseEvent } from 'react'
import type { GeoFeature } from '../types'
import { routeOrthogonal } from './routing'

interface GeoFeaturePathProps {
  feature: GeoFeature
  selected: boolean
  onClick?: (feature: GeoFeature) => void
}

const RIVER_COLOR = '#BFDBFE'
const PARK_FILL = '#DCFCE7'
const PARK_STROKE = '#86EFAC'

/**
 * Renders with the same 45-degree elbow routing as transit lines (see
 * routeOrthogonal), so geography reads in the same angled Tube-map idiom
 * as the lines and stations, rather than contrasting organic curves.
 */
export function GeoFeaturePath({ feature, selected, onClick }: GeoFeaturePathProps) {
  if (feature.points.length < 2) return null

  const handleClick = (e: MouseEvent<SVGPathElement>) => {
    e.stopPropagation()
    onClick?.(feature)
  }

  if (feature.type === 'river') {
    return (
      <path
        d={routeOrthogonal(feature.points)}
        fill="none"
        stroke={RIVER_COLOR}
        strokeWidth={selected ? 16 : 14}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={selected ? 0.9 : 0.7}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      />
    )
  }

  return (
    <path
      d={routeOrthogonal(feature.points, true)}
      fill={PARK_FILL}
      stroke={selected ? 'var(--brand-500)' : PARK_STROKE}
      strokeWidth={selected ? 2 : 1.5}
      opacity={selected ? 0.9 : 0.7}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    />
  )
}
